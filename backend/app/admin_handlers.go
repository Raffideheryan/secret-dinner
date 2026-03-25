package app

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

func (l *landingApp) loginHandler(limiter *loginRateLimiter) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req loginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		if !l.auth.validateCredentials(req.Username, req.Password) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid credentials",
			})
		}

		limiter.reset(c.IP())

		token, expiresAt, err := l.auth.issueToken()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "could not create session",
			})
		}

		l.setAdminSessionCookie(c, token, expiresAt)

		return c.JSON(fiber.Map{
			"ok":        true,
			"name":      "admin",
			"expiresAt": expiresAt.UTC().Format(time.RFC3339),
		})
	}
}

func (l *landingApp) logoutHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		l.clearAdminSessionCookie(c)
		return c.JSON(fiber.Map{"ok": true})
	}
}

func (l *landingApp) meHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		return c.JSON(fiber.Map{
			"ok":       true,
			"username": username,
			"name":     "admin",
		})
	}
}

func (l *landingApp) panelHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		username, _ := c.Locals(adminUsernameLocalsKey).(string)

		landingStats, err := l.connections.LandingStats.GetAdminStats()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch admin stats",
			})
		}

		telegram := fiber.Map{
			"enabled":   false,
			"available": false,
		}

		if l.connections.TelegramStats != nil {
			telegramStats, err := l.connections.TelegramStats.GetAdminStats()
			if err != nil {
				log.WithError(err).Warn("Failed to fetch telegram stats for admin panel")
				telegram = fiber.Map{
					"enabled":   true,
					"available": false,
					"error":     "failed to fetch telegram stats",
				}
			} else {
				telegram = fiber.Map{
					"enabled":   true,
					"available": true,
					"stats":     telegramStats,
				}
			}
		}

		return c.JSON(fiber.Map{
			"ok":   true,
			"name": "admin-panel",
			"meta": fiber.Map{
				"generatedAt": time.Now().UTC().Format(time.RFC3339),
				"username":    username,
			},
			"landing":  landingStats,
			"telegram": telegram,
			"settings": l.buildSettingsPayload(),
		})
	}
}

func (l *landingApp) updateSettingsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req updateAdminSettingsRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		update := runtimeAdminSettingsUpdate{}

		if req.AdminTokenTTLMinutes != nil {
			if *req.AdminTokenTTLMinutes < 5 || *req.AdminTokenTTLMinutes > 1440 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "adminTokenTTLMinutes must be between 5 and 1440",
				})
			}
			update.AdminTokenTTLMinutes = req.AdminTokenTTLMinutes
		}

		if req.AdminLoginPerMinute != nil {
			if *req.AdminLoginPerMinute < 1 || *req.AdminLoginPerMinute > 1000 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "adminLoginPerMinute must be between 1 and 1000",
				})
			}
			update.AdminLoginPerMinute = req.AdminLoginPerMinute
		}

		if req.JoinFormPer20MinByIP != nil {
			if *req.JoinFormPer20MinByIP < 1 || *req.JoinFormPer20MinByIP > 1000 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "joinFormPer20MinByIP must be between 1 and 1000",
				})
			}
			update.JoinFormPer20MinByIP = req.JoinFormPer20MinByIP
		}

		if req.JoinSelectionPer20MinByIP != nil {
			if *req.JoinSelectionPer20MinByIP < 1 || *req.JoinSelectionPer20MinByIP > 1000 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "joinSelectionPer20MinByIP must be between 1 and 1000",
				})
			}
			update.JoinSelectionPer20MinByIP = req.JoinSelectionPer20MinByIP
		}

		if req.MinJoinFormFillDurationMs != nil {
			if *req.MinJoinFormFillDurationMs < 500 || *req.MinJoinFormFillDurationMs > 300000 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "minJoinFormFillDurationMs must be between 500 and 300000",
				})
			}
			update.MinJoinFormFillDurationMs = req.MinJoinFormFillDurationMs
		}
		if req.PanelAutoRefreshSeconds != nil {
			if *req.PanelAutoRefreshSeconds < 0 || *req.PanelAutoRefreshSeconds > 300 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "panelAutoRefreshSeconds must be between 0 and 300",
				})
			}
			update.PanelAutoRefreshSeconds = req.PanelAutoRefreshSeconds
		}
		if req.AdminUsersPageSize != nil {
			if *req.AdminUsersPageSize < 5 || *req.AdminUsersPageSize > 200 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "adminUsersPageSize must be between 5 and 200",
				})
			}
			update.AdminUsersPageSize = req.AdminUsersPageSize
		}

		if req.MaintenanceMode != nil {
			update.MaintenanceMode = req.MaintenanceMode
		}
		if req.AllowJoinApplications != nil {
			update.AllowJoinApplications = req.AllowJoinApplications
		}
		if req.AllowJoinSelections != nil {
			update.AllowJoinSelections = req.AllowJoinSelections
		}
		if req.AllowAdminDinnerMutations != nil {
			update.AllowAdminDinnerMutations = req.AllowAdminDinnerMutations
		}
		if req.AllowAdminUserStatusEdits != nil {
			update.AllowAdminUserStatusEdits = req.AllowAdminUserStatusEdits
		}

		l.settings.Apply(update)

		log.WithField("settings", fmt.Sprintf("%+v", l.settings.Snapshot())).Info("Admin settings updated")
		return c.JSON(fiber.Map{
			"ok":       true,
			"settings": l.buildSettingsPayload(),
		})
	}
}

func (l *landingApp) buildSettingsPayload() fiber.Map {
	s := l.settings.Snapshot()
	return fiber.Map{
		"frontendOrigin":             l.cfg.HTTP.FrontendOrigin,
		"listenAddr":                 l.cfg.HTTP.ListenAddr,
		"adminCookieSecure":          l.cfg.Admin.CookieSecure,
		"adminTokenTTLMinutes":       s.AdminTokenTTLMinutes,
		"telegramDatabaseConfigured": l.connections.TelegramStats != nil,
		"rateLimits": fiber.Map{
			"adminLoginPerMinute":       s.AdminLoginPerMinute,
			"joinFormPer20MinByIP":      s.JoinFormPer20MinByIP,
			"joinSelectionPer20MinByIP": s.JoinSelectionPer20MinByIP,
		},
		"runtime": fiber.Map{
			"maintenanceMode":           s.MaintenanceMode,
			"allowJoinApplications":     s.AllowJoinApplications,
			"allowJoinSelections":       s.AllowJoinSelections,
			"minJoinFormFillDurationMs": s.MinJoinFormFillDurationMs,
			"panelAutoRefreshSeconds":   s.PanelAutoRefreshSeconds,
			"adminUsersPageSize":        s.AdminUsersPageSize,
			"allowAdminDinnerMutations": s.AllowAdminDinnerMutations,
			"allowAdminUserStatusEdits": s.AllowAdminUserStatusEdits,
		},
	}
}
