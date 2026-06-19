package app

import (
	"database/sql"
	"secret-dinner/internal/db"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

var allowedUserTags = map[string]struct{}{
	"vip": {}, "influencer": {}, "investor": {}, "partner": {},
	"student": {}, "media": {}, "referral_leader": {}, "inactive": {},
}

func (l *landingApp) addUserTagHandler() fiber.Handler {
	type request struct {
		Tag string `json:"tag"`
	}
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "admin users storage is not configured"})
		}
		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		if source == "" || userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source and user id are required"})
		}

		var body request
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		tag := strings.ToLower(strings.TrimSpace(body.Tag))
		if tag == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tag is required"})
		}
		if len(tag) > 60 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tag must be 60 characters or fewer"})
		}
		if _, ok := allowedUserTags[tag]; !ok && !strings.HasPrefix(tag, "custom:") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "tag must be one of the supported CRM tags or start with custom:"})
		}

		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		if err := l.connections.AdminUsers.AddUserTag(source, userID, tag, username); err != nil {
			log.WithError(err).Error("failed to add user tag")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to add tag"})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "user_tag_added",
			EntityType: "engagement_user",
			EntityID:   source + ":" + userID,
			NewValue:   mustMarshalAuditJSON(map[string]string{"tag": tag}),
		})

		tags, err := l.connections.AdminUsers.GetUserTags(source, userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reload tags"})
		}
		return c.JSON(fiber.Map{"ok": true, "tags": tags})
	}
}

func (l *landingApp) removeUserTagHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "admin users storage is not configured"})
		}
		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		tag := strings.TrimSpace(c.Params("tag"))
		if source == "" || userID == "" || tag == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source, user id, and tag are required"})
		}

		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		if err := l.connections.AdminUsers.RemoveUserTag(source, userID, tag); err != nil {
			log.WithError(err).Error("failed to remove user tag")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to remove tag"})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType:    "user_tag_removed",
			EntityType:    "engagement_user",
			EntityID:      source + ":" + userID,
			PreviousValue: mustMarshalAuditJSON(map[string]string{"tag": tag}),
		})
		_ = username

		tags, err := l.connections.AdminUsers.GetUserTags(source, userID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reload tags"})
		}
		return c.JSON(fiber.Map{"ok": true, "tags": tags})
	}
}

func (l *landingApp) addUserNoteHandler() fiber.Handler {
	type request struct {
		NoteText string `json:"noteText"`
	}
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "admin users storage is not configured"})
		}
		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		if source == "" || userID == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source and user id are required"})
		}

		var body request
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
		}
		noteText := strings.TrimSpace(body.NoteText)
		if noteText == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "noteText is required"})
		}
		if len(noteText) > 2000 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "note must be 2000 characters or fewer"})
		}

		username, _ := c.Locals(adminUsernameLocalsKey).(string)
		note, err := l.connections.AdminUsers.AddUserNote(source, userID, noteText, username)
		if err != nil {
			log.WithError(err).Error("failed to add user note")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to add note"})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType: "user_note_added",
			EntityType: "engagement_user",
			EntityID:   source + ":" + userID,
			NewValue: mustMarshalAuditJSON(map[string]any{
				"noteId":   note.ID,
				"noteText": noteText,
			}),
		})

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "note": note})
	}
}

func (l *landingApp) deleteUserNoteHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if l.connections.AdminUsers == nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "admin users storage is not configured"})
		}
		source := strings.TrimSpace(c.Params("source"))
		userID := strings.TrimSpace(c.Params("id"))
		noteIDStr := strings.TrimSpace(c.Params("noteId"))
		if source == "" || userID == "" || noteIDStr == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "source, user id, and note id are required"})
		}

		noteID, err := strconv.ParseInt(noteIDStr, 10, 64)
		if err != nil || noteID <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid note id"})
		}

		if err := l.connections.AdminUsers.DeleteUserNote(source, userID, noteID); err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "note not found"})
			}
			log.WithError(err).Error("failed to delete user note")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete note"})
		}

		l.writeAdminAuditLog(c, db.AdminAuditLogEntry{
			ActionType:    "user_note_deleted",
			EntityType:    "engagement_user",
			EntityID:      source + ":" + userID,
			PreviousValue: mustMarshalAuditJSON(map[string]any{"noteId": noteID}),
		})

		return c.JSON(fiber.Map{"ok": true})
	}
}
