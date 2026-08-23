package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"tally-api/internal/accounting"
	"tally-api/internal/db"
)

type openingBalanceInput struct {
	amount pgtype.Numeric
	date   pgtype.Date
}

type createLedgerRequest struct {
	Name           string `json:"name"`
	Type           string `json:"type"`
	CO             string `json:"c_o"`
	Address        string `json:"address"`
	OpeningBalance string `json:"opening_balance"`
	AsOfDate       string `json:"as_of_date"`
}

// createLedger implements DECISIONS.md item 7: Opening Balance + As-of Date
// live directly on the ledger-creation form. Behind the scenes this posts a
// hidden journal entry against the system "Opening Balance" ledger — the
// user never sees debit/credit for this.
func (s *Server) createLedger(w http.ResponseWriter, r *http.Request) {
	var req createLedgerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" {
		writeError(w, http.StatusBadRequest, "name and type are required")
		return
	}

	var openingBalance *openingBalanceInput
	if req.OpeningBalance != "" {
		amt, err := accounting.ParseSignedAmount(req.OpeningBalance)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		asOfDate := req.AsOfDate
		if asOfDate == "" {
			writeError(w, http.StatusBadRequest, "as_of_date is required when opening_balance is set")
			return
		}
		txnDate, err := parseTxnDate(asOfDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		openingBalance = &openingBalanceInput{amount: amt, date: txnDate}
	}

	params := db.CreateLedgerParams{
		Name: req.Name,
		Type: db.LedgerType(req.Type),
	}
	if req.CO != "" {
		params.CO = &req.CO
	}
	if req.Address != "" {
		params.Address = &req.Address
	}

	ctx := r.Context()
	action := auditActionFor(r)

	if openingBalance == nil {
		ledger, err := s.queries.CreateLedger(ctx, params)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, ledger)
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	ledger, err := qtx.CreateLedger(ctx, params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	systemLedger, err := qtx.GetOpeningBalanceLedger(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "opening balance system ledger not found")
		return
	}

	narration := "Opening Balance"
	txn, err := qtx.CreateTransaction(ctx, db.CreateTransactionParams{
		Type:      db.TransactionTypeJournal,
		TxnDate:   openingBalance.date,
		Narration: &narration,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	legs := accounting.OpeningBalanceLegs(ledger.ID, systemLedger.ID, openingBalance.amount)
	entries := make([]db.TransactionEntry, 0, len(legs))
	for _, leg := range legs {
		entry, err := qtx.CreateTransactionEntry(ctx, db.CreateTransactionEntryParams{
			TransactionID: txn.ID,
			LedgerID:      leg.LedgerID,
			Debit:         leg.Debit,
			Credit:        leg.Credit,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		entries = append(entries, entry)
	}

	if err := writeTransactionAuditLog(ctx, qtx, action, txn, entries, nil); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ledgerAfter, _ := json.Marshal(ledger)
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:    "ledger",
		EntityID:      ledger.ID,
		Action:        action,
		AfterSnapshot: ledgerAfter,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, ledger)
}

// ledgerSearchResult adds the ledger's full mobile-number history to the
// normal ledger fields — the picker needs enough context (type, address,
// C/O, mobile) to tell apart two similarly-named ledgers at a glance.
type ledgerSearchResult struct {
	db.Ledger
	MobileNumbers string `json:"mobile_numbers"`
}

// ledgerTypesParam parses an optional comma-separated ?type=cash,bank
// filter. Only the /ledgers list page's own default (empty-search) view
// uses this — LedgerPicker (used inline on every transaction form) never
// sends it, so its own search behavior is unaffected by this filter.
func ledgerTypesParam(r *http.Request) []string {
	v := r.URL.Query().Get("type")
	if v == "" {
		return nil
	}
	return strings.Split(v, ",")
}

func (s *Server) searchLedgers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")

	rows, err := s.queries.SearchLedgers(r.Context(), db.SearchLedgersParams{
		Column1: &q,
		Limit:   50,
		Offset:  0,
		Types:   ledgerTypesParam(r),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	results := make([]ledgerSearchResult, 0, len(rows))
	for _, row := range rows {
		results = append(results, ledgerSearchResult{
			Ledger: db.Ledger{
				ID:           row.ID,
				Name:         row.Name,
				Type:         row.Type,
				CO:           row.CO,
				Address:      row.Address,
				IsSystem:     row.IsSystem,
				MergedIntoID: row.MergedIntoID,
				CreatedAt:    row.CreatedAt,
				UpdatedAt:    row.UpdatedAt,
			},
			MobileNumbers: string(row.MobileNumbers),
		})
	}

	writeJSON(w, http.StatusOK, results)
}
