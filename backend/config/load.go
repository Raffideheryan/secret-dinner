package config

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
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
	if err := runGooseMigrations(cfg.URL, cfg.MigrationsPath, "landing", nil); err != nil {
		return err
	}

	telegramURL := strings.TrimSpace(cfg.TelegramURL)
	if telegramURL == "" {
		return nil
	}

	// Audited July 3, 2026: the Telegram DB only needs the game schema subset.
	// The rest of the files in internal/db/migrations target landing/admin tables
	// and should not be applied to the Telegram database.
	telegramGameMigrations := map[string]struct{}{
		"20260629120000_game_progress.sql":       {},
		"20260702120000_game_level_progress.sql": {},
	}

	return runGooseMigrations(telegramURL, cfg.MigrationsPath, "telegram", telegramGameMigrations)
}

func runGooseMigrations(databaseURL, migrationsPath, label string, allowed map[string]struct{}) error {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return err
	}

	pathToRun := migrationsPath
	cleanup := func() error { return nil }
	if allowed != nil {
		pathToRun, cleanup, err = buildSubsetMigrationDir(migrationsPath, allowed)
		if err != nil {
			return err
		}
	}
	defer func() {
		if err := cleanup(); err != nil {
			log.WithError(err).Warn("Failed to clean temporary migration directory")
		}
	}()

	log.WithFields(logrus.Fields{
		"target":           label,
		"database_url_set": strings.TrimSpace(databaseURL) != "",
		"migrations_path":  pathToRun,
	}).Info("Running migrations...")

	if err := goose.Up(db, pathToRun); err != nil {
		log.WithError(err).WithField("target", label).Error("Error while running migrations.")
		return err
	}

	log.WithField("target", label).Info("Migrations applied success...")
	return nil
}

func buildSubsetMigrationDir(sourceDir string, allowed map[string]struct{}) (string, func() error, error) {
	entries, err := os.ReadDir(sourceDir)
	if err != nil {
		return "", nil, err
	}

	tempDir, err := os.MkdirTemp("", "secret-dinner-goose-*")
	if err != nil {
		return "", nil, err
	}

	cleanup := func() error {
		return os.RemoveAll(tempDir)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if _, ok := allowed[name]; !ok {
			continue
		}

		src := filepath.Join(sourceDir, name)
		dst := filepath.Join(tempDir, name)
		if err := copyFile(src, dst); err != nil {
			_ = cleanup()
			return "", nil, fmt.Errorf("copy migration %s: %w", name, err)
		}
	}

	return tempDir, cleanup, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
	}()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
