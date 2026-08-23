package pdf

import "strconv"

// InsuranceRenewalRow is one policy line within a vehicle-category
// sub-section. Only the fields required on the printed renewal reminder are
// included here — Name, Location, Mobile No., Registration No., Expiry
// Date, Total Prem. Everything else (policy no., vehicle model, sum
// assured, etc.) stays on the web page's renewals view, not the PDF.
type InsuranceRenewalRow struct {
	InsuredName    string
	Location       string
	MobileNo       string
	RegistrationNo string
	ExpiryDate     string // display-formatted, e.g. "16 May 2027"
	TotalPremium   string
}

// InsuranceRenewalCategory groups rows under one vehicle category within a
// company, e.g. "TWO WHEELER" / "PRIVATE CAR" — matches the PDF's own
// sub-section headers. Category may be empty for policies with no vehicle
// (e.g. health cover).
type InsuranceRenewalCategory struct {
	Category string
	Rows     []InsuranceRenewalRow
}

// InsuranceRenewalCompany groups categories under one insurance company.
type InsuranceRenewalCompany struct {
	Company    string
	Categories []InsuranceRenewalCategory
}

type InsuranceRenewalsInput struct {
	Period     string
	Companies  []InsuranceRenewalCompany
	TotalCount int
}

var insuranceColWidths = []float64{40, 30, 25, 30, 25, 30}
var insuranceColAligns = []string{"L", "L", "L", "L", "L", "R"}
var insuranceColLabels = []string{"Insured Name", "Location", "Mobile No.", "Registration No.", "Expiry Date", "Total Prem"}

func InsuranceRenewals(in InsuranceRenewalsInput) ([]byte, error) {
	doc := newDoc("Insurance Renewals", in.Period)

	drawHeader := func() { tableHeader(doc, insuranceColWidths, insuranceColLabels, insuranceColAligns) }

	if len(in.Companies) == 0 {
		doc.SetFont("Helvetica", "", 9)
		doc.SetTextColor(colorMuted, colorMuted, colorMuted)
		doc.CellFormat(0, 8, "No policies expiring in this period.", "", 1, "L", false, 0, "")
		doc.SetTextColor(0, 0, 0)
	}

	for _, company := range in.Companies {
		ensureSpace(doc, 12, nil)
		doc.SetFont("Helvetica", "B", 12)
		doc.CellFormat(0, 9, company.Company, "", 1, "L", false, 0, "")

		for _, cat := range company.Categories {
			ensureSpace(doc, 10, nil)
			if cat.Category != "" {
				doc.SetFont("Helvetica", "B", 9)
				doc.SetTextColor(colorMuted, colorMuted, colorMuted)
				doc.CellFormat(0, 6, cat.Category, "", 1, "L", false, 0, "")
				doc.SetTextColor(0, 0, 0)
			}
			drawHeader()
			for _, row := range cat.Rows {
				ensureSpace(doc, 7, drawHeader)
				doc.SetFont("Helvetica", "", 9)
				doc.CellFormat(insuranceColWidths[0], 7, row.InsuredName, "B", 0, "L", false, 0, "")
				doc.CellFormat(insuranceColWidths[1], 7, row.Location, "B", 0, "L", false, 0, "")
				doc.CellFormat(insuranceColWidths[2], 7, row.MobileNo, "B", 0, "L", false, 0, "")
				doc.CellFormat(insuranceColWidths[3], 7, row.RegistrationNo, "B", 0, "L", false, 0, "")
				doc.CellFormat(insuranceColWidths[4], 7, row.ExpiryDate, "B", 0, "L", false, 0, "")
				doc.CellFormat(insuranceColWidths[5], 7, row.TotalPremium, "B", 1, "R", false, 0, "")
			}
			doc.Ln(3)
		}
	}

	doc.Ln(2)
	ensureSpace(doc, 9, nil)
	summaryRow(doc, 180, "Total Policies", strconv.Itoa(in.TotalCount), true, true)

	return output(doc)
}
