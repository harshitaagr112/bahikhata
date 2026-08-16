package accounting

import (
	"errors"
	"math/big"

	"github.com/jackc/pgx/v5/pgtype"
)

var Zero = mustParse("0")

// ParseAmount turns a decimal string (e.g. "50000.00") into a pgtype.Numeric.
// Amounts are always taken as strings across the API boundary to avoid
// float64 precision loss on money.
func ParseAmount(s string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if s == "" {
		return n, errors.New("amount is required")
	}
	if err := n.Scan(s); err != nil {
		return n, errors.New("invalid amount")
	}
	if !n.Valid {
		return n, errors.New("invalid amount")
	}
	if n.Int != nil && n.Int.Sign() < 0 {
		return n, errors.New("amount must be positive")
	}
	return n, nil
}

// ParseSignedAmount is like ParseAmount but allows negative values — used
// only for Opening Balance, where the sign determines which side (the new
// ledger or the system ledger) gets debited (see OpeningBalanceLegs).
func ParseSignedAmount(s string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if s == "" {
		return n, errors.New("amount is required")
	}
	if err := n.Scan(s); err != nil {
		return n, errors.New("invalid amount")
	}
	if !n.Valid {
		return n, errors.New("invalid amount")
	}
	return n, nil
}

func mustParse(s string) pgtype.Numeric {
	n, err := ParseAmount(s)
	if err != nil {
		panic(err)
	}
	return n
}

// ToRat converts a pgtype.Numeric (Int * 10^Exp) into an exact big.Rat, so
// running-balance arithmetic across many statement rows never drifts the way
// repeated float64 addition would.
func ToRat(n pgtype.Numeric) *big.Rat {
	if n.Int == nil {
		return new(big.Rat)
	}
	r := new(big.Rat).SetInt(n.Int)
	if n.Exp > 0 {
		scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n.Exp)), nil)
		r.Mul(r, new(big.Rat).SetInt(scale))
	} else if n.Exp < 0 {
		scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(-n.Exp)), nil)
		r.Quo(r, new(big.Rat).SetInt(scale))
	}
	return r
}

// DecimalString formats an exact rupee-and-paise amount with 2 decimals.
func DecimalString(r *big.Rat) string {
	return r.FloatString(2)
}

// Sign reports -1/0/1 for a pgtype.Numeric without going through float64.
func Sign(n pgtype.Numeric) int {
	if n.Int == nil {
		return 0
	}
	return n.Int.Sign()
}
