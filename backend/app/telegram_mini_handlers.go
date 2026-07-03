package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

type telegramMiniBootstrapResponse struct {
	User              db.TelegramMiniAppUser    `json:"user"`
	NextDinner        *db.TelegramMiniAppDinner `json:"nextDinner"`
	SupportBotURL     string                    `json:"supportBotUrl"`
	BotUsername       string                    `json:"botUsername"`
	LoyaltyGoal       int                       `json:"loyaltyGoal"`
	CustomMenuMinimum int                       `json:"customMenuMinimum"`
}

type telegramMiniProfileRequest struct {
	Phone     string `json:"phone"`
	Language  string `json:"language"`
	Hobbies   string `json:"hobbies"`
	Allergies string `json:"allergies"`
}

type telegramMiniApplicationRequest struct {
	DinnerID        int64    `json:"dinnerId"`
	GuestCount      int      `json:"guestCount"`
	GuestPackages   []string `json:"guestPackages"`
	TablePreference string   `json:"tablePreference"`
	Hobbies         string   `json:"hobbies"`
	Allergies       string   `json:"allergies"`
	Phone           string   `json:"phone"`
	Language        string   `json:"language"`
	CustomMenuIDs   []int64  `json:"customMenuItemIds"`
	AcceptLegalTerms bool    `json:"acceptLegalTerms"`
}

func (l *landingApp) telegramMiniBootstrapHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		profile, err := l.connections.TelegramMini.GetUserProfile(user.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load telegram mini app profile",
			})
		}
		nextDinner, err := l.connections.TelegramMini.GetNextDinner()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load upcoming dinner",
			})
		}
		botUsername := strings.TrimSpace(l.cfg.Telegram.BotUsername)
		supportBotURL := ""
		if botUsername != "" {
			supportBotURL = "https://t.me/" + strings.TrimPrefix(botUsername, "@")
		}
		return c.JSON(telegramMiniBootstrapResponse{
			User:              profile,
			NextDinner:        nextDinner,
			SupportBotURL:     supportBotURL,
			BotUsername:       botUsername,
			LoyaltyGoal:       70,
			CustomMenuMinimum: 18000,
		})
	}
}

func (l *landingApp) telegramMiniApplicationsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		items, err := l.connections.TelegramMini.ListApplicationsByUser(user.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load applications",
			})
		}
		return c.JSON(fiber.Map{
			"ok":           true,
			"applications": items,
		})
	}
}

func (l *landingApp) telegramMiniProfileUpdateHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		var body telegramMiniProfileRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}
		profile, err := l.connections.TelegramMini.UpdateUserProfile(user.ID, db.TelegramMiniProfileUpdate{
			Phone:     body.Phone,
			Language:  body.Language,
			Hobbies:   body.Hobbies,
			Allergies: body.Allergies,
		})
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.JSON(fiber.Map{
			"ok":   true,
			"user": profile,
		})
	}
}

func (l *landingApp) telegramMiniCustomMenuTypesHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.CustomMenu == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "custom menu is not configured",
			})
		}
		types, err := l.connections.CustomMenu.ListDishTypes()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load custom menu types",
			})
		}
		return c.JSON(fiber.Map{
			"ok":    true,
			"types": types,
		})
	}
}

func (l *landingApp) telegramMiniCustomMenuItemsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.CustomMenu == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "custom menu is not configured",
			})
		}
		dishType := strings.TrimSpace(c.Query("type"))
		if dishType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "type query parameter is required",
			})
		}
		items, err := l.connections.CustomMenu.ListItemsByType(dishType)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.JSON(fiber.Map{
			"ok":    true,
			"items": items,
		})
	}
}

func (l *landingApp) telegramMiniCreateApplicationHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		var body telegramMiniApplicationRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}
		profile, err := l.connections.TelegramMini.GetUserProfile(user.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to load current profile",
			})
		}
		phone := strings.TrimSpace(body.Phone)
		if phone == "" {
			phone = strings.TrimSpace(profile.Phone)
		}
		language := strings.TrimSpace(body.Language)
		if language == "" {
			language = strings.TrimSpace(profile.Language)
		}

		item, err := l.connections.TelegramMini.CreateApplication(db.TelegramMiniAppApplicationInput{
			UserID:          user.ID,
			DinnerID:        body.DinnerID,
			GuestCount:      body.GuestCount,
			GuestPackages:   body.GuestPackages,
			TablePreference: body.TablePreference,
			Hobbies:         body.Hobbies,
			Allergies:       body.Allergies,
			Phone:           phone,
			Language:        language,
			CustomMenuIDs:   body.CustomMenuIDs,
			AcceptLegalTerms: body.AcceptLegalTerms,
		})
		if err != nil {
			status := fiber.StatusBadRequest
			if errors.Is(err, db.ErrMiniAppActiveApplicationExists) {
				status = fiber.StatusConflict
			}
			if errors.Is(err, db.ErrMiniAppLegalConsentRequired) {
				status = fiber.StatusForbidden
			}
			return c.Status(status).JSON(fiber.Map{
				"error": err.Error(),
			})
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"ok":          true,
			"application": item,
		})
	}
}

