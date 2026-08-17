package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL      string
	Port             string
	AuthUsername     string
	AuthPasswordHash string
}

func Load() Config {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	return Config{
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		Port:             port,
		AuthUsername:     os.Getenv("AUTH_USERNAME"),
		AuthPasswordHash: os.Getenv("AUTH_PASSWORD_HASH"),
	}
}
