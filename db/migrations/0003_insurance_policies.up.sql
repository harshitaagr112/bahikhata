CREATE TABLE insurance_policies (
    id BIGSERIAL PRIMARY KEY,
    ledger_id BIGINT REFERENCES ledgers(id),
    insured_name TEXT NOT NULL,
    location TEXT,
    mobile_no TEXT,
    payment_mode TEXT,
    company TEXT NOT NULL,
    vehicle_category TEXT,
    vehicle_model TEXT,
    registration_no TEXT,
    policy_no TEXT,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    sum_assured TEXT,
    od_premium TEXT,
    net_premium NUMERIC(14,2) NOT NULL,
    total_premium NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insurance_policies_ledger ON insurance_policies (ledger_id);
CREATE INDEX idx_insurance_policies_expiry ON insurance_policies (expiry_date);
CREATE INDEX idx_insurance_policies_company ON insurance_policies (company);
CREATE INDEX idx_insurance_policies_mobile ON insurance_policies (mobile_no);
