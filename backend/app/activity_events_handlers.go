package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

const (
	maxActivityEventsPerRequest = 100
	maxActivityEventStringLen   = 255
	maxActivityJSONBytes        = 32 * 1024
)

type activityEventsEnvelope struct {
	Events []activityEventPayload `json:"events"`
}

type activityEventPayload struct {
	Source             string         `json:"source"`
	EventName          string         `json:"eventName"`
	EventKey           string         `json:"eventKey"`
	UserID             string         `json:"userId"`
	SessionID          string         `json:"sessionId"`
	EntityType         string         `json:"entityType"`
	EntityID           string         `json:"entityId"`
	PagePath           string         `json:"pagePath"`
	Referrer           string         `json:"referrer"`
	UTMSource          string         `json:"utmSource"`
	UTMMedium          string         `json:"utmMedium"`
	UTMCampaign        string         `json:"utmCampaign"`
	UTMContent         string         `json:"utmContent"`
	UTMTerm            string         `json:"utmTerm"`
	TelegramStartParam string         `json:"telegramStartParam"`
	OccurredAt         string         `json:"occurredAt"`
	Metadata           map[string]any `json:"metadata"`
	Context            map[string]any `json:"context"`
}

type activityRequestContext struct {
	Path      string
	UserAgent string
}

func (l *landingApp) storeUserActivityEventsHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.ActivityEvents == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "activity storage is not configured",
			})
		}

		events, err := decodeActivityEventsRequest(c.Body())
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		service := newUserActivityService(l.connections.ActivityEvents)
		inserted, err := service.Store(events, activityRequestContext{
			Path:      c.Path(),
			UserAgent: c.Get("User-Agent"),
		})
		if err != nil {
			var storeErr *userActivityStoreError
			if errors.As(err, &storeErr) {
				log.WithError(err).Error("failed to store user activity events")
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to store activity events",
				})
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"ok":       true,
			"received": len(events),
			"inserted": inserted,
		})
	}
}

func decodeActivityEventsRequest(body []byte) ([]activityEventPayload, error) {
	var envelope activityEventsEnvelope
	if err := json.Unmarshal(body, &envelope); err == nil && len(envelope.Events) > 0 {
		return envelope.Events, nil
	}

	var single activityEventPayload
	if err := json.Unmarshal(body, &single); err == nil && (strings.TrimSpace(single.EventName) != "" || strings.TrimSpace(single.Source) != "") {
		return []activityEventPayload{single}, nil
	}

	return nil, fmt.Errorf("request must include one activity event or an events array")
}

func normalizeActivityEvents(events []activityEventPayload, ctx activityRequestContext) ([]db.UserActivityEventInsert, error) {
	if len(events) == 0 {
		return nil, fmt.Errorf("at least one activity event is required")
	}
	if len(events) > maxActivityEventsPerRequest {
		return nil, fmt.Errorf("too many activity events; limit is %d", maxActivityEventsPerRequest)
	}

	now := time.Now().UTC()
	normalized := make([]db.UserActivityEventInsert, 0, len(events))

	for index, event := range events {
		source := normalizeActivitySource(event.Source)
		if source == "" {
			return nil, fmt.Errorf("events[%d].source must be one of: landing, telegram", index)
		}

		eventName := normalizeActivityString(event.EventName, maxActivityEventStringLen)
		if eventName == "" {
			return nil, fmt.Errorf("events[%d].eventName is required", index)
		}

		userKey := normalizeActivityString(event.UserID, maxActivityEventStringLen)
		sessionKey := normalizeActivityString(event.SessionID, maxActivityEventStringLen)
		if userKey == "" && sessionKey == "" {
			return nil, fmt.Errorf("events[%d] requires userId or sessionId", index)
		}

		occurredAt := now
		if raw := strings.TrimSpace(event.OccurredAt); raw != "" {
			parsed, err := time.Parse(time.RFC3339Nano, raw)
			if err != nil {
				return nil, fmt.Errorf("events[%d].occurredAt must be a valid RFC3339 timestamp", index)
			}
			occurredAt = parsed.UTC()
		}

		metadataJSON, err := normalizeActivityJSON(event.Metadata, maxActivityJSONBytes)
		if err != nil {
			return nil, fmt.Errorf("events[%d].metadata %v", index, err)
		}

		contextPayload := map[string]any{}
		for key, value := range event.Context {
			contextPayload[key] = value
		}
		if strings.TrimSpace(ctx.Path) != "" {
			contextPayload["ingestPath"] = ctx.Path
		}
		if strings.TrimSpace(ctx.UserAgent) != "" {
			contextPayload["userAgent"] = ctx.UserAgent
		}

		contextJSON, err := normalizeActivityJSON(contextPayload, maxActivityJSONBytes)
		if err != nil {
			return nil, fmt.Errorf("events[%d].context %v", index, err)
		}

		eventKey := normalizeActivityString(event.EventKey, maxActivityEventStringLen)
		if eventKey == "" {
			eventKey = db.BuildActivityEventKey(db.ActivityEventKeyInput{
				Source:     source,
				EventName:  eventName,
				UserKey:    userKey,
				SessionKey: sessionKey,
				EntityType: normalizeActivityString(event.EntityType, maxActivityEventStringLen),
				EntityID:   normalizeActivityString(event.EntityID, maxActivityEventStringLen),
				PagePath:   normalizeActivityString(event.PagePath, maxActivityEventStringLen),
				OccurredAt: occurredAt,
				Metadata:   event.Metadata,
				Context:    contextPayload,
			})
		}

		normalized = append(normalized, db.UserActivityEventInsert{
			Source:             source,
			EventName:          eventName,
			EventKey:           normalizeActivityString(eventKey, maxActivityEventStringLen),
			UserKey:            userKey,
			SessionKey:         sessionKey,
			EntityType:         normalizeActivityString(event.EntityType, maxActivityEventStringLen),
			EntityID:           normalizeActivityString(event.EntityID, maxActivityEventStringLen),
			PagePath:           normalizeActivityString(event.PagePath, maxActivityEventStringLen),
			Referrer:           normalizeActivityString(event.Referrer, maxActivityEventStringLen),
			UTMSource:          normalizeActivityString(event.UTMSource, maxActivityEventStringLen),
			UTMMedium:          normalizeActivityString(event.UTMMedium, maxActivityEventStringLen),
			UTMCampaign:        normalizeActivityString(event.UTMCampaign, maxActivityEventStringLen),
			UTMContent:         normalizeActivityString(event.UTMContent, maxActivityEventStringLen),
			UTMTerm:            normalizeActivityString(event.UTMTerm, maxActivityEventStringLen),
			TelegramStartParam: normalizeActivityString(event.TelegramStartParam, maxActivityEventStringLen),
			Metadata:           metadataJSON,
			Context:            contextJSON,
			OccurredAt:         occurredAt,
		})
	}

	return normalized, nil
}

func normalizeActivitySource(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "landing":
		return "landing"
	case "telegram", "telegram_bot":
		return "telegram"
	default:
		return ""
	}
}

func normalizeActivityString(value string, maxLen int) string {
	trimmed := strings.TrimSpace(value)
	if maxLen > 0 && len(trimmed) > maxLen {
		return trimmed[:maxLen]
	}
	return trimmed
}

func normalizeActivityJSON(payload map[string]any, maxBytes int) (string, error) {
	if payload == nil {
		return `{}`, nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("must be valid JSON")
	}
	if len(data) > maxBytes {
		return "", fmt.Errorf("exceeds %d bytes", maxBytes)
	}
	return string(data), nil
}
