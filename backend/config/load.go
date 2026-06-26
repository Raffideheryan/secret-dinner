package config

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/pressly/goose"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "config")

func LoadConfig() (Config, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.WithError(err).Error("Error while loading configs.")
		return Config{}, err
	}

	tokenTTL, err := strconv.Atoi(os.Getenv("ADMIN_TOKEN_TTL_MINUTES"))
	if err != nil || tokenTTL <= 0 {
		tokenTTL = 60
	}

	rawAdminIDs := strings.Trim(os.Getenv("ADMIN_IDS"), " ,")
	adminIDParts := strings.Split(rawAdminIDs, ",")
	adminIDs := make([]int64, 0, len(adminIDParts))
	for _, part := range adminIDParts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, parseErr := strconv.ParseInt(part, 10, 64)
		if parseErr == nil {
			adminIDs = append(adminIDs, id)
		}
	}

	devUserID, err := strconv.ParseInt(strings.TrimSpace(os.Getenv("TELEGRAM_MINI_APP_DEV_USER_ID")), 10, 64)
	if err != nil {
		devUserID = 0
	}

	authMaxAgeSec, err := strconv.ParseInt(strings.TrimSpace(os.Getenv("TELEGRAM_INIT_DATA_MAX_AGE_SEC")), 10, 64)
	if err != nil || authMaxAgeSec <= 0 {
		authMaxAgeSec = 24 * 60 * 60
	}

	cookieSecure, err := strconv.ParseBool(os.Getenv("ADMIN_COOKIE_SECURE"))
	if err != nil {
		cookieSecure = false
	}

	authSecret := os.Getenv("ADMIN_AUTH_SECRET")
	if authSecret == "" {
		if !isExplicitLocalDevMode() {
			return Config{}, errors.New("ADMIN_AUTH_SECRET is required unless LOCAL_DEV_MODE=true")
		}

		authSecret, err = randomHex(32)
		if err != nil {
			return Config{}, err
		}
		log.Warn("ADMIN_AUTH_SECRET is empty; generated ephemeral auth secret for explicit local dev mode")
	}

	listenAddr := os.Getenv("BACKEND_LISTEN_ADDR")
	if listenAddr == "" {
		if port := os.Getenv("PORT"); port != "" {
			listenAddr = ":" + port
		} else {
			listenAddr = ":8080"
		}
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
		Telegram: TelegramConfig{
			BotToken:      strings.TrimSpace(os.Getenv("TELEGRAM_TOKEN")),
			BotUsername:   strings.TrimSpace(os.Getenv("TELEGRAM_BOT_USERNAME")),
			AdminIDs:      adminIDs,
			DevUserID:     devUserID,
			AuthMaxAgeSec: authMaxAgeSec,
		},
	}

	log.WithFields(logrus.Fields{
		"has_database_url":          strings.TrimSpace(cfg.DB.URL) != "",
		"has_telegram_database_url": strings.TrimSpace(cfg.DB.TelegramURL) != "",
		"migrations_path_set":       strings.TrimSpace(cfg.DB.MigrationsPath) != "",
		"admin_username_set":        strings.TrimSpace(cfg.Admin.Username) != "",
		"admin_password_set":        strings.TrimSpace(cfg.Admin.Password) != "",
		"admin_auth_secret_set":     strings.TrimSpace(cfg.Admin.AuthSecret) != "",
		"listen_addr":               cfg.HTTP.ListenAddr,
		"frontend_origin":           cfg.HTTP.FrontendOrigin,
		"telegram_bot_token_set":    strings.TrimSpace(cfg.Telegram.BotToken) != "",
		"telegram_bot_username_set": strings.TrimSpace(cfg.Telegram.BotUsername) != "",
		"telegram_admin_ids_count":  len(cfg.Telegram.AdminIDs),
		"telegram_dev_user_id_set":  cfg.Telegram.DevUserID > 0,
		"telegram_auth_max_age_sec": cfg.Telegram.AuthMaxAgeSec,
		"local_dev_mode":            isExplicitLocalDevMode(),
	}).Info("Configs loaded successfully.")

	return cfg, nil
}

func isExplicitLocalDevMode() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("LOCAL_DEV_MODE")))
	return value == "1" || value == "true" || value == "yes"
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
