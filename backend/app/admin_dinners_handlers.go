package app

import (
	"database/sql"
	"errors"
	"secret-dinner/internal/db"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type adminDinnerRequest struct {
	Description string   `json:"description"`
	Places      int      `json:"places"`
	Location    string   `json:"location"`
	DinnerDate  string   `json:"dinnerDate"`
	SilverPrice *float64 `json:"silverPrice"`
	GoldPrice   *float64 `json:"goldPrice"`
	VIPPrice    *float64 `json:"vipPrice"`
	Expired     bool     `json:"expired"`
}

func (l *landingApp) listAdminDinnersHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		dinners, err := l.connections.Dinners.GetAdminDinners()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch dinners",
			})
		}
		return c.JSON(fiber.Map{
			"ok":      true,
			"dinners": dinners,
		})
	}
}

func (l *landingApp) createAdminDinnerHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.settings.AllowAdminDinnerMutations() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "dinner mutations are disabled by runtime settings",
			})
		}

		req, err := parseAdminDinnerRequest(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		dinner, err := l.connections.Dinners.CreateDinner(req)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"ok":     true,
			"dinner": dinner,
		})
	}
}

func (l *landingApp) updateAdminDinnerHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.settings.AllowAdminDinnerMutations() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "dinner mutations are disabled by runtime settings",
			})
		}

		id, err := strconv.ParseInt(c.Params("id"), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid dinner id",
			})
		}

		req, err := parseAdminDinnerRequest(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		if err := l.connections.Dinners.UpdateDinner(id, req); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "dinner not found",
				})
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		if err := l.connections.Dinners.SyncDinnerRegistrations(id); err != nil {
			log.WithError(err).Warn("failed to sync dinner registrations after update")
		}

		return c.JSON(fiber.Map{"ok": true})
	}
}

func (l *landingApp) deleteAdminDinnerHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.settings.AllowAdminDinnerMutations() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "dinner mutations are disabled by runtime settings",
			})
		}

		id, err := strconv.ParseInt(c.Params("id"), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid dinner id",
			})
		}

		if err := l.connections.Dinners.DeleteDinner(id); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "dinner not found",
				})
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.JSON(fiber.Map{"ok": true})
	}
}

func (l *landingApp) syncAdminDinnersHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.settings.AllowAdminDinnerMutations() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "dinner mutations are disabled by runtime settings",
			})
		}

		if err := l.connections.Dinners.SyncAllDinnerRegistrations(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to sync dinners",
			})
		}
		return c.JSON(fiber.Map{"ok": true})
	}
}

func parseAdminDinnerRequest(c *fiber.Ctx) (db.DinnerMutation, error) {
	var body adminDinnerRequest
	if err := c.BodyParser(&body); err != nil {
		return db.DinnerMutation{}, errors.New("invalid request body")
	}

	description := strings.TrimSpace(body.Description)
	location := strings.TrimSpace(body.Location)
	if description == "" || location == "" {
		return db.DinnerMutation{}, errors.New("description and location are required")
	}

	date, err := time.Parse("2006-01-02", strings.TrimSpace(body.DinnerDate))
	if err != nil {
		return db.DinnerMutation{}, errors.New("dinnerDate must be YYYY-MM-DD")
	}

	if body.Places < 0 {
		return db.DinnerMutation{}, errors.New("places must be >= 0")
	}

	return db.DinnerMutation{
		Description: description,
		Places:      body.Places,
		Location:    location,
		DinnerDate:  date,
		SilverPrice: body.SilverPrice,
		GoldPrice:   body.GoldPrice,
		VIPPrice:    body.VIPPrice,
		Expired:     body.Expired,
	}, nil
}
