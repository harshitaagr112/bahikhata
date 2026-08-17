const TYPE_KEY = "khata:lastTransactionType";
const DATE_KEY = "khata:lastTransactionDate";
const DEFAULT_TYPE = "receipt";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Remembers the type/date of the last transaction actually *saved* (not
 * just visited) — so a fresh "+ New Transaction" defaults to both, the way
 * a paper daybook naturally continues from wherever you left off. */
export function getLastTransactionType(): string {
  if (typeof window === "undefined") return DEFAULT_TYPE;
  return window.localStorage.getItem(TYPE_KEY) || DEFAULT_TYPE;
}

export function setLastTransactionType(type: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TYPE_KEY, type);
}

export function getLastTransactionDate(): string {
  if (typeof window === "undefined") return todayISO();
  return window.localStorage.getItem(DATE_KEY) || todayISO();
}

export function setLastTransactionDate(date: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATE_KEY, date);
}
