// Package pdf renders the app's three reports (ledger statement, daybook,
// outstanding) directly to PDF using gofpdf — no headless browser. Callers
// pass already-formatted display strings (amounts, Dr/Cr labels, dates);
// this package only lays out tables, it never computes accounting values.
package pdf

import (
	"bytes"
	"time"

	"github.com/jung-kurt/gofpdf"
)

const (
	pageMargin  = 15.0
	colorMuted  = 130
	colorBorder = 210
)

func newDoc(title, subtitle string) *gofpdf.Fpdf {
	doc := gofpdf.New("P", "mm", "A4", "")
	doc.SetMargins(pageMargin, pageMargin, pageMargin)
	doc.AddPage()

	doc.SetFont("Helvetica", "B", 16)
	doc.CellFormat(0, 8, title, "", 1, "L", false, 0, "")

	doc.SetFont("Helvetica", "", 9)
	doc.SetTextColor(colorMuted, colorMuted, colorMuted)
	if subtitle != "" {
		doc.CellFormat(0, 6, subtitle, "", 1, "L", false, 0, "")
	}
	doc.CellFormat(0, 6, generatedAt(), "", 1, "L", false, 0, "")
	doc.SetTextColor(0, 0, 0)

	doc.SetDrawColor(colorBorder, colorBorder, colorBorder)
	y := doc.GetY() + 2
	doc.Line(pageMargin, y, 210-pageMargin, y)
	doc.SetY(y + 5)

	return doc
}

func generatedAt() string {
	return "Generated " + time.Now().Format("2 Jan 2006, 3:04 PM")
}

// tableHeader draws a bold header row with the given column widths/labels.
func tableHeader(doc *gofpdf.Fpdf, widths []float64, labels []string, aligns []string) {
	doc.SetFont("Helvetica", "B", 9)
	doc.SetTextColor(colorMuted, colorMuted, colorMuted)
	for i, label := range labels {
		doc.CellFormat(widths[i], 7, label, "B", 0, aligns[i], false, 0, "")
	}
	doc.Ln(-1)
	doc.SetTextColor(0, 0, 0)
	doc.SetFont("Helvetica", "", 9)
}

func ensureSpace(doc *gofpdf.Fpdf, needed float64, redrawHeader func()) {
	_, pageHeight := doc.GetPageSize()
	_, _, _, bottom := doc.GetMargins()
	if doc.GetY()+needed > pageHeight-bottom {
		doc.AddPage()
		if redrawHeader != nil {
			redrawHeader()
		}
	}
}

// summaryRow draws label on the left, value flush right, on one row of the
// given total width, with an optional top border.
func summaryRow(doc *gofpdf.Fpdf, width float64, label, value string, bold bool, topBorder bool) {
	border := ""
	if topBorder {
		border = "T"
	}
	if bold {
		doc.SetFont("Helvetica", "B", 10)
	} else {
		doc.SetFont("Helvetica", "", 10)
	}
	doc.CellFormat(width*0.6, 8, label, border, 0, "L", false, 0, "")
	doc.CellFormat(width*0.4, 8, value, border, 1, "R", false, 0, "")
}

func output(doc *gofpdf.Fpdf) ([]byte, error) {
	var b bytes.Buffer
	if err := doc.Output(&b); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}
