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
	SilverSeats *int     `json:"silverSeats"`
	GoldSeats   *int     `json:"goldSeats"`
	VIPSeats    *int     `json:"vipSeats"`
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

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "dinner_created",
			EntityType: "dinner",
			EntityID:   strconv.FormatInt(dinner.ID, 10),
			NewValue:   mustMarshalAuditJSON(dinner),
		})

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

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "dinner_updated",
			EntityType: "dinner",
			EntityID:   strconv.FormatInt(id, 10),
			NewValue:   mustMarshalAuditJSON(req),
		})

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

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "dinner_deleted",
			EntityType: "dinner",
			EntityID:   strconv.FormatInt(id, 10),
		})

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
		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "dinners_synced",
			EntityType: "dinner",
			EntityID:   "all",
		})
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
	if body.SilverSeats != nil && *body.SilverSeats < 0 {
		return db.DinnerMutation{}, errors.New("silverSeats must be >= 0")
	}
	if body.GoldSeats != nil && *body.GoldSeats < 0 {
		return db.DinnerMutation{}, errors.New("goldSeats must be >= 0")
	}
	if body.VIPSeats != nil && *body.VIPSeats < 0 {
		return db.DinnerMutation{}, errors.New("vipSeats must be >= 0")
	}
	if body.SilverSeats != nil && *body.SilverSeats > body.Places {
		return db.DinnerMutation{}, errors.New("silverSeats cannot exceed places")
	}
	if body.GoldSeats != nil && *body.GoldSeats > body.Places {
		return db.DinnerMutation{}, errors.New("goldSeats cannot exceed places")
	}
	if body.VIPSeats != nil && *body.VIPSeats > body.Places {
		return db.DinnerMutation{}, errors.New("vipSeats cannot exceed places")
	}
	if totalCaps := nullableSeatCount(body.SilverSeats) + nullableSeatCount(body.GoldSeats) + nullableSeatCount(body.VIPSeats); totalCaps > body.Places {
		return db.DinnerMutation{}, errors.New("sum of package seat caps cannot exceed places")
	}

	return db.DinnerMutation{
		Description: description,
		Places:      body.Places,
		Location:    location,
		DinnerDate:  date,
		SilverSeats: body.SilverSeats,
		GoldSeats:   body.GoldSeats,
		VIPSeats:    body.VIPSeats,
		SilverPrice: body.SilverPrice,
		GoldPrice:   body.GoldPrice,
		VIPPrice:    body.VIPPrice,
		Expired:     body.Expired,
	}, nil
}

func nullableSeatCount(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}
