package httpapi

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"

	"tally-api/internal/db"
)

const sessionCookieName = "session"
const sessionTTL = 30 * 24 * time.Hour

func generateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// login implements the single-shared-credential model (docs/DECISIONS.md
// item 17): one username/password for the whole agency, session cookie —
// explicitly not JWT, since there's exactly one credential set and nothing
// JWT is good for (per-user claims, stateless multi-service auth) applies.
func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	usernameOK := subtle.ConstantTimeCompare([]byte(req.Username), []byte(s.cfg.AuthUsername)) == 1
	passwordOK := bcrypt.CompareHashAndPassword([]byte(s.cfg.AuthPasswordHash), []byte(req.Password)) == nil
	if !usernameOK || !passwordOK {
		writeError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	token, err := generateSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	expiresAt := time.Now().Add(sessionTTL)
	if _, err := s.queries.CreateSession(r.Context(), db.CreateSessionParams{
		Token:     token,
		ExpiresAt: pgtypeTimestamptz(expiresAt),
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
	})

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		_ = s.queries.DeleteSession(r.Context(), cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	authenticated := s.isAuthenticated(r)
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": authenticated})
}

func (s *Server) isAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return false
	}
	_, err = s.queries.GetValidSession(r.Context(), cookie.Value)
	return err == nil
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.isAuthenticated(r) {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		next.ServeHTTP(w, r)
	})
}
