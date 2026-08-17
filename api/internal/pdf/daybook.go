package pdf

// DaybookRow is one transaction line, already grouped by date by the caller.
type DaybookRow struct {
	Type      string // e.g. "payment", shown uppercase
	Flow      string // "A → B" or comma-joined ledger names for a journal
	Narration string
	Amount    string
}

type DaybookGroup struct {
	DateLabel string // e.g. "17 Aug 2026"
	Rows      []DaybookRow
}

type DaybookInput struct {
	Period      string
	Groups      []DaybookGroup
	TotalDebit  string
	TotalCredit string
}

var daybookColWidths = []float64{22, 25, 88, 25}
var daybookColAligns = []string{"L", "L", "L", "R"}
var daybookColLabels = []string{"Date", "Type", "Particulars", "Amount"}

func Daybook(in DaybookInput) ([]byte, error) {
	doc := newDoc("Daybook", in.Period)

	drawHeader := func() { tableHeader(doc, daybookColWidths, daybookColLabels, daybookColAligns) }
	drawHeader()

	if len(in.Groups) == 0 {
		doc.SetFont("Helvetica", "", 9)
		doc.SetTextColor(colorMuted, colorMuted, colorMuted)
		doc.CellFormat(0, 8, "No transactions in this period.", "", 1, "L", false, 0, "")
		doc.SetTextColor(0, 0, 0)
	}

	for _, group := range in.Groups {
		for i, row := range group.Rows {
			rowHeight := 7.0
			if row.Narration != "" {
				rowHeight = 11.0
			}
			ensureSpace(doc, rowHeight, drawHeader)

			startY := doc.GetY()
			startX := doc.GetX()

			doc.SetFont("Helvetica", "", 9)
			dateCell := ""
			if i == 0 {
				dateCell = group.DateLabel
			}
			doc.CellFormat(daybookColWidths[0], rowHeight, dateCell, "B", 0, "L", false, 0, "")

			doc.SetTextColor(colorMuted, colorMuted, colorMuted)
			doc.SetFont("Helvetica", "", 8)
			doc.CellFormat(daybookColWidths[1], rowHeight, upper(row.Type), "B", 0, "L", false, 0, "")
			doc.SetTextColor(0, 0, 0)

			particularX := doc.GetX()
			doc.SetFont("Helvetica", "B", 9)
			doc.CellFormat(daybookColWidths[2], 6, row.Flow, "", 2, "L", false, 0, "")
			if row.Narration != "" {
				doc.SetXY(particularX, doc.GetY())
				doc.SetFont("Helvetica", "", 7)
				doc.SetTextColor(colorMuted, colorMuted, colorMuted)
				doc.CellFormat(daybookColWidths[2], 4, row.Narration, "", 2, "L", false, 0, "")
				doc.SetTextColor(0, 0, 0)
			}
			bottomOfCell := startY + rowHeight
			doc.Line(particularX, bottomOfCell, particularX+daybookColWidths[2], bottomOfCell)

			doc.SetXY(particularX+daybookColWidths[2], startY)
			doc.SetFont("Helvetica", "B", 9)
			doc.CellFormat(daybookColWidths[3], rowHeight, row.Amount, "B", 1, "R", false, 0, "")

			doc.SetXY(startX, startY+rowHeight)
		}
	}

	doc.Ln(2)
	ensureSpace(doc, 9, nil)
	summaryRow(doc, 180, "Total Debit / Credit", in.TotalDebit+" / "+in.TotalCredit, true, true)

	return output(doc)
}

func upper(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - 'a' + 'A'
		}
	}
	return string(b)
}
