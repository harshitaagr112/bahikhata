# Tally — Family Insurance Agency App

A simple ledger/daybook/outstanding-management web app replacing a Tally +
manual-ledger workflow for a small family-run insurance agency. **Not** a full
ERP — deliberately scoped to what this specific business actually does.
Primary user is non-technical (comfortable with paper daybooks, not with
software abstractions), so UX simplicity is a hard requirement everywhere.

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
- Auth: single shared username/password login, session cookie. Not yet built.
- PDF export: reuse on-screen React report components, export via serverless
  Puppeteer route in Next.js (not a separate Go template). Not yet built.
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
2. Auth: login endpoint, session cookie middleware. Nothing is
   authenticated yet — every endpoint above is currently open.
3. Printable/PDF report export (decided approach: reuse the on-screen
   statement/report page, export via a serverless Puppeteer route — not
   started).
4. Tally import — **blocked until the user provides the actual XLS
   export**. Do not design or guess the format before then.
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
