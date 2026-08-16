package accounting

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func mustAmount(t *testing.T, s string) pgtype.Numeric {
	t.Helper()
	n, err := ParseAmount(s)
	if err != nil {
		t.Fatalf("ParseAmount(%q) failed: %v", s, err)
	}
	return n
}

func legsBalance(legs []Leg) (debit, credit float64) {
	for _, l := range legs {
		d, _ := l.Debit.Float64Value()
		c, _ := l.Credit.Float64Value()
		debit += d.Float64
		credit += c.Float64
	}
	return
}

func TestPaymentLegsBalance(t *testing.T) {
	amt := mustAmount(t, "500.00")
	legs := PaymentLegs(1, 2, amt)
	if len(legs) != 2 {
		t.Fatalf("expected 2 legs, got %d", len(legs))
	}
	debit, credit := legsBalance(legs)
	if debit != credit || debit != 500 {
		t.Fatalf("payment legs unbalanced: debit=%v credit=%v", debit, credit)
	}
	if legs[0].LedgerID != 2 {
		t.Errorf("expected debit leg on paidTo ledger (2), got %d", legs[0].LedgerID)
	}
	if legs[1].LedgerID != 1 {
		t.Errorf("expected credit leg on paidFrom ledger (1), got %d", legs[1].LedgerID)
	}
}

func TestReceiptLegsBalance(t *testing.T) {
	amt := mustAmount(t, "1000.50")
	legs := ReceiptLegs(10, 20, amt)
	debit, credit := legsBalance(legs)
	if debit != credit || debit != 1000.50 {
		t.Fatalf("receipt legs unbalanced: debit=%v credit=%v", debit, credit)
	}
	if legs[0].LedgerID != 20 {
		t.Errorf("expected debit leg on receivedIn ledger (20), got %d", legs[0].LedgerID)
	}
	if legs[1].LedgerID != 10 {
		t.Errorf("expected credit leg on receivedFrom ledger (10), got %d", legs[1].LedgerID)
	}
}

func TestDiscountLegsBalance(t *testing.T) {
	amt := mustAmount(t, "250.00")
	legs := DiscountLegs(30, 40, amt)
	debit, credit := legsBalance(legs)
	if debit != credit || debit != 250 {
		t.Fatalf("discount legs unbalanced: debit=%v credit=%v", debit, credit)
	}
	if legs[0].LedgerID != 30 {
		t.Errorf("expected debit leg on discountFrom ledger (30), got %d", legs[0].LedgerID)
	}
	if legs[1].LedgerID != 40 {
		t.Errorf("expected credit leg on discountTo ledger (40), got %d", legs[1].LedgerID)
	}
}

func TestIncomeLegsBalance(t *testing.T) {
	amt := mustAmount(t, "20000.00")
	legs := IncomeLegs(50, 60, amt)
	debit, credit := legsBalance(legs)
	if debit != credit || debit != 20000 {
		t.Fatalf("income legs unbalanced: debit=%v credit=%v", debit, credit)
	}
	if legs[0].LedgerID != 60 {
		t.Errorf("expected debit leg on receivedIn ledger (60), got %d", legs[0].LedgerID)
	}
	if legs[1].LedgerID != 50 {
		t.Errorf("expected credit leg on incomeAccount ledger (50), got %d", legs[1].LedgerID)
	}
}

func TestParseAmountRejectsNegative(t *testing.T) {
	if _, err := ParseAmount("-5.00"); err == nil {
		t.Fatal("expected error for negative amount")
	}
}

func TestParseAmountRejectsEmpty(t *testing.T) {
	if _, err := ParseAmount(""); err == nil {
		t.Fatal("expected error for empty amount")
	}
}

func TestParseAmountRejectsGarbage(t *testing.T) {
	if _, err := ParseAmount("not-a-number"); err == nil {
		t.Fatal("expected error for non-numeric amount")
	}
}
