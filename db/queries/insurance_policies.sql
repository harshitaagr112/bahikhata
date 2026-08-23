-- name: CreateInsurancePolicy :one
INSERT INTO insurance_policies (
    ledger_id, insured_name, location, mobile_no, payment_mode, company,
    vehicle_category, vehicle_model, registration_no, policy_no,
    issue_date, expiry_date, sum_assured, od_premium, net_premium, total_premium,
    commission_basis, commission_percentage
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
) RETURNING *;

-- name: GetInsurancePolicy :one
SELECT * FROM insurance_policies WHERE id = $1;

-- name: UpdateInsurancePolicy :one
UPDATE insurance_policies SET
    ledger_id = $2, insured_name = $3, location = $4, mobile_no = $5,
    payment_mode = $6, company = $7, vehicle_category = $8, vehicle_model = $9,
    registration_no = $10, policy_no = $11, issue_date = $12, expiry_date = $13,
    sum_assured = $14, od_premium = $15, net_premium = $16, total_premium = $17,
    commission_basis = $18, commission_percentage = $19,
    updated_at = now()
WHERE id = $1 RETURNING *;

-- name: DeleteInsurancePolicy :exec
DELETE FROM insurance_policies WHERE id = $1;

-- name: ListInsurancePolicies :many
SELECT * FROM insurance_policies
WHERE (sqlc.narg('ledger_id')::bigint IS NULL OR ledger_id = sqlc.narg('ledger_id'))
  AND (
    sqlc.narg('query')::text IS NULL OR sqlc.narg('query') = '' OR
    insured_name ILIKE '%' || sqlc.narg('query') || '%' OR
    registration_no ILIKE '%' || sqlc.narg('query') || '%' OR
    policy_no ILIKE '%' || sqlc.narg('query') || '%' OR
    mobile_no ILIKE '%' || sqlc.narg('query') || '%'
  )
ORDER BY expiry_date DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: ListInsuranceCompanies :many
SELECT DISTINCT company FROM insurance_policies ORDER BY company;

-- name: ListInsuranceVehicleCategories :many
SELECT DISTINCT vehicle_category FROM insurance_policies
WHERE vehicle_category IS NOT NULL AND vehicle_category != ''
ORDER BY vehicle_category;

-- name: ListInsuranceRenewals :many
SELECT * FROM insurance_policies
WHERE expiry_date BETWEEN sqlc.arg('from_date') AND sqlc.arg('to_date')
  AND (sqlc.narg('company')::text IS NULL OR company = sqlc.narg('company'))
ORDER BY company, vehicle_category, expiry_date, id;

-- name: ListInsuranceCommissionPayouts :many
SELECT * FROM insurance_policies
WHERE issue_date BETWEEN sqlc.arg('from_date') AND sqlc.arg('to_date')
  AND (sqlc.narg('company')::text IS NULL OR company = sqlc.narg('company'))
ORDER BY company, issue_date, id;
