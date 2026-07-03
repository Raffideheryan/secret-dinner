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
		AllowHeaders:     "Content-Type, Authorization, X-Telegram-Init-Data, X-Telegram-Dev-User",
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
	telegramMiniLimiter := newIPRateLimiter(
		120,
		time.Minute,
		"too many telegram mini app requests",
		nil,
	)
	telegramMiniApplicationLimiter := newIPRateLimiter(
		8,
		5*time.Minute,
		"too many telegram mini app booking attempts",
		nil,
	)

	api := app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true})
	})
	api.Post("/activity/events", l.storeUserActivityEventsHandler())
	api.Post("/user/join", l.joinApplicationsGuard(), joinFormLimiter.middleware(), routes.HandleJoin(l.connections.Users, l.settings))
	api.Post("/user/join/selection", l.joinSelectionsGuard(), joinSelectionLimiter.middleware(), routes.HandleJoinSelection(l.connections.Users, l.connections.Dinners))
	api.Get("/dinners/info", routes.GetDinners(l.connections.Dinners))

	telegramMini := api.Group("/telegram-mini", telegramMiniLimiter.middleware(), l.miniAuth.middleware(l.connections.TelegramMini))
	telegramMini.Get("/health", l.telegramMiniHealthHandler())
	telegramMini.Get("/bootstrap", l.telegramMiniBootstrapHandler())
	telegramMini.Get("/applications", l.telegramMiniApplicationsHandler())
	telegramMini.Post("/applications/:id/cancel", l.telegramMiniCancelApplicationHandler())
	telegramMini.Patch("/profile", l.telegramMiniProfileUpdateHandler())
	telegramMini.Get("/custom-menu/types", l.telegramMiniCustomMenuTypesHandler())
	telegramMini.Get("/custom-menu/items", l.telegramMiniCustomMenuItemsHandler())
	telegramMini.Post("/applications", telegramMiniApplicationLimiter.middleware(), l.telegramMiniCreateApplicationHandler())
	telegramMini.Post("/support", l.telegramMiniSupportHandler())
	telegramMini.Get("/game/progress", l.telegramMiniGameProgressGetHandler())
	telegramMini.Post("/game/progress", l.telegramMiniGameProgressSaveHandler())
	telegramMini.Post("/game/progress/save", l.telegramMiniGameProgressSaveHandler())
	telegramMini.Post("/game/convert", l.telegramMiniGameConvertHandler())
	telegramMini.Post("/game/points/convert", l.telegramMiniGameConvertHandler())
	telegramMini.Post("/game/reward/claim", l.telegramMiniGameRewardClaimHandler())
	telegramMini.Get("/game/leaderboard", l.telegramMiniGameLeaderboardHandler())

	admin := api.Group("/admin")
	admin.Post("/login", limiter.middleware(), l.loginHandler(limiter))
	admin.Post("/logout", l.requireAdmin(), l.logoutHandler())
	admin.Get("/me", l.requireAdmin(), l.meHandler())
	admin.Get("/panel", l.requireAdmin(), l.panelHandler())
	admin.Put("/settings", l.requireAdmin(), l.updateSettingsHandler())
	admin.Get("/users/landing", l.requireAdmin(), l.listAdminLandingUsersHandler())
	admin.Put("/users/landing/:id/status", l.requireAdmin(), l.updateAdminLandingUserStatusHandler())
	admin.Get("/users/telegram", l.requireAdmin(), l.listAdminTelegramUsersHandler())
	admin.Get("/applications/telegram", l.requireAdmin(), l.listAdminTelegramApplicationsHandler())
	admin.Put("/applications/telegram/:id", l.requireAdmin(), l.updateAdminTelegramApplicationHandler())
	admin.Get("/engagement/analytics", l.requireAdmin(), l.getEngagementAnalyticsHandler())
	admin.Get("/engagement/users", l.requireAdmin(), l.listEngagementUsersHandler())
	admin.Get("/engagement/users/:source/:id", l.requireAdmin(), l.getEngagementUserProfileHandler())
	admin.Get("/engagement/users/:source/:id/events", l.requireAdmin(), l.listEngagementUserEventsHandler())
	admin.Post("/engagement/users/:source/:id/tags", l.requireAdmin(), l.addUserTagHandler())
	admin.Delete("/engagement/users/:source/:id/tags/:tag", l.requireAdmin(), l.removeUserTagHandler())
	admin.Post("/engagement/users/:source/:id/notes", l.requireAdmin(), l.addUserNoteHandler())
	admin.Delete("/engagement/users/:source/:id/notes/:noteId", l.requireAdmin(), l.deleteUserNoteHandler())
	admin.Get("/engagement/campaigns/options", l.requireAdmin(), l.getEngagementCampaignOptionsHandler())
	admin.Get("/engagement/campaigns", l.requireAdmin(), l.listEngagementCampaignsHandler())
	admin.Post("/engagement/campaigns", l.requireAdmin(), l.createEngagementCampaignHandler())
	admin.Get("/engagement/campaigns/:id", l.requireAdmin(), l.getEngagementCampaignHandler())
	admin.Put("/engagement/campaigns/:id", l.requireAdmin(), l.updateEngagementCampaignHandler())
	admin.Post("/engagement/campaigns/:id/schedule", l.requireAdmin(), l.scheduleEngagementCampaignHandler())
	admin.Post("/engagement/campaigns/:id/cancel", l.requireAdmin(), l.cancelEngagementCampaignHandler())
	admin.Post("/engagement/campaigns/:id/test-send", l.requireAdmin(), l.testSendEngagementCampaignHandler())
	admin.Get("/engagement/campaigns/:id/logs", l.requireAdmin(), l.listEngagementCampaignLogsHandler())
	admin.Get("/segments", l.requireAdmin(), l.getSmartSegmentsHandler())
	admin.Get("/recommendations", l.requireAdmin(), l.getAdminRecommendationsHandler())
	admin.Get("/audit-logs", l.requireAdmin(), l.listAdminAuditLogsHandler())
	admin.Get("/dinners", l.requireAdmin(), l.listAdminDinnersHandler())
	admin.Post("/dinners", l.requireAdmin(), l.createAdminDinnerHandler())
	admin.Put("/dinners/:id", l.requireAdmin(), l.updateAdminDinnerHandler())
	admin.Delete("/dinners/:id", l.requireAdmin(), l.deleteAdminDinnerHandler())
	admin.Post("/dinners/sync", l.requireAdmin(), l.syncAdminDinnersHandler())
	admin.Get("/dishes/types", l.requireAdmin(), l.listAdminDishTypesHandler())
	admin.Get("/dishes", l.requireAdmin(), l.listAdminDishesHandler())
	admin.Post("/dishes", l.requireAdmin(), l.createAdminDishHandler())
	admin.Put("/dishes/:id", l.requireAdmin(), l.updateAdminDishHandler())
	admin.Delete("/dishes/:id", l.requireAdmin(), l.deleteAdminDishHandler())

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
