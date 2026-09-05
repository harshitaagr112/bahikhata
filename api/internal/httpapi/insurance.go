package httpapi

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"tally-api/internal/accounting"
	"tally-api/internal/db"
)

// commissionBasisNetPremium/commissionBasisODPremium are the only two
// values commission_basis may take — which premium figure the agency's
// commission percentage is applied to. Net Premium is the default/primary
// basis; OD Premium is offered because some policies (third-party-only
// covers) have no OD premium at all, in which case commission on that
// basis simply isn't computable (see computeCommission).
const (
	commissionBasisNetPremium = "net_premium"
	commissionBasisODPremium  = "od_premium"
)

func normalizeCommissionBasis(s string) string {
	if s == commissionBasisODPremium {
		return commissionBasisODPremium
	}
	return commissionBasisNetPremium
}

var allowedVehicleCategories = map[string]string{
	"goods carrying vehicle":  "Goods carrying vehicle",
	"private car":             "private car",
	"two wheeler":             "two wheeler",
	"misc":                    "misc",
	"public carrying vehicle": "public carrying vehicle",
}

func normalizeVehicleCategory(s string) string {
	trimmed := strings.TrimSpace(s)
	if trimmed == "" {
		return ""
	}
	if normalized, ok := allowedVehicleCategories[strings.ToLower(trimmed)]; ok {
		return normalized
	}
	return ""
}

// parseOptionalPercentage parses an optional plain decimal percentage
// (e.g. "12.5"), returning an invalid/NULL Numeric for an empty string
// rather than erroring — commission_percentage is optional on a policy.
func parseOptionalPercentage(s string) (pgtype.Numeric, error) {
	if s == "" {
		return pgtype.Numeric{}, nil
	}
	return accounting.ParseAmount(s)
}

// computeCommission derives the premium amount commission is calculated on
// (per commission_basis) and the resulting payout amount (basis * pct /
// 100). Returns nil for whichever value can't be computed — most commonly
// because the basis is OD Premium but this policy's od_premium is the
// literal "TP" (no own-damage premium applies), or because no percentage
// was recorded yet.
func computeCommission(basis string, netPremium pgtype.Numeric, odPremium *string, percentage pgtype.Numeric) (basisAmount *string, amount *string) {
	var basisRat *big.Rat
	switch normalizeCommissionBasis(basis) {
	case commissionBasisODPremium:
		if odPremium == nil {
			return nil, nil
		}
		r, ok := new(big.Rat).SetString(*odPremium)
		if !ok {
			return nil, nil
		}
		basisRat = r
	default:
		basisRat = accounting.ToRat(netPremium)
	}
	basisStr := accounting.DecimalString(basisRat)
	basisAmount = &basisStr

	if !percentage.Valid {
		return basisAmount, nil
	}
	pct := accounting.ToRat(percentage)
	amt := new(big.Rat).Mul(basisRat, pct)
	amt.Quo(amt, big.NewRat(100, 1))
	amtStr := accounting.DecimalString(amt)
	amount = &amtStr
	return basisAmount, amount
}

// insurancePolicyRequest is the request/response envelope for
// insurance-policy endpoints. Field names mirror the columns of the
// original renewal-report spreadsheet (MAY27_RENEWAL.pdf) so the frontend
// form can follow that column order directly. sum_assured/od_premium are
// plain strings, not parsed amounts: the source data uses the literal "TP"
// for third-party-only covers where no own-damage sum/premium applies, so
// these two fields are never used in totals and are stored/echoed verbatim.
type insurancePolicyRequest struct {
	LedgerID        *int64 `json:"ledger_id"`
	InsuredName     string `json:"insured_name"`
	Location        string `json:"location"`
	MobileNo        string `json:"mobile_no"`
	PaymentMode     string `json:"payment_mode"`
	Company         string `json:"company"`
	VehicleCategory string `json:"vehicle_category"`
	VehicleModel    string `json:"vehicle_model"`
	RegistrationNo  string `json:"registration_no"`
	PolicyNo        string `json:"policy_no"`
	IssueDate       string `json:"issue_date"`
	ExpiryDate      string `json:"expiry_date"`
	SumAssured      string `json:"sum_assured"`
	OdPremium       string `json:"od_premium"`
	NetPremium      string `json:"net_premium"`
	TotalPremium    string `json:"total_premium"`
	CommissionBasis string `json:"commission_basis"`
	CommissionPct   string `json:"commission_percentage"`
}

