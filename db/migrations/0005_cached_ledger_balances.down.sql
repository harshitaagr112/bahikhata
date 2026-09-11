DROP TRIGGER IF EXISTS trg_update_ledger_cached_balance ON transaction_entries;
DROP FUNCTION IF EXISTS update_ledger_cached_balance();

ALTER TABLE ledgers
    DROP COLUMN IF EXISTS total_debit,
    DROP COLUMN IF EXISTS total_credit,
    DROP COLUMN IF EXISTS closing_balance;