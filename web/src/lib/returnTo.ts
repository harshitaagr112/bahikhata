const KEY = "khata:returnTo";

// Pages that are themselves part of the "create/edit a transaction" flow —
// visiting one of these must never overwrite the stored return-to path,
// otherwise switching transaction type (TransactionTypeSwitcher) or
// re-rendering the edit page would clobber the page the user actually came
// from before starting the flow.
const TRANSACTION_FLOW_PATTERNS = [/^\/transactions\/new\//, /^\/transactions\/\d+\/edit$/];

function isTransactionFlowPath(pathname: string): boolean {
  return TRANSACTION_FLOW_PATTERNS.some((re) => re.test(pathname)) || pathname === "/login";
}

/** Called on every route change (see RouteTracker) to remember the last
 * page the user was on outside the transaction create/edit flow, so a save
 * or delete there can return to it instead of always landing on Daybook. */
export function recordVisitedPath(pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  if (isTransactionFlowPath(pathname)) return;
  window.sessionStorage.setItem(KEY, search ? `${pathname}${search}` : pathname);
}

/** Where a transaction create/edit/delete should navigate back to once
 * done. Falls back to Daybook (the previous fixed behavior) if nothing has
 * been recorded yet, e.g. the flow was opened directly via URL. */
export function getReturnTo(): string {
  if (typeof window === "undefined") return "/daybook";
  return window.sessionStorage.getItem(KEY) || "/daybook";
}

const NAV_DEPTH_KEY = "khata:navDepth";

/** Bumped by RouteTracker on every route change. Used by the global
 * Escape-to-go-back shortcut to tell "there's real in-app history to go
 * back to" apart from "this is the first page this tab has shown" — in
 * the latter case `router.back()` could navigate the tab out of the app
 * entirely, which we never want a keyboard shortcut to do. */
export function bumpNavDepth(): void {
  if (typeof window === "undefined") return;
  const current = Number(window.sessionStorage.getItem(NAV_DEPTH_KEY) || "0");
  window.sessionStorage.setItem(NAV_DEPTH_KEY, String(current + 1));
}

export function canGoBack(): boolean {
  if (typeof window === "undefined") return false;
  return Number(window.sessionStorage.getItem(NAV_DEPTH_KEY) || "0") >= 2;
}
