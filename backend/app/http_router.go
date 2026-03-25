package app

import (
	"secret-dinner/routes"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func (l *landingApp) buildHTTPServer() *fiber.App {
	app := fiber.New(fiber.Config{
		ServerHeader: "Secret Dinner",
		AppName:      "Secret Dinner Landing",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     l.cfg.HTTP.FrontendOrigin,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))
	app.Use(securityHeadersMiddleware(l.cfg.Admin.CookieSecure))

	l.registerAPIRoutes(app)
	return app
}

func (l *landingApp) registerAPIRoutes(app *fiber.App) {
	limiter := newLoginRateLimiter(defaultAdminLoginPerMinute, time.Minute, l.settings.GetAdminLoginPerMinute)
	joinFormLimiter := newIPRateLimiter(
		defaultJoinFormPer20MinByIP,
		20*time.Minute,
		"too many join form requests",
		l.settings.GetJoinFormPer20MinByIP,
	)
	joinSelectionLimiter := newIPRateLimiter(
		defaultJoinSelectionPer20MinByIP,
		20*time.Minute,
		"too many join selection requests",
		l.settings.GetJoinSelectionPer20MinByIP,
	)

	api := app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})
	api.Post("/user/join", l.joinApplicationsGuard(), joinFormLimiter.middleware(), routes.HandleJoin(l.connections.Users, l.settings))
	api.Post("/user/join/selection", l.joinSelectionsGuard(), joinSelectionLimiter.middleware(), routes.HandleJoinSelection(l.connections.Users, l.connections.Dinners))
	api.Get("/dinners/info", routes.GetDinners(l.connections.Dinners))

	admin := api.Group("/admin")
	admin.Post("/login", limiter.middleware(), l.loginHandler(limiter))
	admin.Post("/logout", l.requireAdmin(), l.logoutHandler())
	admin.Get("/me", l.requireAdmin(), l.meHandler())
	admin.Get("/panel", l.requireAdmin(), l.panelHandler())
	admin.Put("/settings", l.requireAdmin(), l.updateSettingsHandler())
	admin.Get("/users/landing", l.requireAdmin(), l.listAdminLandingUsersHandler())
	admin.Put("/users/landing/:id/status", l.requireAdmin(), l.updateAdminLandingUserStatusHandler())
	admin.Get("/users/telegram", l.requireAdmin(), l.listAdminTelegramUsersHandler())
	admin.Get("/dinners", l.requireAdmin(), l.listAdminDinnersHandler())
	admin.Post("/dinners", l.requireAdmin(), l.createAdminDinnerHandler())
	admin.Put("/dinners/:id", l.requireAdmin(), l.updateAdminDinnerHandler())
	admin.Delete("/dinners/:id", l.requireAdmin(), l.deleteAdminDinnerHandler())
	admin.Post("/dinners/sync", l.requireAdmin(), l.syncAdminDinnersHandler())

}

func (l *landingApp) joinApplicationsGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.settings.MaintenanceMode() {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   true,
				"message": "Service is under maintenance",
			})
		}
		if !l.settings.AllowJoinApplications() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   true,
				"message": "Join applications are temporarily disabled",
			})
		}
		return c.Next()
	}
}

func (l *landingApp) joinSelectionsGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.settings.MaintenanceMode() {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error":   true,
				"message": "Service is under maintenance",
			})
		}
		if !l.settings.AllowJoinSelections() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   true,
				"message": "Dinner selections are temporarily disabled",
			})
		}
		return c.Next()
	}
}
