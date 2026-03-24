package app

import (
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
		landingUsersCount, err := l.connections.Users.CountLandingUsers()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch admin stats",
			})
		}

		return c.JSON(fiber.Map{
			"ok":                true,
			"name":              "admin-panel",
			"landingUsersCount": landingUsersCount,
		})
	}
}