func (l *landingApp) telegramMiniCancelApplicationHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		packageInfoID, err := strconv.ParseInt(strings.TrimSpace(c.Params("id")), 10, 64)
		if err != nil || packageInfoID <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid application id",
			})
		}

		item, err := l.connections.TelegramMini.CancelApplication(user.ID, packageInfoID)
		if err != nil {
			status := fiber.StatusBadRequest
			switch {
			case errors.Is(err, db.ErrMiniAppApplicationUnavailable):
				status = fiber.StatusNotFound
			case errors.Is(err, db.ErrMiniAppApplicationCancelBlocked):
				status = fiber.StatusConflict
			}
			return c.Status(status).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"ok":          true,
			"application": item,
		})
	}
}

func (l *landingApp) telegramMiniHealthHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		return c.JSON(fiber.Map{
			"ok":     true,
			"userId": strconv.FormatInt(user.ID, 10),
		})
	}
}

type telegramMiniSupportRequest struct {
	Message string `json:"message"`
}

func (l *landingApp) telegramMiniSupportHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)

		var body telegramMiniSupportRequest
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		message := strings.TrimSpace(body.Message)
		if message == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "message is required",
			})
		}
		if len(message) > 2000 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "message is too long",
			})
		}

		botToken := strings.TrimSpace(l.cfg.Telegram.BotToken)
		adminIDs := l.cfg.Telegram.AdminIDs
		if botToken == "" || len(adminIDs) == 0 {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "support is not configured",
			})
		}

		text := fmt.Sprintf("[Mini App Support]\nFrom user %d\n\n%s", user.ID, message)
		telegramURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
		for _, adminID := range adminIDs {
			payload := fmt.Sprintf(`{"chat_id":%d,"text":%s}`, adminID, jsonStringLiteral(text))

			req, err := http.NewRequestWithContext(c.Context(), http.MethodPost, telegramURL, strings.NewReader(payload))
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to build support request",
				})
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to send support message",
				})
			}
			resp.Body.Close()

			if resp.StatusCode >= 400 {
				return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
					"error": "telegram rejected the support message",
				})
			}
		}

		return c.JSON(fiber.Map{"ok": true})
	}
}

func jsonStringLiteral(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// ── Game progress handlers ────────────────────────────────────────────────────

func (l *landingApp) telegramMiniGameProgressGetHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		gp, err := l.connections.TelegramMini.GetGameProgress(user.ID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load game progress"})
		}
		return c.JSON(fiber.Map{"progress": gp})
	}
}

type gameProgressSaveRequest struct {
	GamePoints    *int `json:"gamePoints"`
	GameHighScore *int `json:"gameHighScore"`
	CurrentLevel  *int `json:"currentLevel"`
}

func (l *landingApp) telegramMiniGameProgressSaveHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		var req gameProgressSaveRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		if req.GamePoints != nil && *req.GamePoints < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "gamePoints must be non-negative"})
		}
		if req.GameHighScore != nil && *req.GameHighScore < 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "gameHighScore must be non-negative"})
		}
		if req.CurrentLevel != nil && *req.CurrentLevel < 1 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "currentLevel must be at least 1"})
		}
		gp, err := l.connections.TelegramMini.SaveGameProgress(user.ID, db.GameProgressUpdate{
			GamePoints:    req.GamePoints,
			GameHighScore: req.GameHighScore,
			CurrentLevel:  req.CurrentLevel,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save game progress"})
		}
		return c.JSON(fiber.Map{"progress": gp})
	}
}

type gameRewardClaimRequest struct {
	Level int `json:"level"`
	Score int `json:"score"`
}

// Server-authoritative reward claim: the client sends only level + score; the
// backend computes the star rating and incremental reward. Frontend score is
// never trusted for the reward amount, and rewards are capped per level.
func (l *landingApp) telegramMiniGameRewardClaimHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		var req gameRewardClaimRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		result, err := l.connections.TelegramMini.ClaimLevelReward(user.ID, req.Level, req.Score)
		if err != nil {
			switch {
			case errors.Is(err, db.ErrGameLevelInvalid):
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid level"})
			case errors.Is(err, db.ErrGameScoreInvalid):
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid score"})
			default:
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to claim reward"})
			}
		}
		return c.JSON(fiber.Map{
			"stars":     result.Stars,
			"bestStars": result.BestStars,
			"awarded":   result.Awarded,
			"progress":  result.Progress,
		})
	}
}

func (l *landingApp) telegramMiniGameLeaderboardHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		limit := 20
		if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
				limit = parsed
			}
		}
		entries, err := l.connections.TelegramMini.GetGameLeaderboard(limit)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load leaderboard"})
		}
		return c.JSON(fiber.Map{"leaderboard": entries})
	}
}

type gameConvertRequest struct {
	GamePoints int `json:"gamePoints"`
}

func (l *landingApp) telegramMiniGameConvertHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		user := currentTelegramMiniUser(c)
		var req gameConvertRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		gp, err := l.connections.TelegramMini.ConvertGamePoints(user.ID, req.GamePoints)
		if err != nil {
			switch {
			case errors.Is(err, db.ErrGameConvertInvalid):
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "amount must be a positive multiple of 200"})
			case errors.Is(err, db.ErrGameConvertDailyLimit):
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": "daily conversion limit exceeded"})
			case errors.Is(err, db.ErrGameConvertNotEnough):
				return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": "not enough game points"})
			default:
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "conversion failed"})
			}
		}
		return c.JSON(fiber.Map{"progress": gp})
	}
}
