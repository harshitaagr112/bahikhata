-- name: CreateAuditLog :one
INSERT INTO audit_log (entity_type, entity_id, action, before_snapshot, after_snapshot)
VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListAuditLogForEntity :many
SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC;
