package app

import (
	"context"
	"database/sql"
	"secret-dinner/config"
	"secret-dinner/internal/db"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "app")

type landingApp struct {
	ctx    context.Context
	cancel context.CancelFunc

	cfg config.Config

	connections db.Connections
	server      *fiber.App
	auth        *adminAuthService
	settings    *runtimeAdminSettings
}

func NewLandingApp(ctx context.Context, cfg config.Config) (LandingApplication, error) {
	connection, err := initDB(cfg)
	if err != nil {
		log.Error("Error initializing database connection.")
		return nil, err
	}

	child, cancel := context.WithCancel(ctx)
	settings := newRuntimeAdminSettings(cfg)
	app := &landingApp{
		ctx:         child,
		cancel:      cancel,
		cfg:         cfg,
		connections: connection,
		auth:        newAdminAuthService(cfg.Admin, settings.GetAdminTokenTTLMinutes),
		settings:    settings,
	}
	app.server = app.buildHTTPServer()

	return app, nil
}

func (l *landingApp) Run() error {
	return l.server.Listen(l.cfg.HTTP.ListenAddr)
}

func (l *landingApp) Shutdown() error {
	if l.server != nil {
		if err := l.server.Shutdown(); err != nil {
			return err
		}
	}
	if l.connections.Users != nil {
		if err := l.connections.Users.Close(); err != nil {
			log.WithError(err).Error("Error closing users connection")
			return err
		}
	}
	if l.connections.AdminUsers != nil {
		if err := l.connections.AdminUsers.Close(); err != nil {
			log.WithError(err).Error("Error closing admin users connection")
			return err
		}
	}
	if l.connections.Dinners != nil {
		if err := l.connections.Dinners.Close(); err != nil {
			log.WithError(err).Error("Error closing dinners connection")
			return err
		}
	}
	if l.connections.LandingStats != nil {
		if err := l.connections.LandingStats.Close(); err != nil {
			log.WithError(err).Error("Error closing landing stats connection")
			return err
		}
	}
	if l.connections.TelegramStats != nil {
		if err := l.connections.TelegramStats.Close(); err != nil {
			log.WithError(err).Error("Error closing telegram stats connection")
			return err
		}
	}
	log.Info("Connections closed.")
	return nil
}

func initDB(cfg config.Config) (db.Connections, error) {
	if err := config.RunMigrations(cfg.DB); err != nil {
		return db.Connections{}, err
	}

	connection, err := newConnections(cfg)
	if err != nil {
		return db.Connections{}, err
	}

	return connection, nil
}

func newConnections(cfg config.Config) (db.Connections, error) {
	landingUsersConn, err := openPostgresConnection(cfg.DB.URL)
	if err != nil {
		return db.Connections{}, err
	}

	landingDinnersConn, err := openPostgresConnection(cfg.DB.URL)
	if err != nil {
		landingUsersConn.Close()
		return db.Connections{}, err
	}

	landingStatsConn, err := openPostgresConnection(cfg.DB.URL)
	if err != nil {
		landingUsersConn.Close()
		landingDinnersConn.Close()
		return db.Connections{}, err
	}

	connections := db.Connections{
		Users:        db.NewUsersDB(landingUsersConn),
		AdminUsers:   db.NewAdminUsersDB(landingUsersConn, nil),
		Dinners:      db.NewDinnersDB(landingDinnersConn, nil),
		LandingStats: db.NewLandingStatsDB(landingStatsConn),
	}

	telegramURL := strings.TrimSpace(cfg.DB.TelegramURL)
	if telegramURL != "" {
		telegramDinnersConn, err := openPostgresConnection(telegramURL)
		if err != nil {
			landingUsersConn.Close()
			landingDinnersConn.Close()
			landingStatsConn.Close()
			return db.Connections{}, err
		}
		connections.Dinners = db.NewDinnersDB(landingDinnersConn, telegramDinnersConn)

		telegramStatsConn, err := openPostgresConnection(telegramURL)
		if err != nil {
			landingUsersConn.Close()
			landingDinnersConn.Close()
			landingStatsConn.Close()
			telegramDinnersConn.Close()
			return db.Connections{}, err
		}
		connections.TelegramStats = db.NewTelegramStatsDB(telegramStatsConn)
		connections.AdminUsers = db.NewAdminUsersDB(landingUsersConn, telegramStatsConn)
	}

	return connections, nil
}

func openPostgresConnection(url string) (*sql.DB, error) {
	connection, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}

	if err := connection.Ping(); err != nil {
		connection.Close()
		return nil, err
	}

	return connection, nil
}
