package accounting

import (
	"errors"

	"github.com/jackc/pgx/v5/pgtype"
)

// isZero reports whether a parsed amount is exactly zero, regardless of scale.
func isZero(n pgtype.Numeric) bool {
	return n.Int == nil || n.Int.Sign() == 0
}

// ValidateJournalLegs runs the cheap, obviously-wrong-shaped checks in Go
// before hitting the database. The DB's deferred constraint trigger
// (check_transaction_balanced) is still the final authority on debit==credit
// — this just gives a friendlier error for the common mistakes.
func ValidateJournalLegs(legs []Leg) error {
	if len(legs) < 2 {
		return errors.New("a journal needs at least two lines")
	}
	for _, l := range legs {
		debitSet := !isZero(l.Debit)
		creditSet := !isZero(l.Credit)
		if debitSet && creditSet {
			return errors.New("a journal line cannot have both debit and credit")
		}
		if !debitSet && !creditSet {
			return errors.New("every journal line needs a debit or a credit amount")
		}
	}
	return nil
}