type insurancePolicyResponse struct {
	ID              int64   `json:"id"`
	LedgerID        *int64  `json:"ledger_id"`
	InsuredName     string  `json:"insured_name"`
	Location        *string `json:"location"`
	MobileNo        *string `json:"mobile_no"`
	PaymentMode     *string `json:"payment_mode"`
	Company         string  `json:"company"`
	VehicleCategory *string `json:"vehicle_category"`
	VehicleModel    *string `json:"vehicle_model"`
	RegistrationNo  *string `json:"registration_no"`
	PolicyNo        *string `json:"policy_no"`
	IssueDate       string  `json:"issue_date"`
	ExpiryDate      string  `json:"expiry_date"`
	SumAssured      *string `json:"sum_assured"`
	OdPremium       *string `json:"od_premium"`
	NetPremium      string  `json:"net_premium"`
	TotalPremium    string  `json:"total_premium"`
	CommissionBasis string  `json:"commission_basis"`
	CommissionPct   *string `json:"commission_percentage"`
	// CommissionBasisAmount/CommissionAmount are derived, not stored — the
	// premium figure commission is calculated on, and the resulting payout.
	// Both are nil when not computable (see computeCommission).
	CommissionBasisAmount *string `json:"commission_basis_amount"`
	CommissionAmount      *string `json:"commission_amount"`
}

func insurancePolicyToResponse(p db.InsurancePolicy) insurancePolicyResponse {
	var pct *string
	if p.CommissionPercentage.Valid {
		s := accounting.DecimalString(accounting.ToRat(p.CommissionPercentage))
		pct = &s
	}
	basisAmount, amount := computeCommission(p.CommissionBasis, p.NetPremium, p.OdPremium, p.CommissionPercentage)

	return insurancePolicyResponse{
		ID:                    p.ID,
		LedgerID:              p.LedgerID,
		InsuredName:           p.InsuredName,
		Location:              p.Location,
		MobileNo:              p.MobileNo,
		PaymentMode:           p.PaymentMode,
		Company:               p.Company,
		VehicleCategory:       p.VehicleCategory,
		VehicleModel:          p.VehicleModel,
		RegistrationNo:        p.RegistrationNo,
		PolicyNo:              p.PolicyNo,
		IssueDate:             p.IssueDate.Time.Format("2006-01-02"),
		ExpiryDate:            p.ExpiryDate.Time.Format("2006-01-02"),
		SumAssured:            p.SumAssured,
		OdPremium:             p.OdPremium,
		NetPremium:            accounting.DecimalString(accounting.ToRat(p.NetPremium)),
		TotalPremium:          accounting.DecimalString(accounting.ToRat(p.TotalPremium)),
		CommissionBasis:       normalizeCommissionBasis(p.CommissionBasis),
		CommissionPct:         pct,
		CommissionBasisAmount: basisAmount,
		CommissionAmount:      amount,
	}
}

func optionalString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (s *Server) createInsurancePolicy(w http.ResponseWriter, r *http.Request) {
	var req insurancePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.InsuredName == "" || req.Company == "" {
		writeError(w, http.StatusBadRequest, "insured_name and company are required")
		return
	}
	if req.VehicleCategory != "" {
		normalized := normalizeVehicleCategory(req.VehicleCategory)
		if normalized == "" {
			writeError(w, http.StatusBadRequest, "vehicle_category must be one of: Goods carrying vehicle, private car, two wheeler, misc, public carrying vehicle")
			return
		}
		req.VehicleCategory = normalized
	}

	issueDate, err := parseTxnDate(req.IssueDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "issue_date: "+err.Error())
		return
	}
	expiryDate, err := parseTxnDate(req.ExpiryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "expiry_date: "+err.Error())
		return
	}
	netPremium, err := accounting.ParseAmount(req.NetPremium)
	if err != nil {
		writeError(w, http.StatusBadRequest, "net_premium: "+err.Error())
		return
	}
	totalPremium, err := accounting.ParseAmount(req.TotalPremium)
	if err != nil {
		writeError(w, http.StatusBadRequest, "total_premium: "+err.Error())
		return
	}
	commissionPct, err := parseOptionalPercentage(req.CommissionPct)
	if err != nil {
		writeError(w, http.StatusBadRequest, "commission_percentage: "+err.Error())
		return
	}

	ctx := r.Context()
	policy, err := s.queries.CreateInsurancePolicy(ctx, db.CreateInsurancePolicyParams{
		LedgerID:             req.LedgerID,
		InsuredName:          req.InsuredName,
		Location:             optionalString(req.Location),
		MobileNo:             optionalString(req.MobileNo),
		PaymentMode:          optionalString(req.PaymentMode),
		Company:              req.Company,
		VehicleCategory:      optionalString(req.VehicleCategory),
		VehicleModel:         optionalString(req.VehicleModel),
		RegistrationNo:       optionalString(req.RegistrationNo),
		PolicyNo:             optionalString(req.PolicyNo),
		IssueDate:            issueDate,
		ExpiryDate:           expiryDate,
		SumAssured:           optionalString(req.SumAssured),
		OdPremium:            optionalString(req.OdPremium),
		NetPremium:           netPremium,
		TotalPremium:         totalPremium,
		CommissionBasis:      normalizeCommissionBasis(req.CommissionBasis),
		CommissionPercentage: commissionPct,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := writeInsuranceAuditLog(ctx, s.queries, db.AuditActionCreated, policy, nil); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, insurancePolicyToResponse(policy))
}

