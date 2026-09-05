package pdf

import "testing"

func TestMoneyOrDashUsesAsciiDashForEmptyValues(t *testing.T) {
	if got := moneyOrDash(""); got != "-" {
		t.Fatalf("empty value should render as '-' but got %q", got)
	}

	if got := moneyOrDash("0.00"); got != "-" {
		t.Fatalf("zero value should render as '-' but got %q", got)
	}

	if got := moneyOrDash("125.00"); got != "125.00" {
		t.Fatalf("non-zero value should remain unchanged, got %q", got)
	}
}
