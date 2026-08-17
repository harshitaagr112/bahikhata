package pdf

type OutstandingEntry struct {
	Name   string
	Amount string
}

type OutstandingInput struct {
	Receivables      []OutstandingEntry
	Payables         []OutstandingEntry
	ReceivablesTotal string
	PayablesTotal    string
}

func Outstanding(in OutstandingInput) ([]byte, error) {
	doc := newDoc("Outstanding", "")

	drawSection := func(title, total string, entries []OutstandingEntry) {
		doc.SetFont("Helvetica", "B", 11)
		doc.CellFormat(140, 8, title, "B", 0, "L", false, 0, "")
		doc.CellFormat(40, 8, total, "B", 1, "R", false, 0, "")

		if len(entries) == 0 {
			doc.SetFont("Helvetica", "", 9)
			doc.SetTextColor(colorMuted, colorMuted, colorMuted)
			doc.CellFormat(0, 8, "Nothing outstanding.", "", 1, "L", false, 0, "")
			doc.SetTextColor(0, 0, 0)
		}

		for _, e := range entries {
			ensureSpace(doc, 7, nil)
			doc.SetFont("Helvetica", "", 9)
			doc.CellFormat(140, 7, e.Name, "B", 0, "L", false, 0, "")
			doc.SetFont("Helvetica", "B", 9)
			doc.CellFormat(40, 7, e.Amount, "B", 1, "R", false, 0, "")
		}
		doc.Ln(6)
	}

	drawSection("Receivables", in.ReceivablesTotal, in.Receivables)
	drawSection("Payables", in.PayablesTotal, in.Payables)

	return output(doc)
}
