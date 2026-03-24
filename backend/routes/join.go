package routes

import (
	"database/sql"
	"errors"
	"secret-dinner/internal/db"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func HandleJoin(usersDB db.UsersDB) fiber.Handler {
	return func(c *fiber.Ctx) error {

		var body struct {
			FullName   string   `json:"fullName"`
			Email      string   `json:"email"`
			Phone      string   `json:"phone"`
			Hobbies    []string `json:"hobbies"`
			Allergies  []string `json:"allergies"`
			GuestCount int      `json:"guestCount"`
		}

		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid body"})
		}

		hobbies := strings.Join(body.Hobbies, ", ")
		allergies := strings.Join(body.Allergies, ", ")
		if body.GuestCount <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "guestCount must be greater than 0"})
		}

		userInstance := db.Users{
			FullName:   body.FullName,
			Hobbies:    hobbies,
			Allergies:  allergies,
			GuestCount: body.GuestCount,
			Phone:      body.Phone,
			Email:      body.Email,
		}

		userID, err := usersDB.Insert(userInstance)
		if err != nil {
			log.WithError(err).Error("Error inserting user")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Something went wrong"})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true, "userId": userID})
	}

}

func HandleJoinSelection(usersDB db.UsersDB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			UserID        string `json:"userId"`
			DinnerID      int64  `json:"dinnerId"`
			ChosenPackage string `json:"chosenPackage"`
		}

		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid body"})
		}

		switch body.ChosenPackage {
		case "silver", "gold", "vip", "custom":
		default:
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid chosenPackage"})
		}

		if body.UserID == "" || body.DinnerID <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "userId and dinnerId are required"})
		}

		if err := usersDB.UpdateSelection(body.UserID, body.DinnerID, body.ChosenPackage); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": true, "message": "User not found"})
			}
			log.WithError(err).Error("Error updating user selection")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Something went wrong"})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
	}
}
