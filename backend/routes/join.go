package routes

import (
	"database/sql"
	"errors"
	"fmt"
	"secret-dinner/internal/db"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type joinPolicy interface {
	MinJoinFormFillDurationMs() int64
}

type LandingJoinCreatedNotification struct {
	UserID string
	User   db.Users
}

type LandingJoinSelectionNotification struct {
	UserID        string
	DinnerID      int64
	ChosenPackage string
	GuestPackages []string
}

func HandleJoin(usersDB db.UsersDB, policy joinPolicy, notify func(LandingJoinCreatedNotification)) fiber.Handler {
	return func(c *fiber.Ctx) error {

		var body struct {
			FullName       string   `json:"fullName"`
			Email          string   `json:"email"`
			Phone          string   `json:"phone"`
			Hobbies        []string `json:"hobbies"`
			Allergies      []string `json:"allergies"`
			GuestCount     int      `json:"guestCount"`
			FillDurationMs int64    `json:"fillDurationMs"`
		}

		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid body"})
		}

		hobbies := strings.Join(body.Hobbies, ", ")
		allergies := strings.Join(body.Allergies, ", ")
		if strings.TrimSpace(body.FullName) == "" || strings.TrimSpace(body.Phone) == "" || strings.TrimSpace(body.Email) == "" || strings.TrimSpace(hobbies) == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Required fields are missing"})
		}

		minFillDuration := minJoinFormFillDurationMs
		if policy != nil && policy.MinJoinFormFillDurationMs() > 0 {
			minFillDuration = policy.MinJoinFormFillDurationMs()
		}

		if body.FillDurationMs < minFillDuration {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Form submitted too quickly"})
		}

		normalizedEmail, err := normalizeEmail(body.Email)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid email"})
		}

		if isDisposableEmail(normalizedEmail) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Please use a valid personal or work email"})
		}

		if body.GuestCount <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "guestCount must be greater than 0"})
		}

		userInstance := db.Users{
			FullName:   body.FullName,
			Hobbies:    hobbies,
			Allergies:  allergies,
			GuestCount: body.GuestCount,
			Phone:      body.Phone,
			Email:      normalizedEmail,
		}

		userID, err := usersDB.Insert(userInstance)
		if err != nil {
			log.WithError(err).Error("Error inserting user")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Something went wrong"})
		}
		if notify != nil {
			notify(LandingJoinCreatedNotification{
				UserID: userID,
				User:   userInstance,
			})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true, "userId": userID})
	}

}

func HandleJoinSelection(usersDB db.UsersDB, dinnersDB db.DinnersDB, notify func(LandingJoinSelectionNotification)) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			UserID        string   `json:"userId"`
			DinnerID      int64    `json:"dinnerId"`
			ChosenPackage string   `json:"chosenPackage"`
			GuestPackages []string `json:"guestPackages"`
		}

		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Invalid body"})
		}

		if body.UserID == "" || body.DinnerID <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "userId and dinnerId are required"})
		}

		storedPackage, err := normalizeLandingSelectionPackage(body.ChosenPackage, body.GuestPackages)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": err.Error()})
		}

		if err := usersDB.UpdateSelection(body.UserID, body.DinnerID, storedPackage); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": true, "message": "User not found"})
			}
			if errors.Is(err, db.ErrDinnerSoldOut) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": true, "message": "Dinner is sold out"})
			}
			log.WithError(err).Error("Error updating user selection")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": true, "message": "Something went wrong"})
		}

		if dinnersDB != nil {
			if err := dinnersDB.SyncAllDinnerRegistrations(); err != nil {
				log.WithError(err).Warn("Error syncing dinner registrations after landing selection")
			}
		}
		if notify != nil {
			notify(LandingJoinSelectionNotification{
				UserID:        body.UserID,
				DinnerID:      body.DinnerID,
				ChosenPackage: storedPackage,
				GuestPackages: normalizedGuestPackages(body.GuestPackages),
			})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{"success": true})
	}
}

func normalizeLandingSelectionPackage(chosenPackage string, guestPackages []string) (string, error) {
	valid := map[string]struct{}{
		"silver": {},
		"gold":   {},
		"vip":    {},
		"custom": {},
	}

	normalizedGuests := make([]string, 0, len(guestPackages))
	for _, raw := range guestPackages {
		pkg := strings.ToLower(strings.TrimSpace(raw))
		if pkg == "" {
			continue
		}
		if _, ok := valid[pkg]; !ok {
			return "", errors.New("Invalid guestPackages")
		}
		normalizedGuests = append(normalizedGuests, pkg)
	}
	if len(normalizedGuests) > 0 {
		parts := make([]string, 0, len(normalizedGuests))
		for index, pkg := range normalizedGuests {
			parts = append(parts, fmt.Sprintf("guest_%d:%s", index+1, pkg))
		}
		return strings.Join(parts, ","), nil
	}

	normalizedChosen := strings.ToLower(strings.TrimSpace(chosenPackage))
	if _, ok := valid[normalizedChosen]; !ok {
		return "", errors.New("Invalid chosenPackage")
	}
	return normalizedChosen, nil
}

func normalizedGuestPackages(guestPackages []string) []string {
	items := make([]string, 0, len(guestPackages))
	for _, raw := range guestPackages {
		pkg := strings.ToLower(strings.TrimSpace(raw))
		if pkg != "" {
			items = append(items, pkg)
		}
	}
	return items
}
