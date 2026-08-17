# Tally — Family Insurance Agency App

A simple ledger/daybook/outstanding-management web app replacing a Tally +
manual-ledger workflow for a small family-run insurance agency. **Not** a full
ERP — deliberately scoped to what this specific business actually does.
Primary user is non-technical (comfortable with paper daybooks, not with
software abstractions), so UX simplicity is a hard requirement everywhere.

**Product/brand name is "Khata"** (Hindi for ledger/account book — what this
app replaces) — this is what the user sees: page title, sidebar wordmark,
login screen. "Tally" in this file's title and throughout the docs refers to
the *old software* being migrated away from (and the repo folder name), never
the product itself — don't reintroduce "Tally" as user-facing text. Accent
color is **blue** (`--accent` in `globals.css`, `#2563eb`) — was indigo, then
briefly teal, now blue; don't reintroduce either. If you add a new
component, pull the color from the CSS vars (`var(--accent)`,
`var(--accent-soft)`, `var(--accent-dark)`, `var(--accent-darker)`) or use
Tailwind's `blue-*` scale, never hardcode `indigo-*`/`purple-*`/`teal-*`.
Logo mark is `BookOpenCheck` (lucide-react) in a blue-gradient rounded
badge — used identically in `Nav.tsx` (sidebar) and `login/page.tsx`; keep
both in sync if the mark ever changes.

**Read `docs/DECISIONS.md` before making any product, accounting, or UX
decision.** It contains the full reasoning behind every rule below — this file
only has the condensed, operational version. If a situation comes up that
isn't covered in either file, treat it like the original discovery process
required: **stop and ask the user rather than assuming**, especially for
anything touching accounting semantics, transaction editing/deletion, ledger
merging, or reports.

## Tech stack (all decided — do not change without asking)

