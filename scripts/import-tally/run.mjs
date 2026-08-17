import { readdirSync } from "node:fs";
import path from "node:path";
import { parseMasterList, parseDetailedLedger } from "./parse.mjs";
import { reconcile } from "./reconcile.mjs";
import {
  login,
  findLedgerByExactName,
  getOpeningBalanceLedgerId,
  createLumpSumLedger,
  createBareLedger,
  postOpeningBalanceJournal,
} from "./api.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MASTER_LIST_PATH = path.join(REPO_ROOT, "debt.xls");
const OUTSTANDING_DIR = path.join(REPO_ROOT, "outstanding");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");

function money(n) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadDetailedLedgers() {
  const files = readdirSync(OUTSTANDING_DIR).filter((f) => f.toLowerCase().endsWith(".xls"));
  return files.map((f) => parseDetailedLedger(path.join(OUTSTANDING_DIR, f)));
}

function printDryRunReport({ lumpSum, detailed, unmatchedDetailed, discrepancies }, todayISO) {
  console.log("=== Tally Import — Dry Run ===\n");
  console.log(`Master list: ${lumpSum.length + detailed.length} accounts total`);
  console.log(`  ${lumpSum.length} lump-sum only (no detailed file)`);
  console.log(`  ${detailed.length} with a detailed transaction history\n`);

  console.log(`--- Lump-sum accounts (opening balance as of ${todayISO}) ---`);
  for (const a of lumpSum) {
    console.log(`  ${a.name.padEnd(45)} ${money(a.balance)} ${a.balance >= 0 ? "Dr" : "Cr"}`);
  }

  console.log(`\n--- Detailed accounts (each imported as dated Journal entries) ---`);
  for (const d of detailed) {
    const flag = Math.abs(d.masterBalance - d.computedBalance) > 0.01 ? "  ⚠ DISCREPANCY" : "";
    console.log(
      `  ${d.name.padEnd(45)} ${d.entries.length} rows, computed ${money(d.computedBalance)}, master ${money(d.masterBalance)}${flag}`
    );
    if (d.internalMismatches.length > 0) {
      console.log(`      ⚠ ${d.internalMismatches.length} row(s) don't match Tally's own printed running balance`);
    }
  }

  if (unmatchedDetailed.length > 0) {
    console.log(`\n--- ⚠ Detailed files with NO match in the master list (${unmatchedDetailed.length}) ---`);
    for (const u of unmatchedDetailed) {
      console.log(`  ${u.ledgerName} (computed balance ${money(u.computedBalance)}) — not in debt.xls`);
    }
  }

  if (discrepancies.length > 0) {
    console.log(`\n--- ⚠ Balance discrepancies vs. master list (${discrepancies.length}) ---`);
    for (const d of discrepancies) {
      console.log(`  ${d.name}: detailed file says ${money(d.computedBalance)}, debt.xls says ${money(d.masterBalance)} (diff ${money(d.diff)})`);
    }
  }

  const blocked = unmatchedDetailed.length > 0 || discrepancies.length > 0;
  console.log(
    blocked
      ? "\n⚠ Resolve the flagged items above before running with --commit."
      : "\nNo issues found. Run again with --commit to actually import."
  );
  return !blocked;
}

function buildNarration(entry) {
  const parts = [`Via ${entry.counterparty} (${entry.vchType})`];
  if (entry.narration) parts.push(entry.narration);
  return parts.join(" — ");
}

async function commit({ lumpSum, detailed }, todayISO) {
  await login();
  const systemLedgerId = await getOpeningBalanceLedgerId();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log("\n=== Committing ===\n");

  for (const a of lumpSum) {
    try {
      const existing = await findLedgerByExactName(a.name);
      if (existing) {
        console.log(`  SKIP (exists) ${a.name}`);
        skipped++;
        continue;
      }
      await createLumpSumLedger({ name: a.name, balance: a.balance, asOfDate: todayISO });
      console.log(`  OK lump-sum   ${a.name} (${money(a.balance)})`);
      created++;
    } catch (e) {
      console.error(`  FAIL ${a.name}: ${e.message}`);
      failed++;
    }
  }

  for (const d of detailed) {
    try {
      const existing = await findLedgerByExactName(d.name);
      if (existing) {
        console.log(`  SKIP (exists) ${d.name}`);
        skipped++;
        continue;
      }
      const ledger = await createBareLedger({ name: d.name });
      for (const entry of d.entries) {
        await postOpeningBalanceJournal({
          date: entry.date,
          narration: buildNarration(entry),
          ledgerId: ledger.id,
          systemLedgerId,
          debit: entry.debit,
          credit: entry.credit,
        });
      }
      console.log(`  OK detailed   ${d.name} (${d.entries.length} entries, ${money(d.computedBalance)})`);
      created++;
    } catch (e) {
      console.error(`  FAIL ${d.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (already existed), ${failed} failed.`);
}

async function main() {
  const masterAccounts = parseMasterList(MASTER_LIST_PATH);
  const detailedLedgers = loadDetailedLedgers();
  const result = reconcile(masterAccounts, detailedLedgers);
  const todayISO = new Date().toISOString().slice(0, 10);

  const clean = printDryRunReport(result, todayISO);

  if (COMMIT) {
    if (!clean) {
      console.error("\nRefusing to commit while items are flagged. Fix and re-run.");
      process.exit(1);
    }
    await commit(result, todayISO);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
