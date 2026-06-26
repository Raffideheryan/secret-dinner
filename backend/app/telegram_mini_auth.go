package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"secret-dinner/config"
	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

const (
	telegramMiniInitDataHeader = "X-Telegram-Init-Data"
	telegramMiniDevUserHeader  = "X-Telegram-Dev-User"
)

type telegramMiniAuthService struct {
	cfg config.TelegramConfig
}

type telegramMiniVerifiedUser struct {
	ID        int64
	Username  string
	FirstName string
	LastName  string
	Language  string
}

type telegramMiniInitDataUser struct {
	ID           int64  `json:"id"`
	Username     string `json:"username"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	LanguageCode string `json:"language_code"`
}

func newTelegramMiniAuthService(cfg config.TelegramConfig) *telegramMiniAuthService {
	return &telegramMiniAuthService{cfg: cfg}
}

func (s *telegramMiniAuthService) middleware(store db.TelegramMiniAppDB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if store == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "telegram mini app storage is not configured",
			})
		}

		user, err := s.verifyRequest(c)
		if err != nil {
			status := fiber.StatusUnauthorized
			if errors.Is(err, sql.ErrNoRows) {
				status = fiber.StatusNotFound
			}
			return c.Status(status).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		if err := store.EnsureUser(db.TelegramMiniIdentity{
			UserID:    user.ID,
			Username:  user.Username,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Language:  user.Language,
		}); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to prepare telegram user session",
			})
		}

		c.Locals("telegramMiniUser", user)
		return c.Next()
	}
}

func (s *telegramMiniAuthService) verifyRequest(c *fiber.Ctx) (telegramMiniVerifiedUser, error) {
	raw := strings.TrimSpace(c.Get(telegramMiniInitDataHeader))
	if raw == "" {
		raw = strings.TrimSpace(c.Query("initData"))
	}
	if raw != "" {
		return s.verifyInitData(raw)
	}
	if isTelegramMiniLocalDevMode() && s.cfg.DevUserID > 0 {
		devUserID, _ := strconv.ParseInt(strings.TrimSpace(c.Get(telegramMiniDevUserHeader)), 10, 64)
		if devUserID > 0 && devUserID == s.cfg.DevUserID {
			return telegramMiniVerifiedUser{
				ID:       devUserID,
				Language: "english",
			}, nil
		}
	}
	return telegramMiniVerifiedUser{}, errors.New("telegram initData is required")
}

func (s *telegramMiniAuthService) verifyInitData(raw string) (telegramMiniVerifiedUser, error) {
	if strings.TrimSpace(s.cfg.BotToken) == "" {
		return telegramMiniVerifiedUser{}, errors.New("telegram bot token is not configured on backend")
	}

	values, err := url.ParseQuery(raw)
	if err != nil {
		return telegramMiniVerifiedUser{}, errors.New("invalid telegram initData")
	}

	providedHash := strings.TrimSpace(values.Get("hash"))
	if providedHash == "" {
		return telegramMiniVerifiedUser{}, errors.New("telegram initData hash is missing")
	}
	values.Del("hash")

	authDateRaw := strings.TrimSpace(values.Get("auth_date"))
	authDate, err := strconv.ParseInt(authDateRaw, 10, 64)
	if err != nil || authDate <= 0 {
		return telegramMiniVerifiedUser{}, errors.New("telegram initData auth_date is invalid")
	}
	if s.cfg.AuthMaxAgeSec > 0 {
		cutoff := time.Unix(authDate, 0).Add(time.Duration(s.cfg.AuthMaxAgeSec) * time.Second)
		if time.Now().After(cutoff) {
			return telegramMiniVerifiedUser{}, errors.New("telegram initData has expired")
		}
	}

	pairs := make([]string, 0, len(values))
	for key, vals := range values {
		if len(vals) == 0 {
			continue
		}
		pairs = append(pairs, key+"="+vals[0])
	}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")
	secret := buildTelegramMiniSecret(s.cfg.BotToken)
	expectedHash := signTelegramMiniData(secret, dataCheckString)
	if !hmac.Equal([]byte(strings.ToLower(providedHash)), []byte(strings.ToLower(expectedHash))) {
		return telegramMiniVerifiedUser{}, errors.New("telegram initData signature is invalid")
	}

	userRaw := strings.TrimSpace(values.Get("user"))
	if userRaw == "" {
		return telegramMiniVerifiedUser{}, errors.New("telegram initData user payload is missing")
	}
	var tgUser telegramMiniInitDataUser
	if err := json.Unmarshal([]byte(userRaw), &tgUser); err != nil {
		return telegramMiniVerifiedUser{}, errors.New("telegram initData user payload is invalid")
	}
	if tgUser.ID <= 0 {
		return telegramMiniVerifiedUser{}, errors.New("telegram user id is invalid")
	}

	return telegramMiniVerifiedUser{
		ID:        tgUser.ID,
		Username:  strings.TrimSpace(tgUser.Username),
		FirstName: strings.TrimSpace(tgUser.FirstName),
		LastName:  strings.TrimSpace(tgUser.LastName),
		Language:  normalizeMiniAppLanguageCode(tgUser.LanguageCode),
	}, nil
}

func buildTelegramMiniSecret(botToken string) []byte {
	mac := hmac.New(sha256.New, []byte("WebAppData"))
	mac.Write([]byte(botToken))
	return mac.Sum(nil)
}

func signTelegramMiniData(secret []byte, dataCheckString string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(dataCheckString))
	return hex.EncodeToString(mac.Sum(nil))
}

func normalizeMiniAppLanguageCode(code string) string {
	value := strings.ToLower(strings.TrimSpace(code))
	switch {
	case strings.HasPrefix(value, "hy"):
		return "armenian"
	case strings.HasPrefix(value, "ru"):
		return "russian"
	default:
		return "english"
	}
}

func currentTelegramMiniUser(c *fiber.Ctx) telegramMiniVerifiedUser {
	value, _ := c.Locals("telegramMiniUser").(telegramMiniVerifiedUser)
	return value
}

func isTelegramMiniLocalDevMode() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("LOCAL_DEV_MODE")))
	return value == "1" || value == "true" || value == "yes"
}
