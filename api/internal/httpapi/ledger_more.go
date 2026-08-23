package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"tally-api/internal/db"
)

func parseLedgerID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
}

func (s *Server) getLedger(w http.ResponseWriter, r *http.Request) {
	id, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}
	ledger, err := s.queries.GetLedger(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ledger not found")
		return
	}
	writeJSON(w, http.StatusOK, ledger)
}

type updateLedgerRequest struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	CO      string `json:"c_o"`
	Address string `json:"address"`
}

func (s *Server) updateLedger(w http.ResponseWriter, r *http.Request) {
	id, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}
	var req updateLedgerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Type == "" {
		writeError(w, http.StatusBadRequest, "name and type are required")
		return
	}

	ctx := r.Context()
	before, err := s.queries.GetLedger(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "ledger not found")
		return
	}
	if before.IsSystem {
		writeError(w, http.StatusBadRequest, "the system Opening Balance ledger cannot be edited")
		return
	}

	params := db.UpdateLedgerParams{ID: id, Name: req.Name, Type: db.LedgerType(req.Type)}
	if req.CO != "" {
		params.CO = &req.CO
	}
	if req.Address != "" {
		params.Address = &req.Address
	}

	ledger, err := s.queries.UpdateLedger(ctx, params)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger type")
		return
	}

	beforeBytes, _ := json.Marshal(before)
	afterBytes, _ := json.Marshal(ledger)
	if _, err := s.queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "ledger",
		EntityID:       id,
		Action:         db.AuditActionEdited,
		BeforeSnapshot: beforeBytes,
		AfterSnapshot:  afterBytes,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, ledger)
}

// deleteLedger implements DECISIONS.md item 8: deletion is allowed only if
// the ledger has zero transaction history, full stop — no deactivation
// state for the general case.
func (s *Server) deleteLedger(w http.ResponseWriter, r *http.Request) {
	id, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}

	rowsAffected, err := s.queries.DeleteLedgerIfUnused(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if rowsAffected == 0 {
		writeError(w, http.StatusConflict, "ledger has transaction history and cannot be deleted")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

type addLedgerMobileNumberRequest struct {
	Number string `json:"number"`
}

func (s *Server) addLedgerMobileNumber(w http.ResponseWriter, r *http.Request) {
	id, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}
	var req addLedgerMobileNumberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		writeError(w, http.StatusBadRequest, "number is required")
		return
	}

	number, err := s.queries.AddLedgerMobileNumber(r.Context(), db.AddLedgerMobileNumberParams{
		LedgerID: id,
		Number:   req.Number,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "ledger not found")
		return
	}
	writeJSON(w, http.StatusCreated, number)
}

func (s *Server) listLedgerMobileNumbers(w http.ResponseWriter, r *http.Request) {
	id, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}
	numbers, err := s.queries.ListLedgerMobileNumbers(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, numbers)
}

type mergeLedgerRequest struct {
	TargetLedgerID int64 `json:"target_ledger_id"`
}

// mergeLedger implements DECISIONS.md item 9: physically moves every
// transaction_entries row from source to target (which also naturally
// carries over the source's opening-balance entry, satisfying "sum both
// opening balances" without any special-cased arithmetic), marks the source
// as merged (no longer selectable — see SearchLedgers' merged_into_id IS
// NULL filter), and audits the action. No undo. Chained merges are allowed:
// the target of one merge can later itself be the source of another.
func (s *Server) mergeLedger(w http.ResponseWriter, r *http.Request) {
	sourceID, err := parseLedgerID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}
	var req mergeLedgerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TargetLedgerID == 0 || req.TargetLedgerID == sourceID {
		writeError(w, http.StatusBadRequest, "a valid, different target_ledger_id is required")
		return
	}

	ctx := r.Context()

	source, err := s.queries.GetLedger(ctx, sourceID)
	if err != nil {
		writeError(w, http.StatusNotFound, "source ledger not found")
		return
	}
	if source.IsSystem {
		writeError(w, http.StatusBadRequest, "the system Opening Balance ledger cannot be merged")
		return
	}
	target, err := s.queries.GetLedger(ctx, req.TargetLedgerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "target ledger not found")
		return
	}
	if target.IsSystem {
		writeError(w, http.StatusBadRequest, "cannot merge a ledger into the system Opening Balance ledger")
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	if err := qtx.MoveLedgerEntries(ctx, db.MoveLedgerEntriesParams{
		LedgerID:   sourceID,
		LedgerID_2: req.TargetLedgerID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	targetID := req.TargetLedgerID
	if err := qtx.MergeLedger(ctx, db.MergeLedgerParams{
		ID:           sourceID,
		MergedIntoID: &targetID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	beforeBytes, _ := json.Marshal(source)
	afterBytes, _ := json.Marshal(map[string]any{"merged_into_id": targetID})
	if _, err := qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "ledger",
		EntityID:       sourceID,
		Action:         db.AuditActionMerged,
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

	writeJSON(w, http.StatusOK, map[string]any{"merged": true, "merged_into_id": targetID})
}
