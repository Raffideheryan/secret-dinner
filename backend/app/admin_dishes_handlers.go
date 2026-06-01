package app

import (
	"errors"
	"secret-dinner/internal/db"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func (l *landingApp) listAdminDishTypesHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.CustomMenu == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram database is not configured",
			})
		}

		types, err := l.connections.CustomMenu.ListDishTypes()
		if err != nil {
			log.WithError(err).Error("failed to list dish types")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch dish types",
			})
		}

		return c.JSON(fiber.Map{
			"ok":    true,
			"types": types,
		})
	}
}

func (l *landingApp) listAdminDishesHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.CustomMenu == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram database is not configured",
			})
		}

		dishType := strings.TrimSpace(c.Query("type"))
		if dishType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "missing type query param",
			})
		}

		items, err := l.connections.CustomMenu.ListItemsByType(dishType)
		if err != nil {
			if errors.Is(err, db.ErrInvalidDishType) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "invalid dish type",
				})
			}
			log.WithError(err).Error("failed to list dishes")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to fetch dishes",
			})
		}

		return c.JSON(fiber.Map{
			"ok":    true,
			"items": items,
		})
	}
}

func (l *landingApp) createAdminDishHandler() fiber.Handler {
	type request struct {
		NameArm  string  `json:"nameArm"`
		NameRus  string  `json:"nameRus"`
		NameEng  string  `json:"nameEng"`
		Price    float64 `json:"price"`
		DishType string  `json:"dishType"`
	}

	return func(c *fiber.Ctx) error {
		if l.connections.CustomMenu == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram database is not configured",
			})
		}

		var body request
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		// allow price as string from UI, if needed
		if body.Price == 0 {
			rawPrice := strings.TrimSpace(c.FormValue("price"))
			if rawPrice != "" {
				if v, err := strconv.ParseFloat(rawPrice, 64); err == nil {
					body.Price = v
				}
			}
		}

		item, err := l.connections.CustomMenu.CreateItem(db.CreateCustomMenuItemInput{
			NameArm:  body.NameArm,
			NameRus:  body.NameRus,
			NameEng:  body.NameEng,
			Price:    body.Price,
			DishType: body.DishType,
		})
		if err != nil {
			log.WithError(err).Warn("failed to create dish")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "failed to create dish",
			})
		}

		return c.JSON(fiber.Map{
			"ok":   true,
			"item": item,
		})
	}
}

