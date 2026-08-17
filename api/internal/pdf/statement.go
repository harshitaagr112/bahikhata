package pdf

// StatementRow mirrors one row of the ledger statement table. All values
// are already formatted for display (signed balance shown as e.g. "500.00
// Dr", never a bare minus sign).
type StatementRow struct {
	Date         string
	Particular   string // counterparty name (or transaction type as fallback)
	Narration    string
	Debit        string
	Credit       string
	Balance      string
}

type StatementInput struct {
	LedgerName     string
	LedgerMeta     string // e.g. "Customer · C/O Someone · Some Address"
	Period         string // e.g. "Period: 2026-01-01 to 2026-08-17"
	OpeningBalance string
	ClosingBalance string
	TotalDebit     string
	TotalCredit    string
	Rows           []StatementRow
}

var statementColWidths = []float64{22, 78, 25, 25, 30}
var statementColAligns = []string{"L", "L", "R", "R", "R"}
var statementColLabels = []string{"Date", "Particular", "Debit", "Credit", "Balance"}

func LedgerStatement(in StatementInput) ([]byte, error) {
	doc := newDoc(in.LedgerName, in.LedgerMeta)
	doc.SetFont("Helvetica", "", 9)
	doc.SetTextColor(colorMuted, colorMuted, colorMuted)
	doc.CellFormat(0, 5, in.Period, "", 1, "L", false, 0, "")
	doc.SetTextColor(0, 0, 0)
	doc.Ln(2)

	summaryRow(doc, 180, "Opening Balance", in.OpeningBalance, true, false)
	doc.Ln(2)

	drawHeader := func() { tableHeader(doc, statementColWidths, statementColLabels, statementColAligns) }
	drawHeader()

	if len(in.Rows) == 0 {
		doc.SetFont("Helvetica", "", 9)
		doc.SetTextColor(colorMuted, colorMuted, colorMuted)
		doc.CellFormat(0, 8, "No transactions in this period.", "", 1, "L", false, 0, "")
		doc.SetTextColor(0, 0, 0)
	}

	for _, row := range in.Rows {
		rowHeight := 7.0
		if row.Narration != "" {
			rowHeight = 11.0
		}
		ensureSpace(doc, rowHeight, drawHeader)

		startY := doc.GetY()
		startX := doc.GetX()

		doc.SetFont("Helvetica", "", 9)
		doc.CellFormat(statementColWidths[0], rowHeight, row.Date, "B", 0, "L", false, 0, "")

		particularX := doc.GetX()
		doc.SetFont("Helvetica", "B", 9)
		doc.CellFormat(statementColWidths[1], 6, row.Particular, "", 2, "L", false, 0, "")
		if row.Narration != "" {
			doc.SetXY(particularX, doc.GetY())
			doc.SetFont("Helvetica", "", 7)
			doc.SetTextColor(colorMuted, colorMuted, colorMuted)
			doc.CellFormat(statementColWidths[1], 4, row.Narration, "", 2, "L", false, 0, "")
			doc.SetTextColor(0, 0, 0)
		}
		doc.SetXY(particularX+statementColWidths[1], startY)
		bottomOfCell := startY + rowHeight
		doc.Line(particularX, bottomOfCell, particularX+statementColWidths[1], bottomOfCell)

		doc.SetFont("Helvetica", "", 9)
		doc.CellFormat(statementColWidths[2], rowHeight, moneyOrDash(row.Debit), "B", 0, "R", false, 0, "")
		doc.CellFormat(statementColWidths[3], rowHeight, moneyOrDash(row.Credit), "B", 0, "R", false, 0, "")
		doc.SetFont("Helvetica", "B", 9)
		doc.CellFormat(statementColWidths[4], rowHeight, row.Balance, "B", 1, "R", false, 0, "")

		doc.SetXY(startX, startY+rowHeight)
	}

	doc.Ln(2)
	ensureSpace(doc, 18, nil)
	summaryRow(doc, 180, "Total Debit / Credit", in.TotalDebit+" / "+in.TotalCredit, false, true)
	summaryRow(doc, 180, "Closing Balance", in.ClosingBalance, true, false)

	return output(doc)
}

func moneyOrDash(v string) string {
	if v == "" || v == "0.00" {
		return "—"
	}
	return v
}
