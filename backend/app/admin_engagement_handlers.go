package app

import (
	"database/sql"
	"secret-dinner/internal/db"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func (l *landingApp) getEngagementAnalyticsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.ActivityEvents == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "activity analytics storage is not configured",
			})
		}

		params, err := buildEngagementAnalyticsParams(c)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		analytics, err := l.connections.ActivityEvents.GetEngagementAnalytics(params)
		if err != nil {
			log.WithError(err).Error("failed to load engagement analytics")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load engagement analytics",
			})
		}

		return c.JSON(fiber.Map{
			"ok":        true,
			"analytics": analytics,
		})
	}
}

func (l *landingApp) listEngagementUsersHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "engagement user storage is not configured",
			})
		}

		params := db.EngagementUsersListParams{
			Source: strings.TrimSpace(c.Query("source")),
			Search: strings.TrimSpace(c.Query("search")),
			Limit:  c.QueryInt("limit", 30),
			Offset: c.QueryInt("offset", 0),
		}
		page, err := l.connections.AdminUsers.ListEngagementUsers(params)
		if err != nil {
			log.WithError(err).Error("failed to list engagement users")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load engagement users",
			})
		}

		return c.JSON(fiber.Map{
			"ok":    true,
			"users": page.Users,
			"meta": fiber.Map{
				"source": page.Source,
				"total":  page.Total,
				"limit":  params.Limit,
				"offset": params.Offset,
				"search": params.Search,
			},
		})
	}
}

func (l *landingApp) getEngagementUserProfileHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "engagement user storage is not configured",
			})
		}

		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		if source == "" || userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "source and user id are required",
			})
		}

		profile, err := l.connections.AdminUsers.GetEngagementUserProfile(source, userID)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
					"error": "engagement user not found",
				})
			}
			log.WithError(err).Error("failed to load engagement user profile")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load engagement user profile",
			})
		}

		return c.JSON(fiber.Map{
			"ok":      true,
			"profile": profile,
		})
	}
}

func (l *landingApp) listEngagementUserEventsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "engagement user storage is not configured",
			})
		}

		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		if source == "" || userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "source and user id are required",
			})
		}

		page, err := l.connections.AdminUsers.ListEngagementUserEvents(source, userID, db.EngagementUserEventsListParams{
			Limit:  c.QueryInt("limit", 20),
			Offset: c.QueryInt("offset", 0),
			Search: strings.TrimSpace(c.Query("search")),
		})
		if err != nil {
			log.WithError(err).Error("failed to load engagement user events")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load engagement user events",
			})
		}

		return c.JSON(fiber.Map{
			"ok":    true,
			"events": page.Events,
			"meta": fiber.Map{
				"total":  page.Total,
				"limit":  page.Limit,
				"offset": page.Offset,
				"search": page.Search,
			},
		})
	}
}

func buildEngagementAnalyticsParams(c *fiber.Ctx) (params db.EngagementAnalyticsParams, err error) {
	endDate := time.Now().UTC().Add(24 * time.Hour)
	startDate := endDate.AddDate(0, 0, -30)

	if raw := strings.TrimSpace(c.Query("startDate")); raw != "" {
		parsed, parseErr := time.Parse("2006-01-02", raw)
		if parseErr != nil {
			return params, fiber.NewError(fiber.StatusBadRequest, "startDate must be YYYY-MM-DD")
		}
		startDate = parsed.UTC()
	}
	if raw := strings.TrimSpace(c.Query("endDate")); raw != "" {
		parsed, parseErr := time.Parse("2006-01-02", raw)
		if parseErr != nil {
			return params, fiber.NewError(fiber.StatusBadRequest, "endDate must be YYYY-MM-DD")
		}
		endDate = parsed.UTC().Add(24 * time.Hour)
	}
	if !startDate.Before(endDate) {
		return params, fiber.NewError(fiber.StatusBadRequest, "startDate must be before endDate")
	}

	params.StartDate = startDate
	params.EndDate = endDate
	params.Source = strings.ToLower(strings.TrimSpace(c.Query("source")))
	params.Package = strings.ToLower(strings.TrimSpace(c.Query("package")))

	if raw := strings.TrimSpace(c.Query("dinnerId")); raw != "" {
		id, parseErr := strconv.ParseInt(raw, 10, 64)
		if parseErr != nil || id <= 0 {
			return params, fiber.NewError(fiber.StatusBadRequest, "dinnerId must be a positive integer")
		}
		params.DinnerID = id
	}

	return params, nil
}
