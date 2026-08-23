ALTER TABLE insurance_policies
    ADD COLUMN commission_basis TEXT NOT NULL DEFAULT 'net_premium'
        CHECK (commission_basis IN ('net_premium', 'od_premium')),
    ADD COLUMN commission_percentage NUMERIC(5,2);

CREATE INDEX idx_insurance_policies_issue_date ON insurance_policies (issue_date);
