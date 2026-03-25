package config

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/pressly/goose"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "config")

func LoadConfig() (Config, error) {
	if err := godotenv.Load(); err != nil {
		log.WithError(err).Error("Error while loading configs.")
		return Config{}, err
	}

	tokenTTL, err := strconv.Atoi(os.Getenv("ADMIN_TOKEN_TTL_MINUTES"))
	if err != nil || tokenTTL <= 0 {
		tokenTTL = 60
	}

	cookieSecure, err := strconv.ParseBool(os.Getenv("ADMIN_COOKIE_SECURE"))
	if err != nil {
		cookieSecure = false
	}

	authSecret := os.Getenv("ADMIN_AUTH_SECRET")
	if authSecret == "" {
		authSecret, err = randomHex(32)
		if err != nil {
			return Config{}, err
		}
		log.Warn("ADMIN_AUTH_SECRET is empty, generated ephemeral auth secret for this process")
	}

	listenAddr := os.Getenv("BACKEND_LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":8080"
	}

	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:5173"
	}

	cfg := Config{
		DB: DBConfig{
			URL:            os.Getenv("DATABASE_URL"),
			TelegramURL:    os.Getenv("TELEGRAM_DATABASE_URL"),
			MigrationsPath: os.Getenv("MIGRATIONS_PATH"),
		},
		Admin: AdminConfig{
			Username:     valueOrDefault(os.Getenv("ADMIN_USERNAME"), "admin"),
			Password:     valueOrDefault(os.Getenv("ADMIN_PASSWORD"), "change-me"),
			AuthSecret:   authSecret,
			CookieName:   valueOrDefault(os.Getenv("ADMIN_COOKIE_NAME"), "admin_session"),
			CookieSecure: cookieSecure,
			TokenTTLMin:  tokenTTL,
		},
		HTTP: HTTPConfig{
			ListenAddr:     listenAddr,
			FrontendOrigin: frontendOrigin,
		},
	}

	log.Info("Configs loaded successfully.")
	log.Warn(cfg)

	return cfg, nil
}

func valueOrDefault(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func randomHex(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func RunMigrations(cfg DBConfig) error {
	db, err := sql.Open("postgres", cfg.URL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return err
	}

	if err := goose.Up(db, cfg.MigrationsPath); err != nil {
		log.WithError(err).Error("Error while running migrations.")
		return err
	}

	log.Info("Migrations applied success...")
	return nil
}
