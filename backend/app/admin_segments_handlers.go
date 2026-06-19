package app

import (
	"github.com/gofiber/fiber/v2"
)

func (l *landingApp) getSmartSegmentsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "admin users service not configured",
			})
		}
		segments, err := l.connections.AdminUsers.GetSmartSegments()
		if err != nil {
			log.WithError(err).Error("failed to compute smart segments")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to compute smart segments",
			})
		}
		return c.JSON(fiber.Map{"segments": segments})
	}
}

func (l *landingApp) getAdminRecommendationsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "admin users service not configured",
			})
		}
		recommendations, err := l.connections.AdminUsers.GetAdminRecommendations()
		if err != nil {
			log.WithError(err).Error("failed to compute admin recommendations")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to compute admin recommendations",
			})
		}
		return c.JSON(fiber.Map{"recommendations": recommendations})
	}
}
