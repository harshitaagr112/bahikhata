import type {
  BalanceResponse,
  CreateTransactionInput,
  DaybookResponse,
  Ledger,
  LedgerMobileNumber,
  LedgerType,
  OutstandingResponse,
  StatementResponse,
  TransactionWithEntries,
} from "./types";

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore, keep statusText
    }
    throw new ApiError(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// -- Ledgers -----------------------------------------------------------

export function searchLedgers(q: string): Promise<Ledger[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  return request<Ledger[]>(`/api/ledgers?${params.toString()}`);
}

export interface CreateLedgerInput {
  name: string;
  type: LedgerType;
  c_o?: string;
  address?: string;
  opening_balance?: string;
  as_of_date?: string;
}

export function createLedger(input: CreateLedgerInput): Promise<Ledger> {
  return request<Ledger>("/api/ledgers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getLedger(id: number): Promise<Ledger> {
  return request<Ledger>(`/api/ledgers/${id}`);
}

export function updateLedger(
  id: number,
  input: { name: string; c_o?: string; address?: string }
): Promise<Ledger> {
  return request<Ledger>(`/api/ledgers/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteLedger(id: number): Promise<{ deleted: boolean }> {
  return request(`/api/ledgers/${id}`, { method: "DELETE" });
}

export function listLedgerMobileNumbers(
  id: number
): Promise<LedgerMobileNumber[]> {
  return request<LedgerMobileNumber[]>(`/api/ledgers/${id}/mobile-numbers`);
}

export function addLedgerMobileNumber(
  id: number,
  number: string
): Promise<LedgerMobileNumber> {
  return request<LedgerMobileNumber>(`/api/ledgers/${id}/mobile-numbers`, {
    method: "POST",
    body: JSON.stringify({ number }),
  });
}

export function getLedgerStatement(
  id: number,
  from?: string,
  to?: string
): Promise<StatementResponse> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<StatementResponse>(
    `/api/ledgers/${id}/statement?${params.toString()}`
  );
}

export function getLedgerBalance(id: number): Promise<BalanceResponse> {
  return request<BalanceResponse>(`/api/ledgers/${id}/balance`);
}

export function mergeLedger(
  id: number,
  targetLedgerId: number
): Promise<{ merged: boolean; merged_into_id: number }> {
  return request(`/api/ledgers/${id}/merge`, {
    method: "POST",
    body: JSON.stringify({ target_ledger_id: targetLedgerId }),
  });
}

// -- Transactions --------------------------------------------------------

export function createTransaction(
  input: CreateTransactionInput
): Promise<TransactionWithEntries> {
  return request<TransactionWithEntries>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTransaction(id: number): Promise<TransactionWithEntries> {
  return request<TransactionWithEntries>(`/api/transactions/${id}`);
}

export function updateTransaction(
  id: number,
  input: CreateTransactionInput
): Promise<TransactionWithEntries> {
  return request<TransactionWithEntries>(`/api/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: number): Promise<{ deleted: boolean }> {
  return request(`/api/transactions/${id}`, { method: "DELETE" });
}

export function getDaybook(from?: string, to?: string): Promise<DaybookResponse> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<DaybookResponse>(`/api/daybook?${params.toString()}`);
}

export function getOutstanding(): Promise<OutstandingResponse> {
  return request<OutstandingResponse>("/api/outstanding");
}

// -- Auth ------------------------------------------------------------

export async function login(username: string, password: string): Promise<void> {
  await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await request("/api/logout", { method: "POST" });
}

export async function getMe(): Promise<{ authenticated: boolean }> {
  return request<{ authenticated: boolean }>("/api/me");
}

export { ApiError };
