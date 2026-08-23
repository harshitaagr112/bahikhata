package pdf

// CommissionPayoutRow is one policy line within a company section, per the
// requested payout report columns: name, registration no., the premium
// commission is calculated on, the percentage, date of issue, policy
// number, and the resulting payout amount.
type CommissionPayoutRow struct {
	InsuredName    string
	RegistrationNo string
	PremiumBasis   string // the premium amount commission is calculated on (net or OD)
	Percentage     string
	IssueDate      string // display-formatted, e.g. "16 May 2027"
	PolicyNo       string
	CommissionAmt  string
}

// CommissionPayoutCompany groups rows under one insurance company.
type CommissionPayoutCompany struct {
	Company string
	Rows    []CommissionPayoutRow
}

type CommissionPayoutsInput struct {
	Period      string
	Companies   []CommissionPayoutCompany
	TotalCount  int
	TotalPayout string
}

var commissionColWidths = []float64{50, 24, 20, 12, 24, 24, 20}
var commissionColAligns = []string{"L", "L", "R", "R", "L", "L", "R"}
var commissionColLabels = []string{"Insured Name", "Registration No.", "Premium", "%", "Issue Date", "Policy No.", "Commission"}

func CommissionPayouts(in CommissionPayoutsInput) ([]byte, error) {
	doc := newDoc("Insurance Commission Payouts", in.Period)

	drawHeader := func() { tableHeader(doc, commissionColWidths, commissionColLabels, commissionColAligns) }

	if len(in.Companies) == 0 {
		doc.SetFont("Helvetica", "", 9)
		doc.SetTextColor(colorMuted, colorMuted, colorMuted)
		doc.CellFormat(0, 8, "No policies issued in this period.", "", 1, "L", false, 0, "")
		doc.SetTextColor(0, 0, 0)
	}

	for _, company := range in.Companies {
		ensureSpace(doc, 12, nil)
		doc.SetFont("Helvetica", "B", 12)
		doc.CellFormat(0, 9, company.Company, "", 1, "L", false, 0, "")

		drawHeader()
		for _, row := range company.Rows {
			ensureSpace(doc, 7, drawHeader)
			doc.SetFont("Helvetica", "", 9)
			doc.CellFormat(commissionColWidths[0], 7, row.InsuredName, "B", 0, "L", false, 0, "")
			doc.CellFormat(commissionColWidths[1], 7, row.RegistrationNo, "B", 0, "L", false, 0, "")
			doc.CellFormat(commissionColWidths[2], 7, row.PremiumBasis, "B", 0, "R", false, 0, "")
			doc.CellFormat(commissionColWidths[3], 7, row.Percentage, "B", 0, "R", false, 0, "")
			doc.CellFormat(commissionColWidths[4], 7, row.IssueDate, "B", 0, "L", false, 0, "")
			doc.CellFormat(commissionColWidths[5], 7, row.PolicyNo, "B", 0, "L", false, 0, "")
			doc.CellFormat(commissionColWidths[6], 7, row.CommissionAmt, "B", 1, "R", false, 0, "")
		}
		doc.Ln(3)
	}

	doc.Ln(2)
	ensureSpace(doc, 9, nil)
	summaryRow(doc, 180, "Total Commission Payout", in.TotalPayout, true, true)

	return output(doc)
}
