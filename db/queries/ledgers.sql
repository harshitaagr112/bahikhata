-- name: CreateLedger :one
INSERT INTO ledgers (name, type, c_o, address) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: GetLedger :one
SELECT * FROM ledgers WHERE id = $1;

-- name: GetOpeningBalanceLedger :one
SELECT * FROM ledgers WHERE is_system = TRUE LIMIT 1;

-- name: SearchLedgers :many
SELECT DISTINCT l.*,
    (SELECT string_agg(m2.number, ', ' ORDER BY m2.added_at DESC)
        FROM ledger_mobile_numbers m2 WHERE m2.ledger_id = l.id) AS mobile_numbers
FROM ledgers l
LEFT JOIN ledger_mobile_numbers m ON m.ledger_id = l.id
WHERE l.merged_into_id IS NULL AND (
    l.name ILIKE '%' || $1 || '%' OR
    l.address ILIKE '%' || $1 || '%' OR
    l.c_o ILIKE '%' || $1 || '%' OR
    m.number ILIKE '%' || $1 || '%'
)
AND (sqlc.narg('types')::text[] IS NULL OR l.type::text = ANY(sqlc.narg('types')::text[]))
ORDER BY l.name
LIMIT $2 OFFSET $3;

-- name: UpdateLedger :one
UPDATE ledgers SET name = $2, c_o = $3, address = $4, type = $5, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: LedgerHasTransactions :one
SELECT EXISTS(SELECT 1 FROM transaction_entries WHERE ledger_id = $1);

-- name: DeleteLedgerIfUnused :execrows
DELETE FROM ledgers AS lg WHERE lg.id = $1
    AND NOT EXISTS (SELECT 1 FROM transaction_entries te WHERE te.ledger_id = $1);

-- name: AddLedgerMobileNumber :one
INSERT INTO ledger_mobile_numbers (ledger_id, number) VALUES ($1, $2) RETURNING *;

-- name: ListLedgerMobileNumbers :many
SELECT * FROM ledger_mobile_numbers WHERE ledger_id = $1 ORDER BY added_at DESC;

-- name: LatestMobileNumbersForLedgers :many
SELECT DISTINCT ON (ledger_id) ledger_id, number
FROM ledger_mobile_numbers
WHERE ledger_id = ANY($1::bigint[])
ORDER BY ledger_id, added_at DESC;

-- name: MergeLedger :exec
UPDATE ledgers SET merged_into_id = $2, updated_at = now() WHERE id = $1;

-- name: ResolveLedgerMergeTarget :one
WITH RECURSIVE chain AS (
    SELECT l.id AS id, l.merged_into_id AS merged_into_id FROM ledgers l WHERE l.id = $1
    UNION ALL
    SELECT l2.id AS id, l2.merged_into_id AS merged_into_id FROM ledgers l2 JOIN chain c ON l2.id = c.merged_into_id
)
SELECT c.id FROM chain c WHERE c.merged_into_id IS NULL LIMIT 1;
