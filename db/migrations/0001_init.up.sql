CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE ledger_type AS ENUM ('cash','bank','limit','customer','income','expense','discount','other');
CREATE TYPE transaction_type AS ENUM ('payment','receipt','discount','income','journal');
CREATE TYPE audit_action AS ENUM ('created','edited','deleted','merged','imported');

CREATE TABLE ledgers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type ledger_type NOT NULL,
    c_o TEXT,
    address TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    merged_into_id BIGINT REFERENCES ledgers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledgers_name_trgm ON ledgers USING gin (name gin_trgm_ops);
CREATE INDEX idx_ledgers_address_trgm ON ledgers USING gin (address gin_trgm_ops);
CREATE INDEX idx_ledgers_co_trgm ON ledgers USING gin (c_o gin_trgm_ops);
CREATE INDEX idx_ledgers_type ON ledgers (type);
CREATE INDEX idx_ledgers_merged_into ON ledgers (merged_into_id);

CREATE TABLE ledger_mobile_numbers (
    id BIGSERIAL PRIMARY KEY,
    ledger_id BIGINT NOT NULL REFERENCES ledgers(id),
    number TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_mobile_numbers_number ON ledger_mobile_numbers (number);
CREATE INDEX idx_ledger_mobile_numbers_ledger ON ledger_mobile_numbers (ledger_id);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    type transaction_type NOT NULL,
    txn_date DATE NOT NULL,
    narration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_date ON transactions (txn_date);

CREATE TABLE transaction_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    ledger_id BIGINT NOT NULL REFERENCES ledgers(id),
    debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX idx_transaction_entries_ledger ON transaction_entries (ledger_id);
CREATE INDEX idx_transaction_entries_txn ON transaction_entries (transaction_id);

-- Every transaction's entries must sum debit = credit. Deferred so a multi-row
-- insert (one transaction, several entries) can be built up within a single
-- DB transaction before the check runs at commit.
CREATE OR REPLACE FUNCTION check_transaction_balanced() RETURNS TRIGGER AS $$
DECLARE
    txn_id BIGINT;
    total_debit NUMERIC(14,2);
    total_credit NUMERIC(14,2);
BEGIN
    txn_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
        INTO total_debit, total_credit
        FROM transaction_entries WHERE transaction_id = txn_id;
    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'transaction % is not balanced: debit=%, credit=%', txn_id, total_debit, total_credit;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_transaction_entries_balanced
    AFTER INSERT OR UPDATE OR DELETE ON transaction_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_transaction_balanced();

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id BIGINT NOT NULL,
    action audit_action NOT NULL,
    before_snapshot JSONB,
    after_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);

-- System ledger that opening-balance entries post against (Q10).
INSERT INTO ledgers (name, type, is_system) VALUES ('Opening Balance', 'other', TRUE);
