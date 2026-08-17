import XLSX from "xlsx";

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const AMOUNT_RE = /^[\d,]+\.\d{2}$/;

function parseAmount(s) {
  if (!s || !AMOUNT_RE.test(String(s).trim())) return null;
  return parseFloat(String(s).replace(/,/g, ""));
}

function toISODate(ddmmyyyy) {
  const m = DATE_RE.exec(ddmmyyyy);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function readRows(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
}

/**
 * Parses debt.xls-shaped master list: header block, then one row per
 * account (Name | Debit | Credit), then a "Grand Total" footer row.
 * Returns [{ name, balance }] where balance is signed: +Debit / -Credit.
 */
export function parseMasterList(filePath) {
  const rows = readRows(filePath);
  const accounts = [];

  for (const row of rows) {
    const [name, debit, credit] = row;
    if (!name || name === "Grand Total") continue;
    const debitNum = parseAmount(debit);
    const creditNum = parseAmount(credit);
    // Header/label rows (title, date-range, "Debit"/"Credit" column
    // headers) have no strictly-numeric amount in either column — skip
    // rather than let a stray parseFloat partially parse "1/Apr/2026...".
    if (debitNum === null && creditNum === null) continue;
    accounts.push({ name: name.trim(), balance: (debitNum ?? 0) - (creditNum ?? 0) });
  }

  return accounts;
}

/**
 * Parses a gt.xls-shaped detailed ledger export. A row is a transaction iff
 * column 1 (Date) matches DD/MM/YYYY. A row is a narration line for the
 * *previous* transaction iff column 1 is non-empty text and every other
 * column is blank. Everything else (header block, footer totals) falls
 * through neither rule and is naturally skipped — no special-casing by row
 * position needed.
 */
export function parseDetailedLedger(filePath) {
  const rows = readRows(filePath);

  let ledgerName = null;
  const headerRow = rows.find((r) => r[0] === "Ledger:");
  if (headerRow) ledgerName = String(headerRow[1]).trim();

  const entries = [];

  for (const row of rows) {
    const [, date, toBy, counterparty, vchType, debit, credit, closingBalance] = row;

    if (DATE_RE.test(date)) {
      // Trust the "To"/"By" marker (To = Dr, By = Cr) over fixed column
      // position — some rows (e.g. an "Opening Balance" line with no Vch
      // Type) print their amount in the opposite column from what every
      // other row uses, which silently flips the sign if you trust the
      // column instead of the marker.
      const amount = parseAmount(debit) ?? parseAmount(credit) ?? 0;
      const isDebit = toBy === "To";
      entries.push({
        date: toISODate(date),
        counterparty: counterparty ? String(counterparty).trim() : "",
        vchType: vchType ? String(vchType).trim() : "",
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        closingBalance: closingBalance ? String(closingBalance).trim() : "",
        narration: null,
      });
      continue;
    }

    const isNarrationRow =
      date &&
      !counterparty &&
      !vchType &&
      !debit &&
      !credit &&
      !closingBalance;
    if (isNarrationRow && entries.length > 0) {
      const text = String(date).trim();
      const last = entries[entries.length - 1];
      last.narration = last.narration ? `${last.narration} / ${text}` : text;
    }
  }

  return { ledgerName, entries };
}

/** Sanity check: replay a detailed ledger's entries and compare our own
 * running balance against Tally's own printed closing-balance column, so a
 * parsing bug surfaces immediately rather than silently importing wrong
 * numbers. */
export function verifyRunningBalance({ entries }) {
  let balance = 0;
  const mismatches = [];
  for (const e of entries) {
    balance += e.debit - e.credit;
    const expected = e.closingBalance.replace(/,/g, "");
    const expectedNum = parseFloat(expected);
    const expectedSign = expected.endsWith("Cr") ? -1 : 1;
    const expectedSigned = expectedSign * Math.abs(expectedNum);
    if (Math.abs(expectedSigned - balance) > 0.01) {
      mismatches.push({ date: e.date, expected: expectedSigned, computed: balance });
    }
  }
  return { finalBalance: balance, mismatches };
}