func parseInsurancePolicyID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
}

func (s *Server) getInsurancePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseInsurancePolicyID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid insurance policy id")
		return
	}
	policy, err := s.queries.GetInsurancePolicy(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "insurance policy not found")
		return
	}
	writeJSON(w, http.StatusOK, insurancePolicyToResponse(policy))
}

func (s *Server) updateInsurancePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseInsurancePolicyID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid insurance policy id")
		return
	}

	var req insurancePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.InsuredName == "" || req.Company == "" {
		writeError(w, http.StatusBadRequest, "insured_name and company are required")
		return
	}
	if req.VehicleCategory != "" {
		normalized := normalizeVehicleCategory(req.VehicleCategory)
		if normalized == "" {
			writeError(w, http.StatusBadRequest, "vehicle_category must be one of: Goods carrying vehicle, private car, two wheeler, misc, public carrying vehicle")
			return
		}
		req.VehicleCategory = normalized
	}

	issueDate, err := parseTxnDate(req.IssueDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "issue_date: "+err.Error())
		return
	}
	expiryDate, err := parseTxnDate(req.ExpiryDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "expiry_date: "+err.Error())
		return
	}
	netPremium, err := accounting.ParseAmount(req.NetPremium)
	if err != nil {
		writeError(w, http.StatusBadRequest, "net_premium: "+err.Error())
		return
	}
	totalPremium, err := accounting.ParseAmount(req.TotalPremium)
	if err != nil {
		writeError(w, http.StatusBadRequest, "total_premium: "+err.Error())
		return
	}
	commissionPct, err := parseOptionalPercentage(req.CommissionPct)
	if err != nil {
		writeError(w, http.StatusBadRequest, "commission_percentage: "+err.Error())
		return
	}

	ctx := r.Context()
	before, err := s.queries.GetInsurancePolicy(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "insurance policy not found")
		return
	}

	policy, err := s.queries.UpdateInsurancePolicy(ctx, db.UpdateInsurancePolicyParams{
		ID:                   id,
		LedgerID:             req.LedgerID,
		InsuredName:          req.InsuredName,
		Location:             optionalString(req.Location),
		MobileNo:             optionalString(req.MobileNo),
		PaymentMode:          optionalString(req.PaymentMode),
		Company:              req.Company,
		VehicleCategory:      optionalString(req.VehicleCategory),
		VehicleModel:         optionalString(req.VehicleModel),
		RegistrationNo:       optionalString(req.RegistrationNo),
		PolicyNo:             optionalString(req.PolicyNo),
		IssueDate:            issueDate,
		ExpiryDate:           expiryDate,
		SumAssured:           optionalString(req.SumAssured),
		OdPremium:            optionalString(req.OdPremium),
		NetPremium:           netPremium,
		TotalPremium:         totalPremium,
		CommissionBasis:      normalizeCommissionBasis(req.CommissionBasis),
		CommissionPercentage: commissionPct,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := writeInsuranceAuditLog(ctx, s.queries, db.AuditActionEdited, policy, insurancePolicyToResponse(before)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, insurancePolicyToResponse(policy))
}

func (s *Server) deleteInsurancePolicy(w http.ResponseWriter, r *http.Request) {
	id, err := parseInsurancePolicyID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid insurance policy id")
		return
	}

	ctx := r.Context()
	before, err := s.queries.GetInsurancePolicy(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "insurance policy not found")
		return
	}

	if err := s.queries.DeleteInsurancePolicy(ctx, id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	afterBytes, err := json.Marshal(map[string]any{"deleted": true})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	beforeBytes, err := json.Marshal(insurancePolicyToResponse(before))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if _, err := s.queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "insurance_policy",
		EntityID:       id,
		Action:         db.AuditActionDeleted,
		BeforeSnapshot: beforeBytes,
		AfterSnapshot:  afterBytes,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (s *Server) listInsurancePolicies(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit := int32(50)
	offset := int32(0)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = int32(n)
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = int32(n)
		}
	}

	var ledgerID *int64
	if v := r.URL.Query().Get("ledger_id"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			ledgerID = &n
		}
	}

	policies, err := s.queries.ListInsurancePolicies(r.Context(), db.ListInsurancePoliciesParams{
		LedgerID: ledgerID,
		Query:    &q,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	out := make([]insurancePolicyResponse, 0, len(policies))
	for _, p := range policies {
		out = append(out, insurancePolicyToResponse(p))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) listInsuranceCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := s.queries.ListInsuranceCompanies(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, companies)
}

func (s *Server) listInsuranceVehicleCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := s.queries.ListInsuranceVehicleCategories(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]string, 0, len(categories))
	for _, c := range categories {
		if c != nil {
			out = append(out, *c)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func writeInsuranceAuditLog(ctx context.Context, q *db.Queries, action db.AuditAction, policy db.InsurancePolicy, before interface{}) error {
	after, err := json.Marshal(insurancePolicyToResponse(policy))
	if err != nil {
		return err
	}
	var beforeBytes []byte
	if before != nil {
		beforeBytes, err = json.Marshal(before)
		if err != nil {
			return err
		}
	}
	_, err = q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType:     "insurance_policy",
		EntityID:       policy.ID,
		Action:         action,
		BeforeSnapshot: beforeBytes,
		AfterSnapshot:  after,
	})
	return err
}

