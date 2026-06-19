package db

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

type ActivityEventKeyInput struct {
	Source     string
	EventName  string
	UserKey    string
	SessionKey string
	EntityType string
	EntityID   string
	PagePath   string
	OccurredAt time.Time
	Metadata   map[string]any
	Context    map[string]any
}

var meaningfulEngagementEvents = map[string]struct{}{
	"viewed_dinner":                  {},
	"landing_dinner_viewed":          {},
	"opened_tickets":                 {},
	"selected_package":               {},
	"landing_package_selected":       {},
	"clicked_apply":                  {},
	"landing_form_started":           {},
	"join_form_started":              {},
	"submitted_application":          {},
	"join_form_submitted":            {},
	"landing_dinner_selection_saved": {},
	"landing_form_submitted":         {},
	"accepted_legal":                 {},
	"telegram_legal_preaccepted":     {},
	"referral_used":                  {},
	"telegram_payment_success":       {},
	"quiz_completed":                 {},
}

func BuildEngagementActorKey(source, userKey, sessionKey string) string {
	source = strings.ToLower(strings.TrimSpace(source))
	if source == "" {
		source = "unknown"
	}
	if trimmed := strings.TrimSpace(userKey); trimmed != "" {
		return fmt.Sprintf("%s:u:%s", source, trimmed)
	}
	return fmt.Sprintf("%s:s:%s", source, strings.TrimSpace(sessionKey))
}

func IsMeaningfulEngagementEvent(eventName string) bool {
	_, ok := meaningfulEngagementEvents[strings.ToLower(strings.TrimSpace(eventName))]
	return ok
}

func BuildActivityEventKey(input ActivityEventKeyInput) string {
	source := strings.ToLower(strings.TrimSpace(input.Source))
	eventName := strings.ToLower(strings.TrimSpace(input.EventName))
	if source == "" || eventName == "" {
		return ""
	}

	actorKey := strings.TrimSpace(input.UserKey)
	if actorKey == "" {
		actorKey = strings.TrimSpace(input.SessionKey)
	}
	if actorKey == "" {
		return ""
	}

	scope := firstNonEmptyString(
		stringMetadata(input.Metadata, "screen"),
		stringMetadata(input.Metadata, "action"),
		stringMetadata(input.Metadata, "location"),
		stringMetadata(input.Metadata, "buttonLabel"),
		stringMetadata(input.Metadata, "callbackData"),
		strings.TrimSpace(input.PagePath),
	)
	entityKey := firstNonEmptyString(strings.TrimSpace(input.EntityType), "na") + ":" + firstNonEmptyString(strings.TrimSpace(input.EntityID), stringMetadata(input.Metadata, "dinnerId"), "na")
	logicalStep := firstNonEmptyString(
		stringMetadata(input.Metadata, "logicalStep"),
		stringMetadata(input.Metadata, "step"),
		stringMetadata(input.Metadata, "package"),
		eventName,
	)

	bucket := deriveActivityEventBucket(eventName, input.OccurredAt)
	payload := strings.Join([]string{
		source,
		actorKey,
		eventName,
		scope,
		entityKey,
		logicalStep,
		bucket,
	}, "|")

	sum := sha1.Sum([]byte(payload))
	return hex.EncodeToString(sum[:])
}

func deriveActivityEventBucket(eventName string, occurredAt time.Time) string {
	eventName = strings.ToLower(strings.TrimSpace(eventName))
	switch {
	case isStrictDedupEvent(eventName):
		return "strict"
	case isAggressiveViewEvent(eventName):
		return occurredAt.UTC().Truncate(30 * time.Second).Format(time.RFC3339)
	case isDebouncedClickEvent(eventName):
		return occurredAt.UTC().Truncate(5 * time.Second).Format(time.RFC3339)
	default:
		return occurredAt.UTC().Truncate(time.Minute).Format(time.RFC3339)
	}
}

func isStrictDedupEvent(eventName string) bool {
	switch eventName {
	case "submitted_application",
		"join_form_submitted",
		"landing_dinner_selection_saved",
		"landing_form_submitted",
		"join_form_submit_attempt",
		"telegram_payment_success",
		"accepted_legal",
		"telegram_legal_preaccepted":
		return true
	default:
		return false
	}
}

func isAggressiveViewEvent(eventName string) bool {
	switch eventName {
	case "page_view",
		"screen_view",
		"viewed_dinner",
		"landing_dinner_viewed",
		"landing_dinner_selection_opened",
		"opened_tickets",
		"package_info_viewed",
		"profile_viewed":
		return true
	default:
		return false
	}
}

func isDebouncedClickEvent(eventName string) bool {
	if strings.Contains(eventName, "clicked") {
		return true
	}
	switch eventName {
	case "back", "next", "continue", "landing_return_home":
		return true
	default:
		return false
	}
}

func stringMetadata(metadata map[string]any, key string) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", typed))
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
