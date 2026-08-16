package accounting

import "testing"

func TestValidateJournalLegsRequiresTwoLines(t *testing.T) {
	amt := mustAmount(t, "100.00")
	legs := []Leg{debitLeg(1, amt)}
	if err := ValidateJournalLegs(legs); err == nil {
		t.Fatal("expected error for single-line journal")
	}
}

func TestValidateJournalLegsRejectsBothDebitAndCredit(t *testing.T) {
	amt := mustAmount(t, "100.00")
	legs := []Leg{
		{LedgerID: 1, Debit: amt, Credit: amt},
		creditLeg(2, amt),
	}
	if err := ValidateJournalLegs(legs); err == nil {
		t.Fatal("expected error when a line has both debit and credit")
	}
}

func TestValidateJournalLegsRejectsEmptyLine(t *testing.T) {
	amt := mustAmount(t, "100.00")
	legs := []Leg{
		{LedgerID: 1, Debit: Zero, Credit: Zero},
		debitLeg(2, amt),
	}
	if err := ValidateJournalLegs(legs); err == nil {
		t.Fatal("expected error for a line with neither debit nor credit")
	}
}

func TestValidateJournalLegsAcceptsMultiLineJournal(t *testing.T) {
	amt1 := mustAmount(t, "700.00")
	amt2 := mustAmount(t, "300.00")
	amt3 := mustAmount(t, "1000.00")
	legs := []Leg{
		debitLeg(1, amt3),
		creditLeg(2, amt1),
		creditLeg(3, amt2),
	}
	if err := ValidateJournalLegs(legs); err != nil {
		t.Fatalf("unexpected error for valid multi-line journal: %v", err)
	}
}
