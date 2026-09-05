import { readdirSync } from "node:fs";
import path from "node:path";
import { parseDetailedLedger } from "./parse.mjs";
import {
  login,
  findLedgerByExactName,
  getOpeningBalanceLedgerId,
  createBareLedger,
  postOpeningBalanceJournal,
} from "./api.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const OUTSTANDING_DIR = path.join(REPO_ROOT, "outstanding");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");

function loadDetailedLedgers() {
  const files = readdirSync(OUTSTANDING_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xls"))
    .sort();
  return files.map((f) => ({
    file: f,
    ...parseDetailedLedger(path.join(OUTSTANDING_DIR, f)),
  }));
}

function printDryRunReport(detailedLedgers) {
  console.log("=== Outstanding Folder Import — Dry Run ===\n");
  console.log(`Outstanding files to import: ${detailedLedgers.length}`);

  for (const ledger of detailedLedgers) {
    console.log(`  ${ledger.ledgerName.padEnd(50)} ${ledger.entries.length} rows`);
  }

  console.log("\nThis mode only transfers the historical entries from the outstanding folder.\n");
  console.log("No debt.xls dependency is used in this run.");
  console.log("Run again with --commit to import these files into the database.");
}

function buildNarration(entry) {
  const parts = [`Via ${entry.counterparty} (${entry.vchType})`];
  if (entry.narration) parts.push(entry.narration);
  return parts.join(" — ");
}

async function commit(detailedLedgers) {
  await login();
  const systemLedgerId = await getOpeningBalanceLedgerId();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log("\n=== Committing outstanding entries ===\n");

  for (const ledger of detailedLedgers) {
    try {
      const existing = await findLedgerByExactName(ledger.ledgerName);
      if (existing) {
        console.log(`  SKIP (exists) ${ledger.ledgerName}`);
        skipped++;
        continue;
      }

      const createdLedger = await createBareLedger({ name: ledger.ledgerName });
      for (const entry of ledger.entries) {
        await postOpeningBalanceJournal({
          date: entry.date,
          narration: buildNarration(entry),
          ledgerId: createdLedger.id,
          systemLedgerId,
          debit: entry.debit,
          credit: entry.credit,
        });
      }

      console.log(`  OK ${ledger.ledgerName} (${ledger.entries.length} entries)`);
      created++;
    } catch (e) {
      console.error(`  FAIL ${ledger.ledgerName}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (already existed), ${failed} failed.`);
}

async function main() {
  const detailedLedgers = loadDetailedLedgers();
  printDryRunReport(detailedLedgers);

  if (COMMIT) {
    await commit(detailedLedgers);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