- Frontend: Next.js (App Router), TypeScript, Tailwind — not yet scaffolded.
- Backend: Go + chi router — scaffolded and working.
- Database: PostgreSQL on **Neon** (remote dev DB). Connection string in
  `api/.env` as `DATABASE_URL` (gitignored, never commit it, never print it
  in full in chat/logs beyond what's needed to debug).
- DB access: `sqlc` (typed Go generated from `db/queries/*.sql`) + `pgx/v5`.
  Never hand-write query structs — edit the `.sql` files and re-run
  `sqlc generate` from `/db`.
- Migrations: `golang-migrate`, files in `db/migrations/`.
- Auth: single shared username/password login, session cookie.
- PDF export: generated natively in Go (`internal/pdf`, gofpdf) — no
  headless browser, no Next.js export routes.
- Testing: Go built-in `testing`, focused on the accounting engine. No
  frontend test framework chosen yet.
- Repo: monorepo, no git initialized yet (user asked to hold off — check with
  user before running `git init`).
- Deployment: local-only for now, against remote Neon DB. No hosting/CI/CD
  decided. No AWS.

## Repo layout

```
api/                    Go backend
  main.go               entrypoint: loads config, connects pgx pool, starts chi server
  internal/config/      env loading (DATABASE_URL, PORT) via godotenv
  internal/db/          sqlc-GENERATED code — do not hand-edit, regenerate instead
  internal/httpapi/     HTTP handlers + chi router (Server type)
  .env                  DATABASE_URL + PORT (gitignored, has real Neon credentials)
db/
  migrations/           golang-migrate SQL files (0001_init up/down = full schema)
  queries/              hand-written SQL that sqlc turns into api/internal/db
  sqlc.yaml             sqlc config (schema path, queries path, output path)
web/                    Next.js frontend — NOT YET SCAFFOLDED
docs/
  DECISIONS.md          full decision log with reasoning (read this)
  (this file)
```

## Common commands

```bash
# Run a migration (from repo root, with DATABASE_URL loaded)
set -a && source api/.env && set +a
migrate -path db/migrations -database "$DATABASE_URL" up
migrate -path db/migrations -database "$DATABASE_URL" down 1   # rollback one

# Regenerate sqlc code after editing db/queries/*.sql or the schema
cd db && sqlc generate

# Run the backend locally
cd api && go run .            # listens on :8080, loads api/.env automatically

# Build/vet check
cd api && go build ./... && go vet ./...
```

New migration files must be named `NNNN_description.up.sql` /
`NNNN_description.down.sql`, incrementing `NNNN`.

## Current build state (as of last session)

**Done:**
- Full DB schema live on Neon: `ledgers`, `ledger_mobile_numbers`,
  `transactions`, `transaction_entries`, `audit_log`.
- DB-level deferred constraint trigger enforces every transaction's entries
  sum debit = sum credit (`check_transaction_balanced`).
- System "Opening Balance" ledger seeded (`is_system = true`) for opening
  balance postings.
- sqlc query layer generated for: ledger CRUD, ledger search (trigram search
  across name/address/C-O/mobile numbers), ledger merge + merge-chain
  resolution, mobile number history, transaction CRUD + entries, daybook
  listing, ledger statement (+ `LedgerBalanceBefore` for opening balance),
  ledger balance, outstanding ledgers query, `MoveLedgerEntries` (used by
  merge).
- `internal/accounting` package — the actual accounting engine, pure
  functions, unit tested (`go test ./internal/accounting/...`, 11 tests):
  - `PaymentLegs` / `ReceiptLegs` / `DiscountLegs` / `IncomeLegs` — encode
    the fixed debit/credit posting pattern per transaction type (see
    DECISIONS.md items 1-3, and the doc comment atop `legs.go` for the
    exact table).
  - `ValidateJournalLegs` — Go-side friendly pre-check (line count, no
    line with both/neither debit&credit); the DB trigger remains the final
    authority on debit==credit.
  - `ParseAmount` / `ToRat` / `DecimalString` / `Sign` — exact decimal
    handling via `big.Rat`, never float64, so running balances in
    statements can't drift.
- Go server (chi), fully wired to Neon, all routes verified end-to-end with
  curl (create/search/merge ledgers; create/edit/delete Payment, Receipt,
  Journal; statement/balance/outstanding/daybook):
  - `GET /health`
  - `POST /api/ledgers`, `GET /api/ledgers?q=`
  - `GET|PUT|DELETE /api/ledgers/{id}`
  - `GET /api/ledgers/{id}/mobile-numbers`
  - `GET /api/ledgers/{id}/statement?from=&to=` (opening balance + running
    balance per row, exact decimal arithmetic)
  - `GET /api/ledgers/{id}/balance`
  - `POST /api/ledgers/{id}/merge` (moves all `transaction_entries` to the
    target, marks source `merged_into_id`, audited, no undo)
  - `POST /api/transactions` (dispatches by `type`: payment/receipt/
    discount/income/journal — see `transaction.go` for the request shape
    per type)
  - `GET|PUT|DELETE /api/transactions/{id}` (edit overwrites in place +
    audits before/after snapshot with no "(edited)" UI marker; delete
    audits before-snapshot; both wrapped in a DB transaction so the
    balance trigger fires atomically)
  - `GET /api/daybook?from=&to=&limit=&offset=`
  - `GET /api/outstanding` (sign-based, Customer+Limit only)
  - Every mutating ledger/transaction action writes to `audit_log` inside
    the same DB transaction as the mutation.
  - Note: there's live test data in the Neon dev DB from this smoke-testing
    session (a "Raj Kumar" customer, "HDFC Bank", "LIC Limit", "Cash",
    "Office Rent" ledgers and a few transactions/one merge). Fine to leave,
    or ask the user before truncating if a clean slate is wanted before
    frontend work starts.

- Next.js frontend scaffolded in `/web` (App Router, TypeScript, Tailwind).
  `next.config.ts` rewrites `/api/*` → the Go backend (`API_URL` env var,
  defaults to `http://localhost:8080`) so the browser only ever talks to
  one origin — no CORS handling needed, don't add any.
  - `src/lib/types.ts` / `src/lib/api.ts` — typed fetch wrappers for every
    backend endpoint. Money crosses the wire as decimal strings; dates as
    `YYYY-MM-DD`. Add new backend endpoints here, don't fetch ad hoc from
    components.
  - `src/components/ui.tsx` — shared primitives (Button, TextInput, Select,
    Field, Card, Money, ErrorBanner). Deliberately large touch targets /
    high contrast for the non-technical, older primary user — keep new UI
    consistent with these rather than one-off Tailwind classes.
  - `src/components/LedgerPicker.tsx` — the core reusable piece: search +
    debounce + "+ Create New Ledger" popup (all 8 ledger types, including
    Opening Balance + As-of Date). Used by every transaction form.
  - `src/components/SimpleTransactionForm.tsx` — one shared form for
    Payment/Receipt/Discount/Income (`SIMPLE_TYPE_CONFIG` maps each type to
    its two ledger-picker labels + which side is debit/credit + which side
    gets the optional mobile number — mirrors `mobileLedgerID` on the Go
    side, keep both in sync if this ever changes).
  - `src/components/JournalForm.tsx` — dynamic add/remove lines, live
    debit/credit balance indicator, client-side pre-check mirroring
    `accounting.ValidateJournalLegs` (server is still final authority).
  - Pages: `/` (dashboard, totals only per decision #14), `/daybook`
    (grouped by date), `/ledgers` + `/ledgers/[id]` (statement with running
    balance, edit, merge with strong confirm, delete), `/outstanding`,
    `/transactions/new/[type]`, `/transactions/[id]/edit` (also has the
    Delete action).
  - **Signed ledger balances are never shown with a minus sign** — use
    `MoneyDrCr` (`components/ui.tsx`), which shows the unsigned amount plus
    "Dr" (positive/debit balance) or "Cr" (negative/credit balance),
    matching Tally's own convention. Only applies to genuine signed
    balances (ledger statement's opening/running/closing balance, a
    ledger's own balance on the dashboard) — never to plain amounts that
    are always non-negative (debit/credit columns, transaction amounts,
    Outstanding's receivables/payables, which are already unsigned and
    split by sign server-side). If a new view shows a raw ledger balance,
    use `MoneyDrCr`, not `Money`.
  - **Transaction type can be switched mid-creation** via
    `TransactionTypeSwitcher` (a pill row rendered above the form on
    `/transactions/new/[type]`) — for when the wrong type was picked from
    the sidebar dropdown. Switching re-routes to the other type's URL and
    remounts the form (`key={type}`), which **intentionally resets all
    entered fields** rather than trying to map them across types — e.g.
    Journal has no single "amount" field, so there's no sensible mapping
    from a half-filled Payment. Only offered on create, not on
    `/transactions/[id]/edit` (an existing transaction's type is fixed).
  - **Every transaction row, anywhere it's shown, must link to
    `/transactions/[id]/edit`** — this is a standing UX requirement, not a
    one-off. Currently wired via `TransactionRow` (Daybook, Dashboard) and
    a click handler on each `<tr>` in the ledger statement table
    (`/ledgers/[id]/page.tsx`). If a new view lists transactions, wire this
    in from the start rather than adding it later.
  - **Every transaction list, anywhere in the app, must show the
    cross-entry (counterparty) ledger, not just narration** — e.g. viewing
    Cash's statement must show "Raj Kumar" per row, and viewing Raj
    Kumar's must show "Cash," for the same transaction. Daybook/Dashboard
    already did this via `TransactionRow`'s "A → B" flow description; the
    ledger statement (`/ledgers/[id]`) was the gap, closed by adding a
    `counterparty` column to `LedgerStatement`
    (`db/queries/transactions.sql` — a correlated `string_agg` over the
    transaction's other entries, excluding the ledger being viewed; comma-
    joins if a Journal has more than one other leg). The statement
    table's "Particular" column now shows the counterparty name (bold)
    with narration as secondary text, matching how Tally itself labels
    this column. If a new transaction-list view is added anywhere, it
    must show the counterparty too — this is a standing requirement.
  - **Ledger search results must always show enough context to
    disambiguate similarly-named ledgers** — type, C/O, address, and full
    mobile-number history, not just the name. `SearchLedgers`
    (`db/queries/ledgers.sql`) joins in a `mobile_numbers` aggregate
    (comma-separated, most recent first) via `ledgerSearchResult` in
    `internal/httpapi/ledger.go`; the frontend `Ledger` type has an
    optional `mobile_numbers` field only populated on search results (not
    on `GET /ledgers/{id}`, which has its own dedicated mobile-numbers
    endpoint). `LedgerPicker`'s dropdown and the standalone `/ledgers`
    search page both render this. Keep this in sync if either changes.
  - `ConfirmDialog` used for: transaction edit-save, transaction delete,
    ledger delete, ledger merge (danger-styled, explicitly says "cannot be
    undone").
- **Backend response convention, easy to violate accidentally**: any
  handler returning a slice as the top-level JSON body must never return a
  nil Go slice — `writeJSON` (`internal/httpapi/response.go`) normalizes
  nil slices to `[]` automatically via reflection, so prefer routing new
  list responses through `writeJSON` as-is rather than pre-checking nil
  yourself. This was a real bug (crashed `LedgerPicker` and the ledger
  detail page's mobile-number list on real empty-result data) — don't
  reintroduce it by bypassing `writeJSON`.
- Both dev servers verified running together end-to-end (backend on
  :8080, frontend on :3000, proxy working, empty-list fix confirmed
  through the proxy). No browser automation tool was available this
  session, so **the actual UI has not been visually/interactively
  verified in a real browser yet** — curl only confirms pages return 200
  and the API responses are shaped correctly, not that the React
  components render/behave correctly client-side. Treat that as
  outstanding verification, not done.

**Not yet done (suggested build order):**
1. Manually click through the frontend in a real browser (dashboard →
   create a ledger inline → post a Payment/Receipt/Journal → check
   daybook/statement/outstanding update → edit → delete → merge). No
   automated way to do this was available this session.
2. ~~Auth~~ — **done.** Single shared username/password, session cookie —
   **explicitly not JWT** (docs/DECISIONS.md item 17: one company, one
   account, nothing JWT is actually good for applies here).
   - `sessions` table (migration `0002_sessions`) — DB-backed, not
     in-memory, so sessions survive a backend restart. 30-day TTL.
   - `POST /api/login` (bcrypt-compares against `AUTH_USERNAME` /
     `AUTH_PASSWORD_HASH` in `api/.env`), `POST /api/logout`, `GET
     /api/me` — all three are the only unauthenticated routes; every
     other `/api/*` route requires the session cookie
     (`requireAuth` middleware in `internal/httpapi/server.go`).
   - Frontend: `/login` page, `AuthGate` (`src/components/AuthGate.tsx`,
     wraps the root layout) redirects to `/login` if `/api/me` says
     unauthenticated — checked once per app load, not per-navigation.
     Logout button in the sidebar.
   - **`.env` gotcha, don't get bitten by this again**: `godotenv`
     expands `$VAR`-style sequences even in unquoted values — a bcrypt
     hash (`$2a$10$...`) gets silently mangled unless wrapped in single
     quotes in `api/.env`. If you ever regenerate the hash, quote it:
     `AUTH_PASSWORD_HASH='$2a$10$...'`.
   - **Current `api/.env` has a temporary dev credential** —
     `admin` / `changeme123` — clearly flagged in the file as
     change-before-real-use. Same credential must be exported as
     `TALLY_AUTH_USERNAME` / `TALLY_AUTH_PASSWORD` for the Tally importer
     (`scripts/import-tally/`) to log in — it now needs a session too,
     same as any other client.
3. ~~Printable/PDF report export~~ — **done, generated natively in Go**
   (superseded an earlier Puppeteer/Next.js approach — no `/print/*` or
   `/export/*` Next.js routes anymore, no `puppeteer` dependency; the
   frontend's `ConditionalNav`/`ConditionalMain` wrappers were removed too
   since there's no headless-render page to hide the sidebar for):
   - `internal/pdf` (Go package) builds the PDF bytes directly —
     `pdf.LedgerStatement`, `pdf.Daybook`, `pdf.Outstanding`.
   - Endpoints: `GET /api/ledgers/{id}/statement/pdf`,
     `GET /api/daybook/pdf`, `GET /api/outstanding/pdf` — same
     auth-gated group as every other `/api/*` route.
   - `internal/httpapi/pdf.go` reuses `buildLedgerStatement` /
     `buildDaybook` / `buildOutstanding` (shared with the JSON endpoints,
     so the PDF can never disagree with the on-screen numbers) and formats
     signed balances via its own `drCr` helper (mirrors the frontend's
     `MoneyDrCr` — unsigned amount + "Dr"/"Cr", never a bare minus sign).
   - **Total Debit/Credit on reports** (bundled into this same work):
     `LedgerStatement` and `ListDaybook` (backend) return
     `total_debit`/`total_credit` computed server-side with `big.Rat`
     (same exact-decimal approach as running balance — never computed
     client-side). `getDaybook`'s return shape is
     `{ transactions, total_debit, total_credit }`, not a bare array.
4. Tally import — **importer built and verified against real data, not
   yet committed for real.** Lives at `scripts/import-tally/` (standalone
   Node package, `npm install` once, `node run.mjs` for a dry run,
   `node run.mjs --commit` to actually import — talks to the Go backend
   over HTTP at `TALLY_API_URL`, default `http://localhost:8080`).
   - Real files now in the repo: `debt.xls` (root) — the Tally "Sundry
     Debtors" master list, one row per outstanding customer, 160 real
     accounts as of the last check. `outstanding/*.xls` — detailed
     per-ledger histories (currently just `gt.xls`); the user plans to
     batch more in over time.
   - `parse.mjs`: `parseMasterList` (debt.xls shape) and
     `parseDetailedLedger` (gt.xls shape, per docs/DECISIONS.md item 20's
     row-detection rules) + `verifyRunningBalance` (replays a detailed
     file's entries and cross-checks against Tally's own printed running
     balance — catches parser bugs immediately). One real bug already
     caught and fixed this way: a header row (date-range text) was
     misparsed as an account named "Particulars" because bare
     `parseFloat` partially parses non-numeric strings — fixed with a
     strict `AMOUNT_RE` regex gate before parsing any amount.
   - `reconcile.mjs`: two-tier logic — accounts with a matching detailed
     file get imported from that file's rows (never also a lump sum);
     everything else gets a single lump-sum Opening Balance entry from
     the master list. Flags (never auto-resolves) unmatched detailed
     files and any detailed-file-vs-master-list balance discrepancy.
   - `run.mjs`: defaults to a dry-run report (no API calls); only calls
     the API with `--commit`, and refuses to commit while anything is
     flagged. Commit is idempotent per account (checks
     `findLedgerByExactName` first, skips if it already exists) so
     re-running after adding more files to `outstanding/` is safe.
     Cutover date for lump-sum accounts = the date the script is run
     (confirmed with the user: "cutover date will be the date of
     migration").
   - **Backend change that went with this**: `POST /api/ledgers` and
     `POST /api/transactions` now accept `?source=import`, which logs the
     audit action as `imported` instead of `created`
     (`auditActionFor` in `internal/httpapi/transaction.go`) — only the
     importer should ever pass this.
   - **Not yet done**: an actual `--commit` run against the real data.
     Dry run is clean (zero discrepancies) but this is real financial
     data going into the live Neon DB — confirm with the user before
     running `--commit` for real, even though the dry run looks ready.
     All pre-work (parsing, reconciliation, backend support, idempotency,
     smoke-testing the commit path against throwaway data) is done — this
     step is purely "run it and check the output," nothing left to build:
     ```bash
     # 1. Backend must be running (it owns the DB writes):
     cd api && go run .                     # separate terminal, leave running

     # 2. One-time only, if node_modules isn't there yet:
     cd scripts/import-tally && npm install

     # 3. Dry run — no API calls, safe to re-run any time, re-check after
     #    adding more files to outstanding/:
     cd scripts/import-tally && node run.mjs

     # 4. Only once the dry run shows "No issues found":
     cd scripts/import-tally && node run.mjs --commit
     ```
     After committing, sanity-check a few ledgers' statements
     (`GET /api/ledgers/{id}/statement`) against their source `.xls`, and
     confirm the Opening Balance ledger's own balance still makes sense
     given what's actually been imported so far (it won't be exactly
     ₹0.00 until *every* outstanding account — not just these — has been
     imported; see item 19's reconciliation checkpoint).
5. **Deferred by explicit user request ("leave it for now")**: make
   counterparty ledger names clickable (→ that ledger's own page) in the
   ledger statement table and in `TransactionRow` (Daybook/Dashboard).
   Currently the whole transaction row is one click target (→ the
   transaction); this would need the ledger statement's `counterparty`
   field changed from a joined string to structured `{ledger_id, name}[]`
   data (backend change), plus restructuring both views so a ledger name
   is its own link without breaking the row's existing "go to transaction"
   click. Full plan already discussed with the user — see conversation,
   not re-derived here in detail. Do not start this until asked.

## Request/response conventions established in the code (follow these)

- Money amounts cross the JSON boundary as **decimal strings** (e.g.
  `"amount": "50000.00"`), never JSON numbers — avoids float precision loss.
  Parse with `accounting.ParseAmount`. Responses that echo computed
  amounts (statement rows, balances, outstanding) are also decimal strings,
  produced via `accounting.DecimalString(accounting.ToRat(n))`.
- Dates cross the JSON boundary as `"YYYY-MM-DD"` strings. See
  `parseTxnDate` / `parseDateParam` in `internal/httpapi`.
- `POST /api/transactions` request shape has one envelope
  (`createTransactionRequest` in `transaction.go`) with a `type` field and
  the relevant fields per type populated (`paid_from_id`/`paid_to_id` for
  payment, `received_from_id`/`received_in_id` for receipt/income,
  `discount_from_id`/`discount_to_id` for discount, `lines` for journal).
  Reuse this pattern for any new transaction-adjacent endpoint rather than
  inventing a new shape.
- The optional `mobile` field on a transaction is appended (never
  overwrites) to whichever ledger is the "person" side per type — see
  `mobileLedgerID` in `transaction.go` for the exact mapping (Income and
  Journal don't get one; this was a pragmatic default, not an explicit
  product decision — revisit if real usage shows otherwise).

## Hard rules carried over from discovery (do not violate silently)

- Never let the frontend compute balances/debit/credit/outstanding — the Go
  `accounting` logic is the single source of truth every report reads from.
- Journal is the only transaction type where the user manually enters
  debit/credit; all others (Payment/Receipt/Discount/Income) take a single
  amount and the backend derives both sides.
- No ledger-type restrictions on any transaction-form picker (fully open, see
  DECISIONS.md #2).
- No deactivation feature for ledgers in general; deletion is blocked outright
  if the ledger has any transaction history, permanently.
- Ledger merge has no undo — always require strong confirmation before
  executing it.
- Transaction edits are audited (before/after snapshot) but never shown with
  an "(edited)" marker in the normal UI.
- Outstanding only ever includes Customer + Limit-type ledgers.
- **Opening-balance/historical postings must always use the system "Opening
  Balance" ledger as their one counterparty — never a real operational
  ledger on both sides** (e.g. never fabricate "HDFC Bank paid Raj Kumar"
  to represent history; either use the Opening Balance field for a net
  number, or a Journal entry per historical line item against the system
  ledger). This is enforced structurally, not just by convention: the
  system ledger is hidden from Payment/Receipt/Discount/Income pickers and
  rejected server-side for those types (Journal-only), and ledger merge
  blocks it as both source and target. Applies to the eventual Tally
  importer too — see DECISIONS.md item 19.
