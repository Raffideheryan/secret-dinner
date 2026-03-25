package app

import (
	"database/sql"
	"errors"
	"secret-dinner/internal/db"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var allowedLandingAdminStatuses = map[string]struct{}{
	"open":      {},
	"completed": {},
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
		Status string `json:"status"`
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

		status := strings.ToLower(strings.TrimSpace(body.Status))
		if _, ok := allowedLandingAdminStatuses[status]; !ok {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid status; allowed: open, completed",
			})
		}

		if err := l.connections.AdminUsers.UpdateLandingUserStatus(userID, status); err != nil {
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

		return c.JSON(fiber.Map{
			"ok":     true,
			"userId": userID,
			"status": status,
		})
	}
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
