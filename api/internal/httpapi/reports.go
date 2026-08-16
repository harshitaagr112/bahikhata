package httpapi

import (
	"math/big"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"tally-api/internal/accounting"
	"tally-api/internal/db"
)

func parseDateParam(r *http.Request, name string, fallback time.Time) (time.Time, error) {
	v := r.URL.Query().Get(name)
	if v == "" {
		return fallback, nil
	}
	return time.Parse("2006-01-02", v)
}

func pgtypeDate(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

type statementRow struct {
	EntryID       int64  `json:"entry_id"`
	TransactionID int64  `json:"transaction_id"`
	Date          string `json:"date"`
	Type          string `json:"type"`
	Narration     string `json:"narration"`
	Counterparty  string `json:"counterparty"`
	Debit         string `json:"debit"`
	Credit        string `json:"credit"`
	Balance       string `json:"balance"`
}

// ledgerStatement implements the Ledger Statement report (DECISIONS.md
// item 13): Date / Particular(narration) / Debit / Credit / running Balance
// for a ledger over a date range. This is the only place running balance is
// computed — the frontend must never recompute it.
func (s *Server) ledgerStatement(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}

	from, err := parseDateParam(r, "from", time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	ctx := r.Context()

	openingBalance, err := s.queries.LedgerBalanceBefore(ctx, db.LedgerBalanceBeforeParams{
		LedgerID: ledgerID,
		TxnDate:  pgtypeDate(from),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	rows, err := s.queries.LedgerStatement(ctx, db.LedgerStatementParams{
		LedgerID:  ledgerID,
		TxnDate:   pgtypeDate(from),
		TxnDate_2: pgtypeDate(to),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	running := accounting.ToRat(openingBalance)
	totalDebit := new(big.Rat)
	totalCredit := new(big.Rat)
	out := make([]statementRow, 0, len(rows))
	for _, row := range rows {
		running.Add(running, accounting.ToRat(row.Debit))
		running.Sub(running, accounting.ToRat(row.Credit))
		totalDebit.Add(totalDebit, accounting.ToRat(row.Debit))
		totalCredit.Add(totalCredit, accounting.ToRat(row.Credit))

		narration := ""
		if row.Narration != nil {
			narration = *row.Narration
		}
		out = append(out, statementRow{
			EntryID:       row.EntryID,
			TransactionID: row.TransactionID,
			Date:          row.TxnDate.Time.Format("2006-01-02"),
			Type:          string(row.Type),
			Narration:     narration,
			Counterparty:  string(row.Counterparty),
			Debit:         accounting.DecimalString(accounting.ToRat(row.Debit)),
			Credit:        accounting.DecimalString(accounting.ToRat(row.Credit)),
			Balance:       accounting.DecimalString(new(big.Rat).Set(running)),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"opening_balance": accounting.DecimalString(accounting.ToRat(openingBalance)),
		"closing_balance": accounting.DecimalString(running),
		"total_debit":     accounting.DecimalString(totalDebit),
		"total_credit":    accounting.DecimalString(totalCredit),
		"entries":         out,
	})
}

func (s *Server) ledgerBalance(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}

	row, err := s.queries.LedgerBalance(r.Context(), ledgerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	balance := new(big.Rat).Sub(accounting.ToRat(row.TotalDebit), accounting.ToRat(row.TotalCredit))

	writeJSON(w, http.StatusOK, map[string]any{
		"total_debit":  accounting.DecimalString(accounting.ToRat(row.TotalDebit)),
		"total_credit": accounting.DecimalString(accounting.ToRat(row.TotalCredit)),
		"balance":      accounting.DecimalString(balance),
	})
}

type outstandingEntry struct {
	LedgerID int64  `json:"ledger_id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Amount   string `json:"amount"`
}

// outstanding implements DECISIONS.md items 4/16: sign-based, scoped to
// Customer + Limit ledgers only. Debit balance -> receivable, credit
// balance -> payable.
func (s *Server) outstanding(w http.ResponseWriter, r *http.Request) {
	rows, err := s.queries.OutstandingLedgers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	receivables := make([]outstandingEntry, 0)
	payables := make([]outstandingEntry, 0)

	for _, row := range rows {
		entry := outstandingEntry{
			LedgerID: row.ID,
			Name:     row.Name,
			Type:     string(row.Type),
			Amount:   accounting.DecimalString(new(big.Rat).Abs(accounting.ToRat(row.Balance))),
		}
		if accounting.Sign(row.Balance) > 0 {
			receivables = append(receivables, entry)
		} else {
			payables = append(payables, entry)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"receivables": receivables,
		"payables":    payables,
	})
}

// daybook implements DECISIONS.md item 14's underlying feed: chronological
// transactions for a date range, newest first.
func (s *Server) daybook(w http.ResponseWriter, r *http.Request) {
	from, err := parseDateParam(r, "from", time.Now().AddDate(0, 0, -30))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	limit := int32(200)
	offset := int32(0)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = int32(n)
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = int32(n)
		}
	}

	ctx := r.Context()

	txns, err := s.queries.ListDaybook(ctx, db.ListDaybookParams{
		TxnDate:   pgtypeDate(from),
		TxnDate_2: pgtypeDate(to),
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type daybookEntry struct {
		LedgerID   int64  `json:"ledger_id"`
		LedgerName string `json:"ledger_name"`
		Debit      string `json:"debit"`
		Credit     string `json:"credit"`
	}
	type daybookRow struct {
		db.Transaction
		Entries []daybookEntry `json:"entries"`
	}

	out := make([]daybookRow, 0, len(txns))
	totalDebit := new(big.Rat)
	totalCredit := new(big.Rat)
	for _, txn := range txns {
		rows, err := s.queries.ListTransactionEntriesWithLedgerNames(ctx, txn.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		entries := make([]daybookEntry, 0, len(rows))
		for _, row := range rows {
			totalDebit.Add(totalDebit, accounting.ToRat(row.Debit))
			totalCredit.Add(totalCredit, accounting.ToRat(row.Credit))
			entries = append(entries, daybookEntry{
				LedgerID:   row.LedgerID,
				LedgerName: row.LedgerName,
				Debit:      accounting.DecimalString(accounting.ToRat(row.Debit)),
				Credit:     accounting.DecimalString(accounting.ToRat(row.Credit)),
			})
		}
		out = append(out, daybookRow{Transaction: txn, Entries: entries})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"transactions": out,
		"total_debit":  accounting.DecimalString(totalDebit),
		"total_credit": accounting.DecimalString(totalCredit),
	})
}
