package app

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

func securityHeadersMiddleware(secureCookie bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Referrer-Policy", "no-referrer")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Set("Content-Security-Policy", "default-src 'self'")
		if secureCookie {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		return c.Next()
	}
}

func (l *landingApp) requireAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies(l.cfg.Admin.CookieName)
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
			})
		}

		claims, err := l.auth.validateToken(token)
		if err != nil {
			l.clearAdminSessionCookie(c)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
			})
		}

		c.Locals(adminUsernameLocalsKey, claims.Sub)
		return c.Next()
	}
}

func (l *landingApp) setAdminSessionCookie(c *fiber.Ctx, token string, expiresAt time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     l.cfg.Admin.CookieName,
		Value:    token,
		HTTPOnly: true,
		Secure:   l.cfg.Admin.CookieSecure,
		SameSite: "strict",
		Path:     "/",
		Expires:  expiresAt,
	})
}

func (l *landingApp) clearAdminSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     l.cfg.Admin.CookieName,
		Value:    "",
		HTTPOnly: true,
		Secure:   l.cfg.Admin.CookieSecure,
		SameSite: "strict",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}
