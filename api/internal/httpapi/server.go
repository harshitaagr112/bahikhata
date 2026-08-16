package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"tally-api/internal/db"
)

type Server struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	router  chi.Router
}

func NewServer(pool *pgxpool.Pool) *Server {
	s := &Server{
		pool:    pool,
		queries: db.New(pool),
	}
	s.router = s.routes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.router.ServeHTTP(w, r)
}

func (s *Server) routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api/ledgers", func(r chi.Router) {
		r.Get("/", s.searchLedgers)
		r.Post("/", s.createLedger)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", s.getLedger)
			r.Put("/", s.updateLedger)
			r.Delete("/", s.deleteLedger)
			r.Get("/mobile-numbers", s.listLedgerMobileNumbers)
			r.Post("/mobile-numbers", s.addLedgerMobileNumber)
			r.Get("/statement", s.ledgerStatement)
			r.Get("/balance", s.ledgerBalance)
			r.Post("/merge", s.mergeLedger)
		})
	})

	r.Route("/api/transactions", func(r chi.Router) {
		r.Post("/", s.createTransaction)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", s.getTransaction)
			r.Put("/", s.updateTransaction)
			r.Delete("/", s.deleteTransaction)
		})
	})

	r.Get("/api/daybook", s.daybook)
	r.Get("/api/outstanding", s.outstanding)

	return r
}
