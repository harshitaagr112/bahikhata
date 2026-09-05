package httpapi

import "testing"

func TestNormalizeVehicleCategory(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Goods carrying vehicle", "Goods carrying vehicle"},
		{"private car", "private car"},
		{"two wheeler", "two wheeler"},
		{"misc", "misc"},
		{"public carrying vehicle", "public carrying vehicle"},
		{"", ""},
		{"SUV", ""},
	}

	for _, tc := range cases {
		if got := normalizeVehicleCategory(tc.input); got != tc.expected {
			t.Fatalf("normalizeVehicleCategory(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}
