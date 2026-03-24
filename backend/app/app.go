package app

import (
	"context"
	"database/sql"
	"secret-dinner/config"
	"secret-dinner/internal/db"

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
}

func NewLandingApp(ctx context.Context, cfg config.Config) (LandingApplication, error) {
	connection, err := initDB(cfg)
	if err != nil {
		log.Error("Error initializing database connection.")
		return nil, err
	}

	child, cancel := context.WithCancel(ctx)
	app := &landingApp{
		ctx:         child,
		cancel:      cancel,
		cfg:         cfg,
		connections: connection,
		auth:        newAdminAuthService(cfg.Admin),
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
	if l.connections.Dinners != nil {
		if err := l.connections.Dinners.Close(); err != nil {
			log.WithError(err).Error("Error closing dinners connection")
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
	connection, err := sql.Open("postgres", cfg.DB.URL)
	if err != nil {
		return db.Connections{}, err
	}

	if err := connection.Ping(); err != nil {
		connection.Close()
		return db.Connections{}, err
	}

	return db.Connections{
		Users:   db.NewUsersDB(connection),
		Dinners: db.NewDinnersDB(connection),
	}, nil
}
