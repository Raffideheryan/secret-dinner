package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (r *adminUsersRepo) GetUserTags(source, userKey string) ([]EngagementUserTag, error) {
	if r.activityDB == nil || userKey == "" {
		return []EngagementUserTag{}, nil
	}
	rows, err := r.activityDB.Query(`
		SELECT tag, created_by, created_at
		FROM user_admin_tags
		WHERE source = $1 AND user_key = $2
		ORDER BY created_at ASC
	`, source, userKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]EngagementUserTag, 0, 8)
	for rows.Next() {
		var tag string
		var createdBy string
		var createdAt time.Time
		if err := rows.Scan(&tag, &createdBy, &createdAt); err != nil {
			return nil, err
		}
		items = append(items, EngagementUserTag{
			Tag:       tag,
			CreatedBy: createdBy,
			CreatedAt: createdAt.UTC().Format(time.RFC3339),
		})
	}
	return items, rows.Err()
}

var supportedCRMTags = map[string]struct{}{
	"vip":                {},
	"high-value":         {},
	"referral-champion":  {},
	"churn-risk":         {},
	"no-show-risk":       {},
	"needs-follow-up":    {},
	"private-table":      {},
	"dietary-sensitive":  {},
	"influencer":         {},
	"corporate":          {},
}

func validateCRMTag(tag string) error {
	if tag == "" {
		return errors.New("tag must not be empty")
	}
	if len(tag) > 60 {
		return errors.New("tag must not exceed 60 characters")
	}
	if _, ok := supportedCRMTags[tag]; ok {
		return nil
	}
	if strings.HasPrefix(tag, "custom:") {
		suffix := strings.TrimPrefix(tag, "custom:")
		if strings.TrimSpace(suffix) == "" {
			return errors.New("custom tag must have a non-empty suffix after 'custom:'")
		}
		return nil
	}
	return fmt.Errorf("unsupported tag %q: use a predefined tag or prefix with 'custom:'", tag)
}

func (r *adminUsersRepo) AddUserTag(source, userKey, tag, createdBy string) error {
	if r.activityDB == nil {
		return errors.New("activity DB not configured")
	}
	tag = strings.TrimSpace(tag)
	if userKey == "" {
		return errors.New("userKey is required")
	}
	if err := validateCRMTag(tag); err != nil {
		return err
	}
	_, err := r.activityDB.Exec(`
		INSERT INTO user_admin_tags (source, user_key, tag, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (source, user_key, tag) DO NOTHING
	`, source, userKey, tag, createdBy)
	return err
}

func (r *adminUsersRepo) RemoveUserTag(source, userKey, tag string) error {
	if r.activityDB == nil {
		return errors.New("activity DB not configured")
	}
	_, err := r.activityDB.Exec(`
		DELETE FROM user_admin_tags
		WHERE source = $1 AND user_key = $2 AND tag = $3
	`, source, userKey, tag)
	return err
}

