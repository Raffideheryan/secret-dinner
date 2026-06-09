package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

var allowedTelegramApplicationStatuses = map[string]struct{}{
	"draft":               {},
	"pending_application": {},
	"contacted":           {},
	"approved":            {},
	"rejected":            {},
	"waiting_payment":     {},
	"paid":                {},
	"cancelled":           {},
	"no_show":             {},
}

func (l *landingApp) listAdminTelegramApplicationsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminBookings == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram application storage is not configured",
			})
		}

		params := buildUserListParams(c)
		maxPageSize := l.settings.AdminUsersPageSize()
		if maxPageSize <= 0 {
			maxPageSize = 30
		}
		if params.Limit <= 0 || params.Limit > maxPageSize {
			params.Limit = maxPageSize
		}

		items, err := l.connections.AdminBookings.ListTelegramApplications(params)
		if err != nil {
			log.WithError(err).Error("failed to list telegram applications")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch telegram applications",
			})
		}

		summary, err := l.connections.AdminBookings.TelegramApplicationsSummary()
		if err != nil {
			log.WithError(err).Error("failed to fetch telegram applications summary")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch telegram applications summary",
			})
		}

		return c.JSON(fiber.Map{
			"ok":           true,
			"applications": items,
			"summary":      summary,
			"meta": fiber.Map{
				"limit":  params.Limit,
				"offset": params.Offset,
				"search": params.Search,
				"status": params.Status,
			},
		})
	}
}

func (l *landingApp) updateAdminTelegramApplicationHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminBookings == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram application storage is not configured",
			})
		}
		if !l.settings.AllowAdminUserStatusEdits() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "user status edits are disabled by runtime settings",
			})
		}

		packageInfoID, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || packageInfoID <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid application id",
			})
		}

		var body updateTelegramApplicationRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		status := strings.ToLower(strings.TrimSpace(body.Status))
		if _, ok := allowedTelegramApplicationStatuses[status]; !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid telegram application status",
			})
		}

		before, after, err := l.connections.AdminBookings.UpdateTelegramApplication(packageInfoID, status, body.Note)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "application not found",
				})
			}
			log.WithError(err).Error("failed to update telegram application")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to update telegram application",
			})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType:    "telegram_application_updated",
			EntityType:    "telegram_application",
			EntityID:      strconv.FormatInt(packageInfoID, 10),
			PreviousValue: mustMarshalAuditJSON(before),
			NewValue:      mustMarshalAuditJSON(after),
			Reason:        strings.TrimSpace(body.Reason),
		})

		return c.JSON(fiber.Map{
			"ok":          true,
			"application": after,
		})
	}
}

func (l *landingApp) listAdminAuditLogsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminAudit == nil {
			return c.JSON(fiber.Map{
				"ok":   true,
				"logs": []db.AdminAuditLogRecord{},
			})
		}
		limit := c.QueryInt("limit", 20)
		logs, err := l.connections.AdminAudit.ListAdminAuditLogs(limit)
		if err != nil {
			log.WithError(err).Error("failed to list admin audit logs")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch admin audit logs",
			})
		}
		return c.JSON(fiber.Map{
			"ok":   true,
			"logs": logs,
		})
	}
}

func (l *landingApp) writeAdminAuditLog(c *fiber.Ctx, entry db.AdminAuditLogEntry) {
	if l.connections.AdminAudit == nil {
		return
	}
	username, _ := c.Locals(adminUsernameLocalsKey).(string)
	entry.AdminUsername = username
	if err := l.connections.AdminAudit.InsertAdminAuditLog(entry); err != nil {
		log.WithError(err).Warn("failed to insert admin audit log")
	}
}

func mustMarshalAuditJSON(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(data)
}
