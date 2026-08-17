# Decision Log — Family Insurance Agency App

Full record of every product/business/accounting/UX/technical decision made during
discovery, with the reasoning, so nothing has to be re-derived or re-asked. Read
`CLAUDE.md` first for the condensed operational summary; this file is the detailed
backing record.

## Business context

This app replaces a Tally + daybook + manual-ledger workflow for a small
family-run insurance agency (the user's father's business). Thousands of
customers. The agency:
- Receives premium payments from customers (Receipt).
- Pays insurance companies on customers' behalf (Payment).
- Receives commission income from insurance companies (Income).
- Gives customers discounts, and occasionally writes off bad debts (Discount).
- Has cash, multiple bank accounts, and "Limit" accounts per insurance company
  (LIC Limit, GIC Limit, etc.) representing a running account/relationship with
  that insurer.
- Uses a Journal for anything that doesn't fit the other four flows.

Primary user: the father. Not comfortable with complex/modern software or
double-entry concepts. UX must be simple, readable, low cognitive load, fast to
repeat throughout the day. He should never have to think in debit/credit terms
except in Journal, which is the deliberate "raw" escape hatch.

The goal is explicitly **not** a full ERP / Tally clone — it's "digital daybook +
ledger + outstanding management," scoped tightly to what this specific business
actually does.

## Product/business decisions (Stage 1 & 2)

1. **Transaction types (user-facing):** Payment, Receipt, Discount, Income,
   Journal. No separate Transfer type — bank-to-bank/cash-to-bank movements are
   entered via Payment, Receipt, or Journal (whichever the user finds natural);
   all become balanced debit/credit entries under the hood regardless.

2. **Ledger pickers:** Every picker (Paid From/To, Received From/In, Discount
   From/To, Income Account) is fully open — no ledger-type restrictions on
   either side of any transaction type. Journal remains the raw multi-line
   debit=credit entry screen (user enters Account/Debit/Credit rows directly;
   total debit must equal total credit).

