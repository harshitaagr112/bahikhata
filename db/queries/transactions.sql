-- name: CreateTransaction :one
INSERT INTO transactions (type, txn_date, narration) VALUES ($1, $2, $3) RETURNING *;

-- name: GetTransaction :one
SELECT * FROM transactions WHERE id = $1;

-- name: UpdateTransaction :one
UPDATE transactions SET type = $2, txn_date = $3, narration = $4, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: DeleteTransaction :exec
DELETE FROM transactions WHERE id = $1;

-- name: CreateTransactionEntry :one
INSERT INTO transaction_entries (transaction_id, ledger_id, debit, credit)
VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListTransactionEntries :many
SELECT * FROM transaction_entries WHERE transaction_id = $1 ORDER BY id;

-- name: ListTransactionEntriesWithLedgerNames :many
SELECT te.id, te.transaction_id, te.ledger_id, te.debit, te.credit, l.name AS ledger_name
FROM transaction_entries te
JOIN ledgers l ON l.id = te.ledger_id
WHERE te.transaction_id = $1
ORDER BY te.id;

-- name: ListTransactionEntriesWithLedgerNamesForTransactions :many
SELECT te.id, te.transaction_id, te.ledger_id, te.debit, te.credit, l.name AS ledger_name
FROM transaction_entries te
JOIN ledgers l ON l.id = te.ledger_id
WHERE te.transaction_id = ANY($1::bigint[])
ORDER BY te.transaction_id, te.id;

-- name: DeleteTransactionEntries :exec
DELETE FROM transaction_entries WHERE transaction_id = $1;

-- name: ListDaybook :many
SELECT id, type, txn_date, narration, created_at, updated_at
FROM transactions
WHERE txn_date BETWEEN $1 AND $2
ORDER BY txn_date DESC, id DESC
LIMIT $3 OFFSET $4;

-- name: LedgerStatement :many
SELECT te.id AS entry_id, t.id AS transaction_id, t.txn_date, t.type, t.narration,
    te.debit, te.credit,
    (SELECT COALESCE(json_agg(json_build_object('ledger_id', l2.id, 'name', l2.name) ORDER BY l2.name), '[]')
        FROM transaction_entries te2
        JOIN ledgers l2 ON l2.id = te2.ledger_id
        WHERE te2.transaction_id = t.id AND te2.ledger_id <> te.ledger_id)::text AS counterparties
FROM transaction_entries te
JOIN transactions t ON t.id = te.transaction_id
WHERE te.ledger_id = $1 AND t.txn_date BETWEEN $2 AND $3
ORDER BY t.txn_date ASC, t.id ASC;

-- name: MoveLedgerEntries :exec
UPDATE transaction_entries SET ledger_id = $2 WHERE ledger_id = $1;

-- name: LedgerBalanceBefore :one
SELECT (COALESCE(SUM(te.debit), 0) - COALESCE(SUM(te.credit), 0))::numeric AS balance
FROM transaction_entries te
JOIN transactions t ON t.id = te.transaction_id
WHERE te.ledger_id = $1 AND t.txn_date < $2;

-- name: LedgerBalance :one
SELECT total_debit, total_credit, closing_balance
FROM ledgers WHERE id = $1;

-- name: OutstandingLedgers :many
SELECT l.id, l.name, l.type,
    (COALESCE(SUM(te.debit), 0) - COALESCE(SUM(te.credit), 0))::numeric AS balance
FROM ledgers l
JOIN transaction_entries te ON te.ledger_id = l.id
WHERE l.type IN ('customer', 'limit') AND l.merged_into_id IS NULL
GROUP BY l.id, l.name, l.type
HAVING (COALESCE(SUM(te.debit), 0) - COALESCE(SUM(te.credit), 0)) <> 0
ORDER BY l.name;
