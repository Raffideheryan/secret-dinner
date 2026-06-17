package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

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

var riskyTelegramApplicationStatuses = map[string]struct{}{
	"cancelled": {},
	"rejected":  {},
	"no_show":   {},
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
		expectedUpdatedAtRaw := strings.TrimSpace(body.ExpectedUpdatedAt)
		if expectedUpdatedAtRaw == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "expectedUpdatedAt is required for stale-write protection",
			})
		}
		expectedUpdatedAt, err := time.Parse(time.RFC3339Nano, expectedUpdatedAtRaw)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "expectedUpdatedAt must be a valid RFC3339 timestamp",
			})
		}
		reason := strings.TrimSpace(body.Reason)
		currentApplication, err := l.connections.AdminBookings.GetTelegramApplication(packageInfoID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "application not found",
				})
			}
			log.WithError(err).Error("failed to load current telegram application")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load current telegram application",
			})
		}
		if riskyTelegramStatusOverrideRequiresReason(currentApplication.Status, status) && reason == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": db.ErrTelegramApplicationReasonRequired.Error(),
			})
		}

		before, after, err := l.connections.AdminBookings.UpdateTelegramApplication(packageInfoID, status, body.Note, expectedUpdatedAt)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "application not found",
				})
			}
			if errors.Is(err, db.ErrInvalidTelegramApplicationStatusTransition) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": err.Error(),
				})
			}
			if errors.Is(err, db.ErrTelegramApplicationStaleUpdate) {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error": err.Error(),
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
			Reason:        reason,
		})

		return c.JSON(fiber.Map{
			"ok":          true,
			"application": after,
		})
	}
}

func riskyTelegramStatusOverrideRequiresReason(currentStatus string, nextStatus string) bool {
	current := strings.ToLower(strings.TrimSpace(currentStatus))
	next := strings.ToLower(strings.TrimSpace(nextStatus))
	if current == next {
		return false
	}
	_, risky := riskyTelegramApplicationStatuses[next]
	return risky
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
		offset := c.QueryInt("offset", 0)
		logs, err := l.connections.AdminAudit.ListAdminAuditLogs(db.AdminAuditLogListParams{
			Limit:         limit,
			Offset:        offset,
			Search:        strings.TrimSpace(c.Query("search")),
			EntityType:    strings.TrimSpace(c.Query("entityType")),
			ActionType:    strings.TrimSpace(c.Query("actionType")),
			AdminUsername: strings.TrimSpace(c.Query("adminUsername")),
			ReasonState:   strings.TrimSpace(c.Query("reasonState")),
		})
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
