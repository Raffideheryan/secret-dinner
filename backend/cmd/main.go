package main

import (
	"context"
	"os"
	"os/signal"
	"secret-dinner/app"
	"secret-dinner/config"
	"syscall"

	"github.com/sirupsen/logrus"
)

func init() {
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:    true,
		DisableTimestamp: false,
	})
}

var log = logrus.WithField("package", "main")

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg, err := config.LoadConfig()
	if err != nil {
		log.WithError(err).Error("Error loading config")
		return
	}

	app, err := app.NewLandingApp(ctx, cfg)
	if err != nil {
		log.WithError(err).Error("Error initializing app")
		return
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {

		if err := app.Run(); err != nil {
			log.WithError(err).Error("Error running application.")
			return
		}
	}()

	sig := <-sigChan
	log.Warn("Received shutdown signal...")
	if err := app.Shutdown(); err != nil {
		log.WithError(err).Error("Error shutting down")
		return
	}

	log.Infof("Application stopped. | %s", sig)
	log.Info("SHutdown complete...")

}
