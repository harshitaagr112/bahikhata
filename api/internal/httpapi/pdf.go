package httpapi

import (
	"context"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"tally-api/internal/pdf"
)

func writePDF(w http.ResponseWriter, filename string, body []byte, err error) {
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// drCr formats a signed decimal string the way MoneyDrCr does on the
// frontend: unsigned amount plus "Dr" (>=0) or "Cr" (<0) — signed ledger
// balances must never render with a bare minus sign.
func drCr(signed string) string {
	if len(signed) > 0 && signed[0] == '-' {
		return signed[1:] + " Cr"
	}
	return signed + " Dr"
}

func periodLabel(from, to string) string {
	f := from
	if f == "" {
		f = "beginning"
	}
	t := to
	if t == "" {
		t = time.Now().Format("2006-01-02")
	}
	return "Period: " + f + " to " + t
}

func (s *Server) ledgerStatementPDF(w http.ResponseWriter, r *http.Request) {
	ledgerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid ledger id")
		return
	}

	fromParam := r.URL.Query().Get("from")
	toParam := r.URL.Query().Get("to")

	from, err := parseDateParam(r, "from", time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	ctx := r.Context()

	ledger, err := s.queries.GetLedger(ctx, ledgerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "ledger not found")
		return
	}

	result, err := s.buildLedgerStatement(ctx, ledgerID, from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	meta := string(ledger.Type)
	if ledger.CO != nil && *ledger.CO != "" {
		meta += " · C/O " + *ledger.CO
	}
	if ledger.Address != nil && *ledger.Address != "" {
		meta += " · " + *ledger.Address
	}

	rows := make([]pdf.StatementRow, 0, len(result.Entries))
	for _, e := range result.Entries {
		particular := counterpartyNames(e.Counterparties)
		if particular == "" {
			particular = e.Type
		}
		rows = append(rows, pdf.StatementRow{
			Date:       e.Date,
			Particular: particular,
			Narration:  e.Narration,
			Debit:      e.Debit,
			Credit:     e.Credit,
			Balance:    drCr(e.Balance),
		})
	}

	body, err := pdf.LedgerStatement(pdf.StatementInput{
		LedgerName:     ledger.Name,
		LedgerMeta:     meta,
		Period:         periodLabel(fromParam, toParam),
		OpeningBalance: drCr(result.OpeningBalance),
		ClosingBalance: drCr(result.ClosingBalance),
		TotalDebit:     result.TotalDebit,
		TotalCredit:    result.TotalCredit,
		Rows:           rows,
	})
	writePDF(w, fmt.Sprintf("ledger-%d-statement.pdf", ledgerID), body, err)
}

func (s *Server) daybookPDF(w http.ResponseWriter, r *http.Request) {
	fromParam := r.URL.Query().Get("from")
	toParam := r.URL.Query().Get("to")

	from, err := parseDateParam(r, "from", time.Now().AddDate(0, 0, -30))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", time.Now())
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	result, err := s.buildDaybook(r.Context(), from, to, 200, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	groups := make([]pdf.DaybookGroup, 0)
	var currentDate string
	var current *pdf.DaybookGroup
	for _, txn := range result.Transactions {
		date := txn.TxnDate.Time.Format("2006-01-02")
		if current == nil || date != currentDate {
			groups = append(groups, pdf.DaybookGroup{DateLabel: txn.TxnDate.Time.Format("2 Jan 2006")})
			current = &groups[len(groups)-1]
			currentDate = date
		}
		current.Rows = append(current.Rows, pdf.DaybookRow{
			Type:      string(txn.Type),
			Flow:      daybookFlow(txn.Entries),
			Narration: derefString(txn.Narration),
			Amount:    daybookAmount(txn.Entries),
		})
	}

	body, err := pdf.Daybook(pdf.DaybookInput{
		Period:      periodLabel(fromParam, toParam),
		Groups:      groups,
		TotalDebit:  result.TotalDebit,
		TotalCredit: result.TotalCredit,
	})
	writePDF(w, "daybook.pdf", body, err)
}

// daybookFlow mirrors the on-screen "A → B" flow label: for a simple
// two-leg transaction, show debit-ledger ← credit-ledger as an arrow; for a
// multi-leg journal, just list every ledger involved.
func daybookFlow(entries []daybookEntry) string {
	var debits, credits []string
	for _, e := range entries {
		if !isZeroAmount(e.Debit) {
			debits = append(debits, e.LedgerName)
		}
		if !isZeroAmount(e.Credit) {
			credits = append(credits, e.LedgerName)
		}
	}
	if len(debits) == 1 && len(credits) == 1 {
		return credits[0] + " -> " + debits[0]
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.LedgerName)
	}
	return strings.Join(names, ", ")
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func isZeroAmount(s string) bool {
	r, ok := new(big.Rat).SetString(s)
	return !ok || r.Sign() == 0
}

func daybookAmount(entries []daybookEntry) string {
	for _, e := range entries {
		if !isZeroAmount(e.Debit) {
			return e.Debit
		}
	}
	return "0.00"
}

func (s *Server) outstandingPDF(w http.ResponseWriter, r *http.Request) {
	result, err := s.buildOutstanding(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	toEntries := func(in []outstandingEntry) ([]pdf.OutstandingEntry, string) {
		out := make([]pdf.OutstandingEntry, 0, len(in))
		sum := new(big.Rat)
		for _, e := range in {
			out = append(out, pdf.OutstandingEntry{Name: e.Name, Amount: e.Amount})
			if amt, ok := new(big.Rat).SetString(e.Amount); ok {
				sum.Add(sum, amt)
			}
		}
		return out, sum.FloatString(2)
	}

	receivables, receivablesTotal := toEntries(result.Receivables)
	payables, payablesTotal := toEntries(result.Payables)

	body, err := pdf.Outstanding(pdf.OutstandingInput{
		Receivables:      receivables,
		Payables:         payables,
		ReceivablesTotal: receivablesTotal,
		PayablesTotal:    payablesTotal,
	})
	writePDF(w, "outstanding.pdf", body, err)
}

func (s *Server) insuranceRenewalsPDF(w http.ResponseWriter, r *http.Request) {
	fromParam := r.URL.Query().Get("from")
	toParam := r.URL.Query().Get("to")

	now := time.Now()
	from, err := parseDateParam(r, "from", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", from.AddDate(0, 1, -1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	policies, err := s.buildInsuranceRenewals(r.Context(), from, to, insuranceRenewalCompanyParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	mobileByLedger, err := s.latestMobileNumbersByLedger(r.Context(), policies)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	companies := make([]pdf.InsuranceRenewalCompany, 0)
	var currentCompany, currentCategory string
	var company *pdf.InsuranceRenewalCompany
	var category *pdf.InsuranceRenewalCategory
	for _, p := range policies {
		category_ := ""
		if p.VehicleCategory != nil {
			category_ = *p.VehicleCategory
		}
		if company == nil || p.Company != currentCompany {
			companies = append(companies, pdf.InsuranceRenewalCompany{Company: p.Company})
			company = &companies[len(companies)-1]
			currentCompany = p.Company
			category = nil
		}
		if category == nil || category_ != currentCategory {
			company.Categories = append(company.Categories, pdf.InsuranceRenewalCategory{Category: category_})
			category = &company.Categories[len(company.Categories)-1]
			currentCategory = category_
		}
		location := ""
		if p.Location != nil {
			location = *p.Location
		}
		registrationNo := ""
		if p.RegistrationNo != nil {
			registrationNo = *p.RegistrationNo
		}
		// Name, Location, Mobile No., Registration No., Expiry Date, and
		// Total Prem are the compulsory fields on the printed renewal
		// reminder. Mobile No. falls back to the linked customer ledger's
		// own mobile number when the policy itself has none on file.
		mobileNo := ""
		if p.MobileNo != nil {
			mobileNo = *p.MobileNo
		} else if p.LedgerID != nil {
			mobileNo = mobileByLedger[*p.LedgerID]
		}
		expiryDate, _ := time.Parse("2006-01-02", p.ExpiryDate)
		category.Rows = append(category.Rows, pdf.InsuranceRenewalRow{
			InsuredName:    p.InsuredName,
			Location:       location,
			MobileNo:       mobileNo,
			RegistrationNo: registrationNo,
			ExpiryDate:     expiryDate.Format("2 Jan 2006"),
			TotalPremium:   p.TotalPremium,
		})
	}

	body, err := pdf.InsuranceRenewals(pdf.InsuranceRenewalsInput{
		Period:     periodLabel(fromParam, toParam),
		Companies:  companies,
		TotalCount: len(policies),
	})
	writePDF(w, "insurance-renewals.pdf", body, err)
}

// latestMobileNumbersByLedger batch-fetches the most recent mobile number
// on file for every distinct linked ledger among the given policies, in one
// query — never one query per row (see the daybook N+1 fix earlier in this
// codebase's history for why that matters).
func (s *Server) latestMobileNumbersByLedger(ctx context.Context, policies []insurancePolicyResponse) (map[int64]string, error) {
	seen := make(map[int64]bool)
	ledgerIDs := make([]int64, 0)
	for _, p := range policies {
		if p.LedgerID != nil && !seen[*p.LedgerID] {
			seen[*p.LedgerID] = true
			ledgerIDs = append(ledgerIDs, *p.LedgerID)
		}
	}
	result := make(map[int64]string, len(ledgerIDs))
	if len(ledgerIDs) == 0 {
		return result, nil
	}
	rows, err := s.queries.LatestMobileNumbersForLedgers(ctx, ledgerIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.LedgerID] = row.Number
	}
	return result, nil
}

func (s *Server) insuranceCommissionPayoutsPDF(w http.ResponseWriter, r *http.Request) {
	fromParam := r.URL.Query().Get("from")
	toParam := r.URL.Query().Get("to")

	now := time.Now()
	from, err := parseDateParam(r, "from", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'from' date")
		return
	}
	to, err := parseDateParam(r, "to", from.AddDate(0, 1, -1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid 'to' date")
		return
	}

	policies, err := s.buildInsuranceCommissionPayouts(r.Context(), from, to, insuranceRenewalCompanyParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	companies := make([]pdf.CommissionPayoutCompany, 0)
	var currentCompany string
	var company *pdf.CommissionPayoutCompany
	totalPayout := new(big.Rat)
	for _, p := range policies {
		if company == nil || p.Company != currentCompany {
			companies = append(companies, pdf.CommissionPayoutCompany{Company: p.Company})
			company = &companies[len(companies)-1]
			currentCompany = p.Company
		}
		registrationNo := ""
		if p.RegistrationNo != nil {
			registrationNo = *p.RegistrationNo
		}
		policyNo := ""
		if p.PolicyNo != nil {
			policyNo = *p.PolicyNo
		}
		premiumBasis := "-"
		if p.CommissionBasisAmount != nil {
			premiumBasis = *p.CommissionBasisAmount
		}
		percentage := "-"
		if p.CommissionPct != nil {
			percentage = *p.CommissionPct + "%"
		}
		commissionAmt := "-"
		if p.CommissionAmount != nil {
			commissionAmt = *p.CommissionAmount
			if amt, ok := new(big.Rat).SetString(*p.CommissionAmount); ok {
				totalPayout.Add(totalPayout, amt)
			}
		}
		issueDate, _ := time.Parse("2006-01-02", p.IssueDate)
		company.Rows = append(company.Rows, pdf.CommissionPayoutRow{
			InsuredName:    p.InsuredName,
			RegistrationNo: registrationNo,
			PremiumBasis:   premiumBasis,
			Percentage:     percentage,
			IssueDate:      issueDate.Format("2 Jan 2006"),
			PolicyNo:       policyNo,
			CommissionAmt:  commissionAmt,
		})
	}

	body, err := pdf.CommissionPayouts(pdf.CommissionPayoutsInput{
		Period:      periodLabel(fromParam, toParam),
		Companies:   companies,
		TotalCount:  len(policies),
		TotalPayout: totalPayout.FloatString(2),
	})
	writePDF(w, "insurance-commission-payouts.pdf", body, err)
}
