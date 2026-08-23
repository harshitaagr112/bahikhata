DROP INDEX IF EXISTS idx_insurance_policies_issue_date;

ALTER TABLE insurance_policies
    DROP COLUMN IF EXISTS commission_percentage,
    DROP COLUMN IF EXISTS commission_basis;
