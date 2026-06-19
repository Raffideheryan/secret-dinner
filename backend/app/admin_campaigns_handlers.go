package app

import (
	"database/sql"
	"secret-dinner/internal/db"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func (l *landingApp) listEngagementCampaignsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}

		params := db.EngagementCampaignListParams{
			Limit:  c.QueryInt("limit", 20),
			Offset: c.QueryInt("offset", 0),
			Search: strings.TrimSpace(c.Query("search")),
			Status: strings.TrimSpace(c.Query("status")),
		}
		items, total, err := l.connections.AdminCampaigns.ListEngagementCampaigns(params)
		if err != nil {
			log.WithError(err).Error("failed to list engagement campaigns")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load campaigns",
			})
		}
		return c.JSON(fiber.Map{
			"ok":        true,
			"campaigns": items,
			"meta": fiber.Map{
				"total":  total,
				"limit":  params.Limit,
				"offset": params.Offset,
			},
		})
	}
}

func (l *landingApp) getEngagementCampaignHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}
		item, err := l.connections.AdminCampaigns.GetEngagementCampaign(id)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "campaign not found"})
			}
			log.WithError(err).Error("failed to load engagement campaign")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load campaign"})
		}
		return c.JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) createEngagementCampaignHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		var payload db.EngagementCampaignComposerPayload
		if err := c.BodyParser(&payload); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign payload"})
		}
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		item, err := l.connections.AdminCampaigns.CreateEngagementCampaign(payload, username)
		if err != nil {
			return campaignWriteError(c, err)
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) updateEngagementCampaignHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}
		var payload db.EngagementCampaignComposerPayload
		if err := c.BodyParser(&payload); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign payload"})
		}
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		item, err := l.connections.AdminCampaigns.UpdateEngagementCampaign(id, payload, username)
		if err != nil {
			return campaignWriteError(c, err)
		}
		return c.JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) scheduleEngagementCampaignHandler() fiber.Handler {
	type request struct {
		SendNow      bool   `json:"sendNow"`
		ScheduledFor string `json:"scheduledFor"`
	}
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}

		var req request
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid schedule payload"})
		}

		var when *time.Time
		if !req.SendNow && strings.TrimSpace(req.ScheduledFor) != "" {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(req.ScheduledFor))
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scheduledFor must be RFC3339"})
			}
			parsed = parsed.UTC()
			when = &parsed
		}
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		item, err := l.connections.AdminCampaigns.ScheduleEngagementCampaign(id, when, req.SendNow, username)
		if err != nil {
			return campaignWriteError(c, err)
		}
		return c.JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) cancelEngagementCampaignHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		item, err := l.connections.AdminCampaigns.CancelEngagementCampaign(id, username)
		if err != nil {
			return campaignWriteError(c, err)
		}
		return c.JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) testSendEngagementCampaignHandler() fiber.Handler {
	type request struct {
		UserID string `json:"userId"`
	}
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}
		var req request
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid test send payload"})
		}
		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		item, err := l.connections.AdminCampaigns.QueueEngagementCampaignTest(id, req.UserID, username)
		if err != nil {
			return campaignWriteError(c, err)
		}
		return c.JSON(fiber.Map{"ok": true, "campaign": item})
	}
}

func (l *landingApp) listEngagementCampaignLogsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		id, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || id <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid campaign id"})
		}
		limit := c.QueryInt("limit", 30)
		offset := c.QueryInt("offset", 0)
		items, total, err := l.connections.AdminCampaigns.ListEngagementCampaignLogs(id, limit, offset)
		if err != nil {
			log.WithError(err).Error("failed to load campaign logs")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load campaign logs"})
		}
		return c.JSON(fiber.Map{
			"ok":   true,
			"logs": items,
			"meta": fiber.Map{
				"total":  total,
				"limit":  limit,
				"offset": offset,
			},
		})
	}
}

func (l *landingApp) getEngagementCampaignOptionsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminCampaigns == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "campaign storage is not configured",
			})
		}
		options, err := l.connections.AdminCampaigns.GetEngagementCampaignOptions()
		if err != nil {
			log.WithError(err).Error("failed to load campaign options")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load campaign options"})
		}
		return c.JSON(fiber.Map{"ok": true, "options": options})
	}
}

func campaignWriteError(c *fiber.Ctx, err error) error {
	if err == nil {
		return nil
	}
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "campaign not found"})
	}
	message := err.Error()
	status := fiber.StatusBadRequest
	if strings.Contains(message, "failed to") {
		status = fiber.StatusInternalServerError
	}
	return c.Status(status).JSON(fiber.Map{"error": message})
}
