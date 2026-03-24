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
		AllowMethods:     "GET,POST,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))
	app.Use(securityHeadersMiddleware(l.cfg.Admin.CookieSecure))

	l.registerAPIRoutes(app)
	return app
}

func (l *landingApp) registerAPIRoutes(app *fiber.App) {
	limiter := newLoginRateLimiter(10, time.Minute)

	api := app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})
	api.Post("/user/join", routes.HandleJoin(l.connections.Users))
	api.Get("/dinners/info", routes.GetDinners(l.connections.Dinners))

	admin := api.Group("/admin")
	admin.Post("/login", limiter.middleware(), l.loginHandler(limiter))
	admin.Post("/logout", l.requireAdmin(), l.logoutHandler())
	admin.Get("/me", l.requireAdmin(), l.meHandler())
	admin.Get("/panel", l.requireAdmin(), l.panelHandler())

}