// buildInsuranceRenewals implements the renewal report: every policy whose
// expiry_date falls in [from, to], optionally narrowed to one company, for
// the on-screen JSON view and its PDF export to share (internal/pdf's
// InsuranceRenewals). Grouping into company -> vehicle-category sections
// (mirroring MAY27_RENEWAL.pdf's layout) happens in the caller, not here,
// so both consumers can group it their own way from the same flat, ordered
// list.
func (s *Server) buildInsuranceRenewals(ctx context.Context, from, to time.Time, company *string) ([]insurancePolicyResponse, error) {
	policies, err := s.queries.ListInsuranceRenewals(ctx, db.ListInsuranceRenewalsParams{
		FromDate: pgtypeDate(from),
		ToDate:   pgtypeDate(to),
		Company:  company,
	})
	if err != nil {
		return nil, err
	}
	out := make([]insurancePolicyResponse, 0, len(policies))
	for _, p := range policies {
		out = append(out, insurancePolicyToResponse(p))
	}
	return out, nil
}

// insuranceRenewalCompanyParam reads the optional ?company= filter shared by
// the JSON and PDF renewal-report endpoints.
func insuranceRenewalCompanyParam(r *http.Request) *string {
	if v := r.URL.Query().Get("company"); v != "" {
		return &v
	}
	return nil
}

func (s *Server) insuranceRenewals(w http.ResponseWriter, r *http.Request) {
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

	result, err := s.buildInsuranceRenewals(r.Context(), from, to, insuranceRenewalCompanyParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// buildInsuranceCommissionPayouts implements the commission/payout report:
// every policy issued in [from, to], optionally narrowed to one company,
// ordered by company then issue date — for the on-screen JSON view and its
// PDF export to share. Each row's commission_basis_amount/commission_amount
// are computed by insurancePolicyToResponse (see computeCommission), so the
// PDF and on-screen numbers can never disagree.
func (s *Server) buildInsuranceCommissionPayouts(ctx context.Context, from, to time.Time, company *string) ([]insurancePolicyResponse, error) {
	policies, err := s.queries.ListInsuranceCommissionPayouts(ctx, db.ListInsuranceCommissionPayoutsParams{
		FromDate: pgtypeDate(from),
		ToDate:   pgtypeDate(to),
		Company:  company,
	})
	if err != nil {
		return nil, err
	}
	out := make([]insurancePolicyResponse, 0, len(policies))
	for _, p := range policies {
		out = append(out, insurancePolicyToResponse(p))
	}
	return out, nil
}

func (s *Server) insuranceCommissionPayouts(w http.ResponseWriter, r *http.Request) {
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

	result, err := s.buildInsuranceCommissionPayouts(r.Context(), from, to, insuranceRenewalCompanyParam(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}
