// Package accounting is the single source of truth for how each user-facing
// transaction type (Payment, Receipt, Discount, Income, Journal) translates
// into balanced debit/credit entries. The frontend never computes this — it
// only sends the user's inputs (which ledgers, one amount) and reads back
// whatever this package (via the HTTP layer) decides.
//
// Fixed posting patterns (see docs/DECISIONS.md items 1-3):
//   Payment:  Debit  = Paid To         Credit = Paid From
//   Receipt:  Debit  = Received In     Credit = Received From
//   Discount: Debit  = Discount From   Credit = Discount To
//   Income:   Debit  = Received In     Credit = Income Account
//   Journal:  user supplies every leg directly; only balance is validated.
package accounting

import (
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"
)

// Leg is one side of a transaction_entries row, prior to knowing the
// transaction_id it will be inserted under.
type Leg struct {
	LedgerID int64
	Debit    pgtype.Numeric
	Credit   pgtype.Numeric
}

func debitLeg(ledgerID int64, amount pgtype.Numeric) Leg {
	return Leg{LedgerID: ledgerID, Debit: amount, Credit: Zero}
}

func creditLeg(ledgerID int64, amount pgtype.Numeric) Leg {
	return Leg{LedgerID: ledgerID, Debit: Zero, Credit: amount}
}

func PaymentLegs(paidFromID, paidToID int64, amount pgtype.Numeric) []Leg {
	return []Leg{debitLeg(paidToID, amount), creditLeg(paidFromID, amount)}
}

func ReceiptLegs(receivedFromID, receivedInID int64, amount pgtype.Numeric) []Leg {
	return []Leg{debitLeg(receivedInID, amount), creditLeg(receivedFromID, amount)}
}

func DiscountLegs(discountFromID, discountToID int64, amount pgtype.Numeric) []Leg {
	return []Leg{debitLeg(discountFromID, amount), creditLeg(discountToID, amount)}
}

func IncomeLegs(incomeAccountID, receivedInID int64, amount pgtype.Numeric) []Leg {
	return []Leg{debitLeg(receivedInID, amount), creditLeg(incomeAccountID, amount)}
}

func absNumeric(n pgtype.Numeric) pgtype.Numeric {
	if n.Int == nil {
		return n
	}
	return pgtype.Numeric{Int: new(big.Int).Abs(n.Int), Exp: n.Exp, Valid: n.Valid}
}

// OpeningBalanceLegs posts a new ledger's opening balance against the hidden
// system "Opening Balance" ledger (docs/DECISIONS.md item 7). A positive
// signedAmount gives the new ledger a debit-normal (receivable-like) opening
// balance; negative gives it a credit-normal (payable-like) one.
func OpeningBalanceLegs(ledgerID, systemLedgerID int64, signedAmount pgtype.Numeric) []Leg {
	amt := absNumeric(signedAmount)
	if Sign(signedAmount) < 0 {
		return []Leg{debitLeg(systemLedgerID, amt), creditLeg(ledgerID, amt)}
	}
	return []Leg{debitLeg(ledgerID, amt), creditLeg(systemLedgerID, amt)}
}
