-- name: CreateSession :one
INSERT INTO sessions (token, expires_at) VALUES ($1, $2) RETURNING *;

-- name: GetValidSession :one
SELECT * FROM sessions WHERE token = $1 AND expires_at > now();

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= now();