3. **Discount transaction type:** One "Discount" transaction type:
   Discount From (a discount or bad-debt ledger, e.g. "LIC Discount", "Bad
   Debt") → Discount To (a customer ledger). Discount and Bad Debt use
   **identical posting mechanics** — they are just different named ledgers, not
   different accounting treatments (no separate reversal/recovery workflow was
   requested).

4. **Outstanding (Receivables/Payables):** Sign-based —
   **debit balance → Receivable**, **credit balance → Payable** — but scoped to
   **Customer and Limit-type ledgers only**. Cash/Bank/Income/Expense/Discount
   ledgers never appear in Outstanding, regardless of their balance sign.

5. **Mobile numbers:** Append-only history per ledger. A transaction entering a
   new/different number for a ledger never overwrites — it's appended to that
   ledger's number list. The UI always shows **all** numbers for a ledger
   (no "most recent only" collapsing).

6. **Ledger creation:** Every ledger type (Cash, Bank, Limit, Customer, Income,
   Expense, Discount, Other) can be created **inline**, mid-transaction, via a
   "+ Create New Ledger" popup — pick type, fill Name/Type/Mobile/C-O/Address,
   ledger is created and auto-selected back into the transaction, which
   continues where it was. No type is restricted to a dedicated-screen-only
   flow.

7. **Opening balances:** New ledgers get an **Opening Balance + As-of Date**
   field directly on the ledger-creation form. Internally this posts a
   transaction/entries against a hidden system ledger named **"Opening
   Balance"** (already seeded in the DB, `is_system = true`) to preserve
   double-entry — entirely invisible to the user.

8. **Ledger deletion:** A ledger can be deleted **only if it has zero
   transaction history** (no rows in `transaction_entries`). If it has any
   transactions, deletion is simply blocked — permanently, forever. **No
   deactivation feature** — this was explicitly ruled out; there is no
   "inactive but visible" ledger state for the general case (merge is the one
   exception — see below).

9. **Ledger merging:**
   - Merge sums both ledgers' opening balances and moves all transaction
     history (all `transaction_entries` rows) to point at the destination
     ledger.
   - The source ledger becomes "merged" (its `merged_into_id` is set) — it is
     no longer selectable in any picker, but its history/audit trail remains
     intact and inspectable.
   - **Chained merges are allowed** — a ledger that already absorbed one merge
     can later itself be merged into a third ledger. `ResolveLedgerMergeTarget`
     (recursive CTE) walks the chain to the final active ledger.
   - **No undo/unmerge feature.** Merge is permanent. It must be protected by a
     strong confirmation dialog ("This cannot be undone") before executing.
   - This was explicitly flagged as a rare edge case (both ledgers having
     non-zero opening balances) and the user accepted the simple
     sum-and-merge behavior rather than blocking or requiring manual
     resolution first.

10. **Transaction editing:** Edits overwrite the transaction in place. The
    audit log stores the full before/after snapshot (JSONB). The daybook /
    ledger statement UI shows **no visible "(edited)" marker** — an edit is
    only discoverable by deliberately checking the audit log. Requires a
    confirmation dialog before saving an edit ("Are you sure you want to make
    this change?").

11. **Transaction deletion:** Requires a confirmation dialog that explicitly
    warns it affects ledger balances. Deletion is audited (before-snapshot
    captured). Cascades to delete the transaction's entries
    (`ON DELETE CASCADE` on `transaction_entries.transaction_id`).

12. **Duplicate-submission protection:** **None.** Explicitly decided against —
    no detection/warning for near-identical transactions entered twice. Relies
    on the user noticing via the daybook and using edit/delete.

13. **Reports (MVP):** Only **Ledger Statement**, **Daybook**, and
    **Outstanding**. No rolled-up Income/Expense summary reports — an
    individual ledger's own statement (any date range) covers that need.
    Excel export of these three is wanted eventually; format not yet
    designed.

14. **Dashboard:** Shows **totals only** for Receivables/Payables (no inline
    top-N list of biggest debtors/creditors) — full breakdown lives only in
    the dedicated Outstanding section. Also shows Current Cash, Bank
    balances, and Today's transactions. Deliberately not analytics-heavy.

15. **Terminology:** "Receipt", "Payment", "Limit" all confirmed as-is —
    matches the father's existing vocabulary from the Tally/daybook era. Do
    not substitute alternate terms in the UI.

16. **Company scope:** Single-company system. **No "Company" concept modeled
    in the data at all** — not even as a lightweight future-proofing
    boundary. Explicitly decided against multi-tenancy of any kind for now.

17. **Auth:** Single shared username/password login for the whole agency
    (matches "each company currently has one account"). Session cookie, not
    JWT. No per-user attribution needed in the audit log — this was
    explicitly noted as unnecessary given the single-account model.

18. **Tally migration:** Deferred entirely until the actual Tally XLS export
    is provided by the user. **Do not invent or assume the Tally export
    format.** Once provided, must inspect it before designing any importer,
    and determine: what data exists, how accounts map to ledgers, whether
    historical transactions are reconstructable or only opening/outstanding
    balances are importable, and how duplicate ledgers in Tally should be
    handled (likely via the same merge feature, post-import).

19. **Historical/opening-balance postings must never touch a real operational
    ledger on both sides — the system "Opening Balance" ledger is the only
    permitted counterparty.** E.g. if a customer's historical debt is
    conceptually "HDFC Bank paid on their behalf," do **not** post that as a
    real Payment between HDFC Bank and the customer — HDFC Bank's own
    history isn't being fully imported, so a one-off fabricated entry would
    corrupt HDFC's balance relative to reality/Tally. Instead:
    - **Single net number** (e.g. "customer owes ₹8,000 as of Jan 1"): use
      the ledger-creation "Opening Balance" field — already posts correctly
      against the system ledger only.
    - **Breakdown of several historical items**: post each one as its own
      **Journal** entry, picking the target ledger on one line and the
      system "Opening Balance" ledger on the other, with the real
      historical date and a narration describing what it represents. Never
      a Payment/Receipt/Discount/Income between two non-system ledgers for
      historical data.
    - **Reconciliation checkpoint (sharpened by item 20's Tally import
      design)**: since every ledger's opening position — every customer's
      imported history AND every Cash/Bank/Limit account's own lump-sum
      opening balance — routes through this one system ledger, its net
      balance should land at **exactly ₹0.00** once the full migration is
      done. It's a pure clearing account by construction; if it's not
      zero, something was missed or double-counted. Check at `/ledgers/1`
      or by searching "Opening Balance".
    - This rule applies equally to manual entry today and to the eventual
      Tally XLS import script — the importer must never invent a
      transaction between two real ledgers to represent historical/opening
      data.
    - **Enforced structurally, not just by convention**: the system ledger
      is excluded from the Payment/Receipt/Discount/Income ledger pickers
      in the UI (`LedgerPicker`'s `excludeSystem` prop) and rejected by the
      API for those four transaction types (`assertNoSystemLedgerOutsideJournal`
      in `internal/httpapi/transaction.go`) — it's only reachable via
      Journal. Ledger merge also blocks the system ledger as a merge
      *target* (merging a real ledger into it would equally violate this
      invariant), on top of the existing block on it being a merge
      *source*.

20. **Tally XLS import — confirmed file format and import architecture**
    (as of the first real sample file, `gt.xls`, provided by the user):
    - **What the source files are**: one `.xls` per *outstanding* ledger —
      i.e. a ledger that currently has a non-zero balance in Tally, not a
      full company export. The user will provide a folder of ~150 such
      files (all Customer-type per item 2 of this decision), in batches —
      3 files first for a trial run, then the rest once the import logic
      is verified against those 3.
    - **File shape**: single sheet, header row `Ledger: <name> | ... |
      <date range>`, then a column header row (`Miti | Date | Particulars
      | Particulars | Vch Type | Debit | Credit | Closing Balance` — Miti
      is a Nepali-calendar column, always blank, ignore it). Each real
      transaction is one row: Date, "To"/"By" (Tally's debit/credit
      display convention — redundant with the Debit/Credit columns
      themselves, not needed for import logic), counterparty ledger name,
      voucher type, amount in Debit or Credit (never both), running
      balance with a Dr/Cr suffix (matches our own `MoneyDrCr`
      convention exactly). **Narration has no dedicated column** — when
      present, it's a separate row immediately below the transaction row,
      with free text sitting in the Date column's position and every
      other column blank. Not every transaction has one. A trailing
      3-row footer (grand totals + a "By Closing Balance" plug to make
      the printed T-account balance) is cosmetic Tally print output, not
      source data — exclude it from import.
    - **No master data in these files**: no address, C/O, or mobile
      number anywhere — only the ledger name and its transaction history.
      If those fields matter for a given customer, they come from
      somewhere else (manual entry), not this import.
    - **Opening balance**: Tally omits the "Opening Balance" line
      entirely when it's zero — if the first row is a normal transaction
      rather than one labeled Opening Balance, the ledger's balance was
      ₹0.00 immediately before that date.
    - **The counterparty problem and its resolution**: these per-customer
      files reference real operational ledgers (Cash, and several
      Bank-type "main accounts" like "HDFC C/A AJAY" — confirmed
      Bank-type, not sub-accounts of a single HDFC ledger) as
      counterparties. Those main accounts get their own opening balance
      seeded independently as a single lump sum (Tally's true final
      balance for that account) — their detailed histories are not being
      imported. So the importer must **never** post an imported
      transaction against the real counterparty named in the file — doing
      so would double-count against that account's lump-sum opening
      balance (exactly the corruption item 19 exists to prevent, and the
      reason a "hide this entry from the counterparty's own ledger" flag
      was considered and rejected as unnecessary complexity — it would
      reach the identical end state as just not creating that side of the
      entry in the first place). Confirmed resolution: **every imported
      row becomes a Journal transaction between the customer ledger and
      the system Opening Balance ledger, dated at the row's real
      historical date** — never the literal counterparty. The real
      counterparty name and the narration text (if any) are preserved by
      folding them into the new transaction's narration field (e.g. `"Via
      HDFC C/A AJAY — ABDUL WADOOD GCV ICICI SE"`), so nothing is silently
      lost, it just moves from a structured ledger link to free text,
      which is the correct fidelity level for historical/pre-cutover data.
    - **Audit**: imported transactions/ledgers should use the `imported`
      audit action (already exists in the `audit_action` enum), not
      `created` — distinguishes migration-sourced records from normal use
      going forward.
    - **Not yet decided / still open**: the actual importer script hasn't
      been written — waiting on the first 3 test files before building
      it, per the user's stated plan.

## Explicit non-requirements (deliberately out of scope for MVP)

- Ledger deactivation (general case — only merge produces an inactive state).
- Transaction duplicate-submission detection.
- Dashboard top-N receivables/payables list.
- Income/Expense rolled-up summary reports.
- Multi-company / multi-tenant data model.
- Multi-user accounts / RBAC / per-user audit attribution.
- Discount/bad-debt reversal or recovery workflow.
- WhatsApp API integration (printable/PDF export is the extent of this — user
  shares manually).

## Technical decisions (Stage 3)

- **Frontend:** Next.js (App Router), TypeScript, Tailwind.
- **Backend:** Go, chi router.
- **Database:** PostgreSQL, hosted on **Neon** (remote dev DB, not AWS for
  now). Connection string lives in `api/.env` (gitignored), see
  `CLAUDE.md` for how to obtain/re-set it if lost.
- **DB access layer:** `sqlc` (generates typed Go from hand-written SQL in
  `db/queries/*.sql`) + `pgx/v5` as the driver. Chosen explicitly over GORM
  for correctness/visibility on financial queries — every query that touches
  money is plain, readable SQL, not ORM-generated magic.
- **Migrations:** `golang-migrate`, SQL files in `db/migrations/`.
- **Auth:** username/password, session cookie — implemented.
- **PDF generation:** superseded — originally Option B (reuse the
  React-rendered report page, export via a serverless Puppeteer route in
  Next.js), but switched to generating PDFs natively in Go (`internal/pdf`,
  `gofpdf`) once Puppeteer's deployment overhead (headless Chromium's
  memory footprint, no clean fit for serverless/edge hosts) became a
  concrete blocker while scoping deployment. The three reports are plain
  tables, so a lower-fidelity native-Go render was an acceptable tradeoff
  for a much simpler, lighter deploy — see CLAUDE.md's PDF export section
  for the implementation.
- **Testing:** Go's built-in `testing` package for backend, especially the
  accounting engine (balance math) and Journal debit=credit validation.
  Frontend testing deferred until UI stabilizes — no framework chosen yet.
- **Repo structure:** Monorepo — `/web` (Next.js), `/api` (Go), `/db`
  (migrations + sqlc queries + sqlc.yaml), `/docs` (this file + CLAUDE.md).
- **Deployment:** Local-first. Build and test on localhost against the
  remote Neon DB. No hosting/CI/CD decided yet — explicitly deferred by the
  user ("me but devops and everything later... most basic deployment
  cycle"). No AWS.
- **Git:** The user explicitly asked **not** to run `git init` yet (as of the
  last session). Do not initialize git without being asked again — check
  before assuming it's wanted.