func (r *adminUsersRepo) GetUserNotes(source, userKey string) ([]EngagementUserNote, error) {
	if r.activityDB == nil || userKey == "" {
		return []EngagementUserNote{}, nil
	}
	rows, err := r.activityDB.Query(`
		SELECT id, note_text, created_by, created_at
		FROM user_admin_notes
		WHERE source = $1 AND user_key = $2
		ORDER BY created_at DESC
		LIMIT 50
	`, source, userKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]EngagementUserNote, 0, 8)
	for rows.Next() {
		var item EngagementUserNote
		var createdAt time.Time
		if err := rows.Scan(&item.ID, &item.NoteText, &item.CreatedBy, &createdAt); err != nil {
			return nil, err
		}
		item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *adminUsersRepo) AddUserNote(source, userKey, noteText, createdBy string) (EngagementUserNote, error) {
	if r.activityDB == nil {
		return EngagementUserNote{}, errors.New("activity DB not configured")
	}
	noteText = strings.TrimSpace(noteText)
	if noteText == "" || userKey == "" {
		return EngagementUserNote{}, errors.New("noteText and userKey are required")
	}
	var id int64
	var createdAt time.Time
	err := r.activityDB.QueryRow(`
		INSERT INTO user_admin_notes (source, user_key, note_text, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, source, userKey, noteText, createdBy).Scan(&id, &createdAt)
	if err != nil {
		return EngagementUserNote{}, err
	}
	return EngagementUserNote{
		ID:        id,
		NoteText:  noteText,
		CreatedBy: createdBy,
		CreatedAt: createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func (r *adminUsersRepo) DeleteUserNote(source, userKey string, noteID int64) error {
	if r.activityDB == nil {
		return errors.New("activity DB not configured")
	}
	result, err := r.activityDB.Exec(`
		DELETE FROM user_admin_notes
		WHERE id = $1 AND source = $2 AND user_key = $3
	`, noteID, source, userKey)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *adminUsersRepo) loadUserDinnerInterest(source, userKey string) ([]EngagementUserDinnerInterest, error) {
	if r.activityDB == nil || userKey == "" {
		return []EngagementUserDinnerInterest{}, nil
	}
	rows, err := r.activityDB.Query(`
		SELECT
			events.entity_id,
			COALESCE(NULLIF(ld.description, ''), 'Dinner #' || events.entity_id) AS dinner_name,
			COUNT(*) AS view_count,
			MAX(events.occurred_at) AS last_view_at
		FROM user_activity_events events
		LEFT JOIN landing_dinners ld
			ON events.entity_type = 'dinner'
			AND NULLIF(events.entity_id, '') IS NOT NULL
			AND ld.id = CAST(events.entity_id AS BIGINT)
		WHERE events.source = $1
			AND events.user_key = $2
			AND events.entity_type = 'dinner'
			AND NULLIF(events.entity_id, '') IS NOT NULL
			AND events.event_name IN (
				'viewed_dinner', 'landing_dinner_viewed', 'opened_tickets',
				'landing_dinner_viewed', 'landing_dinner_selection_opened'
			)
		GROUP BY events.entity_id, ld.description
		ORDER BY view_count DESC, last_view_at DESC
		LIMIT 10
	`, source, userKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]EngagementUserDinnerInterest, 0, 8)
	dinnerIDs := make([]string, 0, 8)
	for rows.Next() {
		var item EngagementUserDinnerInterest
		var lastViewAt time.Time
		if err := rows.Scan(&item.DinnerID, &item.DinnerName, &item.ViewCount, &lastViewAt); err != nil {
			return nil, err
		}
		item.LastViewAt = lastViewAt.UTC().Format(time.RFC3339)
		dinnerIDs = append(dinnerIDs, item.DinnerID)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(dinnerIDs) > 0 {
		appliedSet, err := r.loadAppliedDinnerIDs(source, userKey, dinnerIDs)
		if err == nil {
			for i := range items {
				items[i].Applied = appliedSet[items[i].DinnerID]
			}
		}
	}
	return items, nil
}

func (r *adminUsersRepo) loadAppliedDinnerIDs(source, userKey string, dinnerIDs []string) (map[string]bool, error) {
	result := make(map[string]bool, len(dinnerIDs))
	if r.activityDB == nil {
		return result, nil
	}
	inClause, args := buildTextInClause(dinnerIDs, 3)
	rows, err := r.activityDB.Query(
		`SELECT DISTINCT entity_id FROM user_activity_events
		WHERE source = $1 AND user_key = $2 AND entity_type = 'dinner'
			AND event_name IN ('submitted_application', 'landing_dinner_selection_saved', 'join_form_submitted')
			AND entity_id IN (`+inClause+`)`,
		append([]any{source, userKey}, args...)...,
	)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return result, err
		}
		result[id] = true
	}
	return result, rows.Err()
}

func (r *adminUsersRepo) loadUserCampaignResponses(telegramUserID int64) ([]EngagementUserCampaignResponse, error) {
	if r.telegramDB == nil || telegramUserID <= 0 {
		return []EngagementUserCampaignResponse{}, nil
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			ec.id,
			ec.title,
			ec.message_type,
			COALESCE(ec.message_payload->'poll'->>'question', '') AS question,
			COALESCE(ec.message_payload->'poll'->'options', '[]'::jsonb) AS options_json,
			ecl.metadata,
			ecl.created_at
		FROM engagement_campaign_delivery_logs ecl
		JOIN engagement_campaigns ec ON ec.id = ecl.campaign_id
		WHERE ecl.event_type = 'poll_answer'
		  AND ecl.user_id = $1
		ORDER BY ecl.created_at DESC
		LIMIT 50
	`, telegramUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]EngagementUserCampaignResponse, 0, 8)
	for rows.Next() {
		var item EngagementUserCampaignResponse
		var optionsJSON []byte
		var metaJSON []byte
		var occurredAt time.Time
		if err := rows.Scan(
			&item.CampaignID,
			&item.CampaignTitle,
			&item.MessageType,
			&item.Question,
			&optionsJSON,
			&metaJSON,
			&occurredAt,
		); err != nil {
			return nil, err
		}
		item.OccurredAt = occurredAt.UTC().Format(time.RFC3339)

		var meta struct {
			ChoiceIndex int  `json:"choiceIndex"`
			Correct     bool `json:"correct"`
		}
		if err := json.Unmarshal(metaJSON, &meta); err == nil {
			item.ChoiceIndex = meta.ChoiceIndex
			item.Correct = meta.Correct
		}

		var options []string
		if err := json.Unmarshal(optionsJSON, &options); err == nil {
			if meta.ChoiceIndex >= 0 && meta.ChoiceIndex < len(options) {
				item.ChoiceLabel = options[meta.ChoiceIndex]
			}
		}

		items = append(items, item)
	}
	return items, rows.Err()
}

func scoreLoyaltyUser(points int64, paidBookings int64, attendanceCount int64, totalEvents int64, activeDays int64) int {
	score := 0
	score += clampInt(int(points/10), 0, 20)
	score += clampInt(int(paidBookings*15), 0, 30)
	score += clampInt(int(attendanceCount*10), 0, 20)
	score += clampInt(int(totalEvents/5), 0, 15)
	score += clampInt(int(activeDays), 0, 15)
	if score > 100 {
		score = 100
	}
	return score
}

func scoreReferralUser(invitedUsers int64, referralEvents int64, referralClicks int64, referralSuccesses int64) int {
	score := 0
	score += clampInt(int(invitedUsers*15), 0, 60)
	score += clampInt(int(referralEvents*5), 0, 20)
	score += clampInt(int(referralClicks*3), 0, 12)
	score += clampInt(int(referralSuccesses*8), 0, 8)
	if score > 100 {
		score = 100
	}
	return score
}
