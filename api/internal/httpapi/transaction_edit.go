package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"tally-api/internal/accounting"
	"tally-api/internal/db"
)

func parseTxnID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
}

func (s *Server) getTransaction(w http.ResponseWriter, r *http.Request) {
	id, err := parseTxnID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transaction id")
		return
	}

	ctx := r.Context()
	txn, err := s.queries.GetTransaction(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "transaction not found")
		return
	}
	entries, err := s.queries.ListTransactionEntries(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, transactionResponse{Transaction: txn, Entries: entries})
}

// updateTransaction implements "edit" (docs/DECISIONS.md #10): overwrite in
// place, audit the full before/after snapshot, no "(edited)" marker exposed
// to the normal UI. Confirmation is a frontend concern.
func (s *Server) updateTransaction(w http.ResponseWriter, r *http.Request) {
	id, err := parseTxnID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transaction id")
		return
	}

	var req createTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	txnDate, err := parseTxnDate(req.Date)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	legs, err := legsForRequest(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := accounting.ValidateJournalLegs(legs); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx := r.Context()
	if err := s.assertNoSystemLedgerOutsideJournal(ctx, req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	before, err := s.snapshotTransaction(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "transaction not found")
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	var narration *string
	if req.Narration != "" {
		narration = &req.Narration
	}

	txn, err := qtx.UpdateTransaction(ctx, db.UpdateTransactionParams{
		ID:        id,
		Type:      db.TransactionType(req.Type),
		TxnDate:   txnDate,
		Narration: narration,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transaction type")
		return
	}

	if err := qtx.DeleteTransactionEntries(ctx, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	entries := make([]db.TransactionEntry, 0, len(legs))
	for _, leg := range legs {
		entry, err := qtx.CreateTransactionEntry(ctx, db.CreateTransactionEntryParams{
			TransactionID: txn.ID,
			LedgerID:      leg.LedgerID,
			Debit:         leg.Debit,
			Credit:        leg.Credit,
		})
		if err != nil {
			writeError(w, http.StatusBadRequest, "ledger referenced in this transaction does not exist")
			return
		}
		entries = append(entries, entry)
	}

	if err := writeTransactionAuditLog(ctx, qtx, db.AuditActionEdited, txn, entries, before); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(ctx); err != nil {
		if strings.Contains(err.Error(), "is not balanced") {
			writeError(w, http.StatusBadRequest, "transaction entries do not balance (debit must equal credit)")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, transactionResponse{Transaction: txn, Entries: entries})
}

// deleteTransaction implements "delete" (docs/DECISIONS.md #11): audited,
// removes the transaction and (via ON DELETE CASCADE) its entries.
// Confirmation + the "this affects ledger balances" warning are frontend
// concerns; this endpoint just performs the audited deletion.
func (s *Server) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	id, err := parseTxnID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transaction id")
		return
	}

	ctx := r.Context()

	before, err := s.snapshotTransaction(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "transaction not found")
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.DeleteTransaction(ctx, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	afterBytes, err := json.Marshal(map[string]any{"deleted": true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	beforeBytes, err := json.Marshal(before)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "transaction",
		EntityID:       id,
		Action:         db.AuditActionDeleted,
		BeforeSnapshot: beforeBytes,
		AfterSnapshot:  afterBytes,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (s *Server) snapshotTransaction(ctx context.Context, id int64) (transactionResponse, error) {
	txn, err := s.queries.GetTransaction(ctx, id)
	if err != nil {
		return transactionResponse{}, err
	}
	entries, err := s.queries.ListTransactionEntries(ctx, id)
	if err != nil {
		return transactionResponse{}, err
	}
	return transactionResponse{Transaction: txn, Entries: entries}, nil
}
