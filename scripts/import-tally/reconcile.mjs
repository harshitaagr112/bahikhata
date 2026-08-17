import { verifyRunningBalance } from "./parse.mjs";

function normalize(name) {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Two-tier reconciliation (docs/DECISIONS.md item 20):
 *  - lumpSum: master-list accounts with no detailed file — import as a
 *    single Opening Balance entry.
 *  - detailed: accounts with a detailed file — import every row as its
 *    own dated Journal against Opening Balance; never also apply the
 *    lump sum for these.
 *  - unmatchedDetailed: a detailed file whose ledger name didn't match
 *    anything in the master list — flagged, never silently guessed.
 *  - discrepancies: a detailed file's computed closing balance disagrees
 *    with the master list's figure for that account — flagged, not
 *    auto-resolved either direction.
 */
export function reconcile(masterAccounts, detailedLedgers) {
  const masterByNormalizedName = new Map(masterAccounts.map((a) => [normalize(a.name), a]));
  const consumedNames = new Set();

  const detailed = [];
  const unmatchedDetailed = [];
  const discrepancies = [];

  for (const ledger of detailedLedgers) {
    const key = normalize(ledger.ledgerName);
    const masterEntry = masterByNormalizedName.get(key);
    const { finalBalance, mismatches } = verifyRunningBalance(ledger);

    if (!masterEntry) {
      unmatchedDetailed.push({ ...ledger, computedBalance: finalBalance, internalMismatches: mismatches });
      continue;
    }

    consumedNames.add(key);
    const diff = Math.abs(finalBalance - masterEntry.balance);
    const record = {
      name: masterEntry.name,
      entries: ledger.entries,
      masterBalance: masterEntry.balance,
      computedBalance: finalBalance,
      internalMismatches: mismatches,
    };
    detailed.push(record);
    if (diff > 0.01) {
      discrepancies.push({ ...record, diff });
    }
  }

  const lumpSum = masterAccounts.filter((a) => !consumedNames.has(normalize(a.name)));

  return { lumpSum, detailed, unmatchedDetailed, discrepancies };
}
