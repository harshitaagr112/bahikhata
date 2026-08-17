const BASE_URL = process.env.TALLY_API_URL ?? "http://localhost:8080";

let sessionCookie = null;

/** Every API route except /api/login requires a session now — log in once
 * per script run and reuse the cookie for every subsequent request. */
export async function login() {
  const username = process.env.TALLY_AUTH_USERNAME;
  const password = process.env.TALLY_AUTH_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Set TALLY_AUTH_USERNAME and TALLY_AUTH_PASSWORD (matching api/.env's AUTH_USERNAME / the plaintext password whose hash is AUTH_PASSWORD_HASH) before running the importer."
    );
  }
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("login succeeded but no session cookie was returned");
  sessionCookie = setCookie.split(";")[0];
}

async function request(path, options) {
  if (!sessionCookie) {
    throw new Error("Not logged in — call login() before making any other API call.");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${options?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

/** Exact-name lookup used for idempotency — re-running the importer must
 * not create duplicate ledgers for accounts already imported. */
export async function findLedgerByExactName(name) {
  const results = await request(`/api/ledgers?q=${encodeURIComponent(name)}`);
  return results.find((l) => l.name === name) ?? null;
}

export async function getOpeningBalanceLedgerId() {
  const results = await request(`/api/ledgers?q=Opening Balance`);
  const system = results.find((l) => l.is_system);
  if (!system) throw new Error("System Opening Balance ledger not found");
  return system.id;
}

export async function createLumpSumLedger({ name, balance, asOfDate }) {
  return request("/api/ledgers?source=import", {
    method: "POST",
    body: JSON.stringify({
      name,
      type: "customer",
      opening_balance: balance.toFixed(2),
      as_of_date: asOfDate,
    }),
  });
}

export async function createBareLedger({ name }) {
  return request("/api/ledgers?source=import", {
    method: "POST",
    body: JSON.stringify({ name, type: "customer" }),
  });
}

export async function postOpeningBalanceJournal({ date, narration, ledgerId, systemLedgerId, debit, credit }) {
  return request("/api/transactions?source=import", {
    method: "POST",
    body: JSON.stringify({
      type: "journal",
      date,
      narration,
      lines: [
        { ledger_id: ledgerId, debit: debit ? debit.toFixed(2) : undefined, credit: credit ? credit.toFixed(2) : undefined },
        { ledger_id: systemLedgerId, debit: credit ? credit.toFixed(2) : undefined, credit: debit ? debit.toFixed(2) : undefined },
      ],
    }),
  });
}
