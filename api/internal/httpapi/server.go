package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"tally-api/internal/config"
	"tally-api/internal/db"
)

type Server struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	router  chi.Router
	cfg     config.Config
}

func NewServer(pool *pgxpool.Pool, cfg config.Config) *Server {
	s := &Server{
		pool:    pool,
		queries: db.New(pool),
		cfg:     cfg,
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

	r.Post("/api/login", s.login)
	r.Post("/api/logout", s.logout)
	r.Get("/api/me", s.me)

	r.Group(func(r chi.Router) {
		r.Use(s.requireAuth)

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
				r.Get("/statement/pdf", s.ledgerStatementPDF)
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
		r.Get("/api/daybook/pdf", s.daybookPDF)
		r.Get("/api/outstanding", s.outstanding)
		r.Get("/api/outstanding/pdf", s.outstandingPDF)

		r.Route("/api/insurance-policies", func(r chi.Router) {
			r.Get("/", s.listInsurancePolicies)
			r.Post("/", s.createInsurancePolicy)
			r.Get("/companies", s.listInsuranceCompanies)
			r.Get("/vehicle-categories", s.listInsuranceVehicleCategories)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", s.getInsurancePolicy)
				r.Put("/", s.updateInsurancePolicy)
				r.Delete("/", s.deleteInsurancePolicy)
			})
		})
		r.Get("/api/insurance/renewals", s.insuranceRenewals)
		r.Get("/api/insurance/renewals/pdf", s.insuranceRenewalsPDF)
		r.Get("/api/insurance/commission-payouts", s.insuranceCommissionPayouts)
		r.Get("/api/insurance/commission-payouts/pdf", s.insuranceCommissionPayoutsPDF)
	})

	return r
}
