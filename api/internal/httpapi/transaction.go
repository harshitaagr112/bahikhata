package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"tally-api/internal/accounting"
	"tally-api/internal/db"
)

type journalLineRequest struct {
	LedgerID int64  `json:"ledger_id"`
	Debit    string `json:"debit"`
	Credit   string `json:"credit"`
}

type createTransactionRequest struct {
	Type      string `json:"type"`
	Date      string `json:"date"`
	Narration string `json:"narration"`
	Mobile    string `json:"mobile"`
	Amount    string `json:"amount"`

	PaidFromID int64 `json:"paid_from_id"`
	PaidToID   int64 `json:"paid_to_id"`

	ReceivedFromID int64 `json:"received_from_id"`
	ReceivedInID   int64 `json:"received_in_id"`

	DiscountFromID int64 `json:"discount_from_id"`
	DiscountToID   int64 `json:"discount_to_id"`

	IncomeAccountID int64 `json:"income_account_id"`

	Lines []journalLineRequest `json:"lines"`
}

type transactionResponse struct {
	db.Transaction
	Entries []db.TransactionEntry `json:"entries"`
}

func parseTxnDate(s string) (pgtype.Date, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, errors.New("date must be in YYYY-MM-DD format")
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

// mobileLedgerID returns which ledger (if any) a submitted mobile number
// should be appended to, per transaction type. Income and Journal have no
// natural "person" counterpart, so mobile numbers are only accepted for the
// other three.
func mobileLedgerID(req createTransactionRequest) int64 {
	switch req.Type {
	case "payment":
		return req.PaidToID
	case "receipt":
		return req.ReceivedFromID
	case "discount":
		return req.DiscountToID
	default:
		return 0
	}
}

func (s *Server) createTransaction(w http.ResponseWriter, r *http.Request) {
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

	txn, err := qtx.CreateTransaction(ctx, db.CreateTransactionParams{
		Type:      db.TransactionType(req.Type),
		TxnDate:   txnDate,
		Narration: narration,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid transaction type")
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

	if req.Mobile != "" {
		if ledgerID := mobileLedgerID(req); ledgerID != 0 {
			if _, err := qtx.AddLedgerMobileNumber(ctx, db.AddLedgerMobileNumberParams{
				LedgerID: ledgerID,
				Number:   req.Mobile,
			}); err != nil {
				writeError(w, http.StatusBadRequest, "could not record mobile number")
				return
			}
		}
	}

	if err := writeTransactionAuditLog(ctx, qtx, db.AuditActionCreated, txn, entries, nil); err != nil {
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

	writeJSON(w, http.StatusCreated, transactionResponse{Transaction: txn, Entries: entries})
}

func legsForRequest(req createTransactionRequest) ([]accounting.Leg, error) {
	switch req.Type {
	case "payment":
		amount, err := accounting.ParseAmount(req.Amount)
		if err != nil {
			return nil, err
		}
		return accounting.PaymentLegs(req.PaidFromID, req.PaidToID, amount), nil
	case "receipt":
		amount, err := accounting.ParseAmount(req.Amount)
		if err != nil {
			return nil, err
		}
		return accounting.ReceiptLegs(req.ReceivedFromID, req.ReceivedInID, amount), nil
	case "discount":
		amount, err := accounting.ParseAmount(req.Amount)
		if err != nil {
			return nil, err
		}
		return accounting.DiscountLegs(req.DiscountFromID, req.DiscountToID, amount), nil
	case "income":
		amount, err := accounting.ParseAmount(req.Amount)
		if err != nil {
			return nil, err
		}
		return accounting.IncomeLegs(req.IncomeAccountID, req.ReceivedInID, amount), nil
	case "journal":
		if len(req.Lines) == 0 {
			return nil, errors.New("journal requires at least one line")
		}
		legs := make([]accounting.Leg, 0, len(req.Lines))
		for _, line := range req.Lines {
			debit := accounting.Zero
			credit := accounting.Zero
			var err error
			if line.Debit != "" {
				if debit, err = accounting.ParseAmount(line.Debit); err != nil {
					return nil, err
				}
			}
			if line.Credit != "" {
				if credit, err = accounting.ParseAmount(line.Credit); err != nil {
					return nil, err
				}
			}
			legs = append(legs, accounting.Leg{LedgerID: line.LedgerID, Debit: debit, Credit: credit})
		}
		return legs, nil
	default:
		return nil, errors.New("unknown transaction type")
	}
}

// simpleTypeLedgerIDs returns the ledger IDs used by a non-journal
// transaction (Payment/Receipt/Discount/Income each reference exactly two).
func simpleTypeLedgerIDs(req createTransactionRequest) []int64 {
	switch req.Type {
	case "payment":
		return []int64{req.PaidFromID, req.PaidToID}
	case "receipt":
		return []int64{req.ReceivedFromID, req.ReceivedInID}
	case "discount":
		return []int64{req.DiscountFromID, req.DiscountToID}
	case "income":
		return []int64{req.IncomeAccountID, req.ReceivedInID}
	default:
		return nil
	}
}

// assertNoSystemLedgerOutsideJournal enforces that the system "Opening
// Balance" ledger can only ever be used from a Journal entry — never from
// Payment/Receipt/Discount/Income. This keeps the invariant that every
// opening-balance/migration posting has Opening Balance as its one and only
// counterparty structurally guaranteed, not just a UI convention (see
// docs/DECISIONS.md).
func (s *Server) assertNoSystemLedgerOutsideJournal(ctx context.Context, req createTransactionRequest) error {
	for _, id := range simpleTypeLedgerIDs(req) {
		if id == 0 {
			continue
		}
		ledger, err := s.queries.GetLedger(ctx, id)
		if err != nil {
			return errors.New("ledger not found")
		}
		if ledger.IsSystem {
			return errors.New("the Opening Balance ledger can only be used in a Journal entry")
		}
	}
	return nil
}

func writeTransactionAuditLog(ctx context.Context, qtx *db.Queries, action db.AuditAction, txn db.Transaction, entries []db.TransactionEntry, before interface{}) error {
	after, err := json.Marshal(transactionResponse{Transaction: txn, Entries: entries})
	if err != nil {
		return err
	}
	var beforeBytes []byte
	if before != nil {
		beforeBytes, err = json.Marshal(before)
		if err != nil {
			return err
		}
	}
	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "transaction",
		EntityID:       txn.ID,
		Action:         action,
		BeforeSnapshot: beforeBytes,
		AfterSnapshot:  after,
	})
	return err
}
