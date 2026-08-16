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

export interface StatementRow {
  entry_id: number;
  transaction_id: number;
  date: string;
  type: string;
  narration: string;
  counterparty: string;
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
