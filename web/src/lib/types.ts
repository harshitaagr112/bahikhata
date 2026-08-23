export type LedgerType =
  | "cash"
  | "bank"
  | "limit"
  | "customer"
  | "income"
  | "expense"
  | "discount"
  | "other";

export const LEDGER_TYPES: LedgerType[] = [
  "cash",
  "bank",
  "limit",
  "customer",
  "income",
  "expense",
  "discount",
  "other",
];

export interface Ledger {
  id: number;
  name: string;
  type: LedgerType;
  c_o: string | null;
  address: string | null;
  is_system: boolean;
  merged_into_id: number | null;
  created_at: string;
  updated_at: string;
  /** Only present on search results (comma-separated, most recent first). */
  mobile_numbers?: string;
}

export interface LedgerMobileNumber {
  id: number;
  ledger_id: number;
  number: string;
  added_at: string;
}

export type TransactionType =
  | "payment"
  | "receipt"
  | "discount"
  | "income"
  | "journal";

export interface TransactionEntry {
  id: number;
  transaction_id: number;
  ledger_id: number;
  debit: number;
  credit: number;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  txn_date: string;
  narration: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithEntries extends Transaction {
  entries: TransactionEntry[];
}

export interface DaybookEntry {
  ledger_id: number;
  ledger_name: string;
  debit: string;
  credit: string;
}

export interface DaybookRow extends Transaction {
  entries: DaybookEntry[];
}

export interface DaybookResponse {
  transactions: DaybookRow[];
  total_debit: string;
  total_credit: string;
}

export interface StatementCounterparty {
  ledger_id: number;
  name: string;
}

export interface StatementRow {
  entry_id: number;
  transaction_id: number;
  date: string;
  type: string;
  narration: string;
  counterparties: StatementCounterparty[];
  debit: string;
  credit: string;
  balance: string;
}

export interface StatementResponse {
  opening_balance: string;
  closing_balance: string;
  total_debit: string;
  total_credit: string;
  entries: StatementRow[];
}

export interface BalanceResponse {
  total_debit: string;
  total_credit: string;
  balance: string;
}

export interface OutstandingEntry {
  ledger_id: number;
  name: string;
  type: string;
  amount: string;
}

export interface OutstandingResponse {
  receivables: OutstandingEntry[];
  payables: OutstandingEntry[];
}

export interface JournalLineInput {
  ledger_id: number;
  debit?: string;
  credit?: string;
}

export interface CreateTransactionInput {
  type: TransactionType;
  date: string;
  narration?: string;
  mobile?: string;
  amount?: string;
  paid_from_id?: number;
  paid_to_id?: number;
  received_from_id?: number;
  received_in_id?: number;
  discount_from_id?: number;
  discount_to_id?: number;
  income_account_id?: number;
  lines?: JournalLineInput[];
}

/**
 * Insurance companies this agency has worked with, seeded from the company
 * section headers in a real renewal export (MAY27_RENEWAL.pdf) so the
 * company filter/autocomplete has useful options even before any policy
 * for that company has been entered yet. Not exhaustive/enforced — the
 * company field itself stays free text (see InsurancePolicyForm).
 */
export const KNOWN_INSURANCE_COMPANIES: string[] = [
  "ICICI Lombard GIC Ltd.",
  "FUTURE GENERAL INSURANCE",
  "TATA AIG GENERAL INSURANCE COMPANY",
  "CHOLA MANDALAM",
  "ORIENTAL INSURANCE COMPANY",
  "UNITED GENERAL INSURANCE",
  "UNIVERSAL SOMPO GENERAL INSURANCE",
  "STAR HEALTH INSURANCE",
  "SURYA INSURANCE (PAL JI BALRAMPUR)",
  "SHRIRAM GENERAL INSURANCE (AMISHA)",
  "ANIL AGARWAL ( BALRAMPUR)",
  "GO DIGIT GENERAL INSURANCE LIMITED",
];

export type CommissionBasis = "net_premium" | "od_premium";

export const COMMISSION_BASIS_OPTIONS: { value: CommissionBasis; label: string }[] = [
  { value: "net_premium", label: "Net Premium" },
  { value: "od_premium", label: "OD Premium" },
];

export interface InsurancePolicy {
  id: number;
  ledger_id: number | null;
  insured_name: string;
  location: string | null;
  mobile_no: string | null;
  payment_mode: string | null;
  company: string;
  vehicle_category: string | null;
  vehicle_model: string | null;
  registration_no: string | null;
  policy_no: string | null;
  issue_date: string;
  expiry_date: string;
  sum_assured: string | null;
  od_premium: string | null;
  net_premium: string;
  total_premium: string;
  commission_basis: CommissionBasis;
  commission_percentage: string | null;
  /** Derived, not stored — the premium amount commission is calculated on. */
  commission_basis_amount: string | null;
  /** Derived, not stored — the resulting payout (basis_amount * pct / 100). */
  commission_amount: string | null;
}

export interface InsurancePolicyInput {
  ledger_id?: number | null;
  insured_name: string;
  location?: string;
  mobile_no?: string;
  payment_mode?: string;
  company: string;
  vehicle_category?: string;
  vehicle_model?: string;
  registration_no?: string;
  policy_no?: string;
  issue_date: string;
  expiry_date: string;
  sum_assured?: string;
  od_premium?: string;
  net_premium: string;
  total_premium: string;
  commission_basis?: CommissionBasis;
  commission_percentage?: string;
}
