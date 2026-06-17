package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"secret-dinner/internal/db"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var allowedLandingAdminStatuses = map[string]struct{}{
	"open":      {},
	"completed": {},
}

var allowedLandingReviewStatuses = map[string]struct{}{
	"new":       {},
	"review":    {},
	"contacted": {},
	"approved":  {},
	"rejected":  {},
}

func (l *landingApp) listAdminLandingUsersHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "admin users storage is not configured",
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
		users, err := l.connections.AdminUsers.ListLandingUsers(params)
		if err != nil {
			log.WithError(err).Error("failed to list landing users")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch landing users",
			})
		}

		summary, err := l.connections.AdminUsers.LandingUsersSummary()
		if err != nil {
			log.WithError(err).Error("failed to fetch landing users summary")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch landing users summary",
			})
		}

		return c.JSON(fiber.Map{
			"ok":      true,
			"users":   users,
			"summary": summary,
			"meta": fiber.Map{
				"limit":  params.Limit,
				"offset": params.Offset,
				"search": params.Search,
				"status": params.Status,
			},
		})
	}
}

func (l *landingApp) listAdminTelegramUsersHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "admin users storage is not configured",
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
		users, err := l.connections.AdminUsers.ListTelegramUsers(params)
		if err != nil {
			log.WithError(err).Error("failed to list telegram users")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch telegram users",
			})
		}

		summary, err := l.connections.AdminUsers.TelegramUsersSummary()
		if err != nil {
			log.WithError(err).Error("failed to fetch telegram users summary")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch telegram users summary",
			})
		}

		return c.JSON(fiber.Map{
			"ok":      true,
			"users":   users,
			"summary": summary,
			"meta": fiber.Map{
				"limit":  params.Limit,
				"offset": params.Offset,
				"search": params.Search,
				"status": params.Status,
			},
		})
	}
}

func (l *landingApp) updateAdminLandingUserStatusHandler() fiber.Handler {
	type request struct {
		Status          string `json:"status"`
		SelectionStatus string `json:"selectionStatus"`
		AdminStatus     string `json:"adminStatus"`
	}

	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "admin users storage is not configured",
			})
		}
		if !l.settings.AllowAdminUserStatusEdits() {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "user status edits are disabled by runtime settings",
			})
		}

		userID := strings.TrimSpace(c.Params("id"))
		if userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid user id",
			})
		}

		var body request
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		var selectionStatus *string
		var adminStatus *string

		selectionRaw := strings.ToLower(strings.TrimSpace(body.SelectionStatus))
		adminRaw := strings.ToLower(strings.TrimSpace(body.AdminStatus))
		legacyStatus := strings.ToLower(strings.TrimSpace(body.Status))

		// Be tolerant of older clients that may send one of the values in the wrong field.
		if selectionRaw != "" {
			if _, ok := allowedLandingReviewStatuses[selectionRaw]; ok && adminRaw == "" {
				adminRaw = selectionRaw
				selectionRaw = ""
			}
		}
		if adminRaw != "" {
			if _, ok := allowedLandingAdminStatuses[adminRaw]; ok && selectionRaw == "" {
				selectionRaw = adminRaw
				adminRaw = ""
			}
		}

		if selectionRaw == "" && adminRaw == "" && legacyStatus != "" {
			if _, ok := allowedLandingAdminStatuses[legacyStatus]; ok {
				selectionRaw = legacyStatus
			} else if _, ok := allowedLandingReviewStatuses[legacyStatus]; ok {
				adminRaw = legacyStatus
			}
		}

		if selectionRaw != "" {
			if _, ok := allowedLandingAdminStatuses[selectionRaw]; !ok {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "invalid selectionStatus; allowed: open, completed",
				})
			}
			selectionStatus = &selectionRaw
		}

		if adminRaw != "" {
			if _, ok := allowedLandingReviewStatuses[adminRaw]; !ok {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "invalid adminStatus; allowed: new, review, contacted, approved, rejected",
				})
			}
			adminStatus = &adminRaw
		}

		if selectionStatus == nil && adminStatus == nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "at least one of selectionStatus or adminStatus is required",
			})
		}

		updated, err := l.connections.AdminUsers.UpdateLandingUserStatus(userID, selectionStatus, adminStatus)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "user not found",
				})
			}
			log.WithError(err).Error("failed to update landing user status")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to update user status",
			})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType:    "landing_user_status_updated",
			EntityType:    "landing_user",
			EntityID:      userID,
			PreviousValue: string(mustJSONMap(map[string]string{"selectionStatus": "unknown", "adminStatus": "unknown"})),
			NewValue: string(mustJSONMap(map[string]string{
				"selectionStatus": updated.SelectionStatus,
				"adminStatus":     updated.AdminStatus,
			})),
		})

		return c.JSON(fiber.Map{
			"ok":   true,
			"user": updated,
		})
	}
}

func mustJSONMap(value map[string]string) []byte {
	data, err := json.Marshal(value)
	if err != nil {
		return []byte("{}")
	}
	return data
}

func buildUserListParams(c *fiber.Ctx) userListParams {
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)
	search := strings.TrimSpace(c.Query("search"))
	status := strings.TrimSpace(c.Query("status"))

	return userListParams{
		Limit:  limit,
		Offset: offset,
		Search: search,
		Status: status,
	}
}

type userListParams = db.UserListParams
