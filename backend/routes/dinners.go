package routes

import (
	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

func GetDinners(dinnersDB db.DinnersDB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		dinners, err := dinnersDB.GetActiveDinners()
		if err != nil {
			log.WithError(err).Error("Error fetching dinners")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   true,
				"message": "Something went wrong",
			})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"dinners": dinners,
		})
	}
}
