ALTER TABLE ledgers
    ADD COLUMN total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE ledgers l
SET total_debit = totals.total_debit,
    total_credit = totals.total_credit,
    closing_balance = totals.total_debit - totals.total_credit
FROM (
    SELECT ledger_id,
           COALESCE(SUM(debit), 0)::numeric(14,2) AS total_debit,
           COALESCE(SUM(credit), 0)::numeric(14,2) AS total_credit
    FROM transaction_entries
    GROUP BY ledger_id
) totals
WHERE l.id = totals.ledger_id;

CREATE OR REPLACE FUNCTION update_ledger_cached_balance() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ledgers
        SET total_debit = total_debit + NEW.debit,
            total_credit = total_credit + NEW.credit,
            closing_balance = closing_balance + NEW.debit - NEW.credit
        WHERE id = NEW.ledger_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE ledgers
        SET total_debit = total_debit - OLD.debit,
            total_credit = total_credit - OLD.credit,
            closing_balance = closing_balance - OLD.debit + OLD.credit
        WHERE id = OLD.ledger_id;
    ELSE
        UPDATE ledgers
        SET total_debit = total_debit - OLD.debit,
            total_credit = total_credit - OLD.credit,
            closing_balance = closing_balance - OLD.debit + OLD.credit
        WHERE id = OLD.ledger_id;

        UPDATE ledgers
        SET total_debit = total_debit + NEW.debit,
            total_credit = total_credit + NEW.credit,
            closing_balance = closing_balance + NEW.debit - NEW.credit
        WHERE id = NEW.ledger_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ledger_cached_balance
AFTER INSERT OR UPDATE OR DELETE ON transaction_entries
FOR EACH ROW EXECUTE FUNCTION update_ledger_cached_balance();