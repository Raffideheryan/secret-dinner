package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/lib/pq"
)

const (
	campaignStatusDraft     = "draft"
	campaignStatusScheduled = "scheduled"
	campaignStatusSending   = "sending"
	campaignStatusCompleted = "completed"
	campaignStatusCancelled = "cancelled"
)

type adminCampaignsRepo struct {
	telegramDB *sql.DB
	activityDB *sql.DB
}

func NewAdminCampaignsDB(telegramDB, activityDB *sql.DB) AdminCampaignsDB {
	return &adminCampaignsRepo{
		telegramDB: telegramDB,
		activityDB: activityDB,
	}
}

func (r *adminCampaignsRepo) Close() error {
	return nil
}

func (r *adminCampaignsRepo) ListEngagementCampaigns(params EngagementCampaignListParams) ([]EngagementCampaignRecord, int64, error) {
	if r.telegramDB == nil {
		return []EngagementCampaignRecord{}, 0, nil
	}

	limit := normalizeLimit(params.Limit, 20)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)
	status := strings.ToLower(strings.TrimSpace(params.Status))

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 2)
	if search != "" {
		args = append(args, "%"+search+"%")
		conditions = append(conditions, fmt.Sprintf("(title ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", len(args), len(args)))
	}
	if status != "" && status != "all" {
		args = append(args, status)
		conditions = append(conditions, fmt.Sprintf("status = $%d", len(args)))
	}
	whereSQL := ""
	if len(conditions) > 0 {
		whereSQL = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM engagement_campaigns" + whereSQL
	var total int64
	if err := r.telegramDB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `
		SELECT id
		FROM engagement_campaigns` + whereSQL + fmt.Sprintf(`
		ORDER BY created_at DESC, id DESC
		LIMIT $%d OFFSET $%d
	`, len(args)-1, len(args))
	rows, err := r.telegramDB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	ids := make([]int64, 0, limit)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, 0, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	items := make([]EngagementCampaignRecord, 0, len(ids))
	for _, id := range ids {
		item, err := r.GetEngagementCampaign(id)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, nil
}

func (r *adminCampaignsRepo) GetEngagementCampaign(id int64) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}

	const query = `
		SELECT
			id,
			title,
			COALESCE(description, ''),
			status,
			message_type,
			audience_config,
			message_payload,
			scheduled_for,
			started_at,
			completed_at,
			cancelled_at,
			created_at,
			updated_at,
			COALESCE(created_by, ''),
			rate_limit_per_minute,
			max_retries
		FROM engagement_campaigns
		WHERE id = $1
	`

	var (
		record       EngagementCampaignRecord
		audienceJSON []byte
		messageJSON  []byte
	)
	if err := r.telegramDB.QueryRow(query, id).Scan(
		&record.ID,
		&record.Title,
		&record.Description,
		&record.Status,
		&record.MessageType,
		&audienceJSON,
		&messageJSON,
		&record.ScheduledFor,
		&record.StartedAt,
		&record.CompletedAt,
		&record.CancelledAt,
		&record.CreatedAt,
		&record.UpdatedAt,
		&record.CreatedBy,
		&record.RateLimitPerMinute,
		&record.MaxRetries,
	); err != nil {
		return EngagementCampaignRecord{}, err
	}

	if err := json.Unmarshal(audienceJSON, &record.Audience); err != nil {
		return EngagementCampaignRecord{}, fmt.Errorf("failed to decode audience config: %w", err)
	}
	if err := json.Unmarshal(messageJSON, &record.Message); err != nil {
		return EngagementCampaignRecord{}, fmt.Errorf("failed to decode message payload: %w", err)
	}

	targetUsers, previewUsers, err := r.resolveAudienceUsers(record.Audience, 6)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	record.TargetUsers = int64(len(targetUsers))
	record.PreviewUsers = previewUsers

	metrics, err := r.loadCampaignMetrics(id, targetUsers, record.StartedAt, record.CreatedAt)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	record.Metrics = metrics
	return record, nil
}

func (r *adminCampaignsRepo) CreateEngagementCampaign(payload EngagementCampaignComposerPayload, adminUsername string) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}
	if err := validateCampaignPayload(payload, false); err != nil {
		return EngagementCampaignRecord{}, err
	}

	payload = normalizeCampaignPayload(payload)
	audienceJSON, err := json.Marshal(payload.Audience)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	messageJSON, err := json.Marshal(payload.Message)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}

	tx, err := r.telegramDB.Begin()
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	defer tx.Rollback()

	const query = `
		INSERT INTO engagement_campaigns (
			title,
			description,
			status,
			message_type,
			audience_config,
			message_payload,
			scheduled_for,
			created_by,
			rate_limit_per_minute,
			max_retries,
			created_at,
			updated_at
		) VALUES ($1, $2, $3, $4, CAST($5 AS JSONB), CAST($6 AS JSONB), $7, $8, $9, $10, now(), now())
		RETURNING id
	`
	var id int64
	if err := tx.QueryRow(
		query,
		payload.Title,
		payload.Description,
		payload.Status,
		payload.MessageType,
		string(audienceJSON),
		string(messageJSON),
		payload.ScheduledFor,
		strings.TrimSpace(adminUsername),
		payload.RateLimitPerMinute,
		payload.MaxRetries,
	).Scan(&id); err != nil {
		return EngagementCampaignRecord{}, err
	}

	if err := r.syncCampaignDeliveries(tx, id, payload.Audience); err != nil {
		return EngagementCampaignRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return EngagementCampaignRecord{}, err
	}
	return r.GetEngagementCampaign(id)
}

func (r *adminCampaignsRepo) UpdateEngagementCampaign(id int64, payload EngagementCampaignComposerPayload, adminUsername string) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}
	if err := validateCampaignPayload(payload, true); err != nil {
		return EngagementCampaignRecord{}, err
	}
	payload = normalizeCampaignPayload(payload)
	audienceJSON, err := json.Marshal(payload.Audience)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	messageJSON, err := json.Marshal(payload.Message)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}

	tx, err := r.telegramDB.Begin()
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	defer tx.Rollback()

	var currentStatus string
	if err := tx.QueryRow(`SELECT status FROM engagement_campaigns WHERE id = $1`, id).Scan(&currentStatus); err != nil {
		return EngagementCampaignRecord{}, err
	}
	if currentStatus == campaignStatusSending || currentStatus == campaignStatusCompleted || currentStatus == campaignStatusCancelled {
		return EngagementCampaignRecord{}, fmt.Errorf("campaign in status %q can no longer be edited", currentStatus)
	}

	const query = `
		UPDATE engagement_campaigns
		SET title = $2,
			description = $3,
			status = $4,
			message_type = $5,
			audience_config = CAST($6 AS JSONB),
			message_payload = CAST($7 AS JSONB),
			scheduled_for = $8,
			created_by = CASE WHEN COALESCE(created_by, '') = '' THEN $9 ELSE created_by END,
			rate_limit_per_minute = $10,
			max_retries = $11,
			updated_at = now()
		WHERE id = $1
	`
	result, err := tx.Exec(
		query,
		id,
		payload.Title,
		payload.Description,
		payload.Status,
		payload.MessageType,
		string(audienceJSON),
		string(messageJSON),
		payload.ScheduledFor,
		strings.TrimSpace(adminUsername),
		payload.RateLimitPerMinute,
		payload.MaxRetries,
	)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	if rowsAffected == 0 {
		return EngagementCampaignRecord{}, sql.ErrNoRows
	}

	if err := r.syncCampaignDeliveries(tx, id, payload.Audience); err != nil {
		return EngagementCampaignRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return EngagementCampaignRecord{}, err
	}
	return r.GetEngagementCampaign(id)
}

func (r *adminCampaignsRepo) ScheduleEngagementCampaign(id int64, when *time.Time, sendNow bool, adminUsername string) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}

	status := campaignStatusScheduled
	scheduledFor := when
	if sendNow {
		status = campaignStatusSending
		now := time.Now().UTC()
		scheduledFor = &now
	}

	result, err := r.telegramDB.Exec(`
		UPDATE engagement_campaigns
		SET status = $2,
			scheduled_for = $3,
			cancelled_at = NULL,
			started_at = CASE WHEN $2 = 'sending' AND started_at IS NULL THEN now() ELSE started_at END,
			updated_at = now()
		WHERE id = $1
		  AND status IN ('draft', 'scheduled')
	`, id, status, scheduledFor)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	if rowsAffected == 0 {
		return EngagementCampaignRecord{}, errors.New("only draft or scheduled campaigns can be launched")
	}

	_, _ = adminUsername, when
	return r.GetEngagementCampaign(id)
}

func (r *adminCampaignsRepo) CancelEngagementCampaign(id int64, adminUsername string) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}

	tx, err := r.telegramDB.Begin()
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`
		UPDATE engagement_campaigns
		SET status = 'cancelled',
			cancelled_at = now(),
			updated_at = now()
		WHERE id = $1
		  AND status <> 'completed'
	`, id); err != nil {
		return EngagementCampaignRecord{}, err
	}
	if _, err := tx.Exec(`
		UPDATE engagement_campaign_deliveries
		SET status = 'cancelled',
			updated_at = now()
		WHERE campaign_id = $1
		  AND status IN ('pending', 'retrying')
	`, id); err != nil {
		return EngagementCampaignRecord{}, err
	}
	if _, err := tx.Exec(`
		INSERT INTO engagement_campaign_delivery_logs (
			campaign_id,
			delivery_id,
			user_id,
			event_type,
			status,
			message,
			metadata,
			attempt,
			message_id,
			poll_id,
			created_at
		)
		SELECT
			$1,
			0,
			0,
			'campaign_cancelled',
			'cancelled',
			$2,
			'{}'::jsonb,
			0,
			0,
			'',
			now()
	`, id, fmt.Sprintf("Campaign cancelled by %s", strings.TrimSpace(adminUsername))); err != nil {
		return EngagementCampaignRecord{}, err
	}

	if err := tx.Commit(); err != nil {
		return EngagementCampaignRecord{}, err
	}
	return r.GetEngagementCampaign(id)
}

func (r *adminCampaignsRepo) QueueEngagementCampaignTest(id int64, userID string, adminUsername string) (EngagementCampaignRecord, error) {
	if r.telegramDB == nil {
		return EngagementCampaignRecord{}, sql.ErrConnDone
	}
	trimmedUserID := strings.TrimSpace(userID)
	if trimmedUserID == "" {
		return EngagementCampaignRecord{}, errors.New("test user id is required")
	}

	var messageType string
	if err := r.telegramDB.QueryRow(`SELECT message_type FROM engagement_campaigns WHERE id = $1`, id).Scan(&messageType); err != nil {
		return EngagementCampaignRecord{}, err
	}

	result, err := r.telegramDB.Exec(`
		INSERT INTO engagement_campaign_deliveries (
			campaign_id,
			user_id,
			delivery_kind,
			status,
			attempt_count,
			next_attempt_at,
			created_at,
			updated_at
		) VALUES ($1, $2, 'test', 'pending', 0, now(), now(), now())
		ON CONFLICT (campaign_id, user_id, delivery_kind) DO UPDATE
		SET status = 'pending',
			next_attempt_at = now(),
			updated_at = now()
	`, id, trimmedUserID)
	if err != nil {
		return EngagementCampaignRecord{}, err
	}
	if _, err := result.RowsAffected(); err != nil {
		return EngagementCampaignRecord{}, err
	}

	_, _ = adminUsername, messageType
	return r.GetEngagementCampaign(id)
}

func (r *adminCampaignsRepo) ListEngagementCampaignLogs(id int64, limit int, offset int) ([]EngagementCampaignDeliveryLog, int64, error) {
	if r.telegramDB == nil {
		return []EngagementCampaignDeliveryLog{}, 0, nil
	}
	limit = normalizeLimit(limit, 30)
	offset = normalizeOffset(offset)

	var total int64
	if err := r.telegramDB.QueryRow(`SELECT COUNT(*) FROM engagement_campaign_delivery_logs WHERE campaign_id = $1`, id).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.telegramDB.Query(`
		SELECT
			logs.id,
			logs.campaign_id,
			logs.delivery_id,
			logs.user_id::text,
			COALESCE(u.username, ''),
			logs.event_type,
			logs.status,
			COALESCE(logs.message, ''),
			COALESCE(logs.metadata::text, '{}'),
			COALESCE(ec.message_type, ''),
			COALESCE(ec.message_payload->'poll'->>'question', ''),
			COALESCE(ec.message_payload->'poll'->'options', '[]'::jsonb),
			logs.created_at,
			logs.attempt,
			logs.message_id,
			COALESCE(logs.poll_id, '')
		FROM engagement_campaign_delivery_logs logs
		LEFT JOIN engagement_campaigns ec ON ec.id = logs.campaign_id
		LEFT JOIN users u ON u.id = logs.user_id
		WHERE logs.campaign_id = $1
		ORDER BY logs.created_at DESC, logs.id DESC
		LIMIT $2 OFFSET $3
	`, id, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]EngagementCampaignDeliveryLog, 0, limit)
	for rows.Next() {
		var item EngagementCampaignDeliveryLog
		var optionsJSON []byte
		if err := rows.Scan(
			&item.ID,
			&item.CampaignID,
			&item.DeliveryID,
			&item.UserID,
			&item.Username,
			&item.EventType,
			&item.Status,
			&item.Message,
			&item.Metadata,
			&item.MessageType,
			&item.Question,
			&optionsJSON,
			&item.OccurredAt,
			&item.Attempt,
			&item.MessageID,
			&item.PollID,
		); err != nil {
			return nil, 0, err
		}
		var meta struct {
			ChoiceIndex *int `json:"choiceIndex"`
			Correct     *bool `json:"correct"`
		}
		if err := json.Unmarshal([]byte(item.Metadata), &meta); err == nil {
			item.ChoiceIndex = meta.ChoiceIndex
			item.Correct = meta.Correct
		}
		if item.ChoiceIndex != nil {
			var options []string
			if err := json.Unmarshal(optionsJSON, &options); err == nil {
				if idx := *item.ChoiceIndex; idx >= 0 && idx < len(options) {
					item.ChoiceLabel = options[idx]
				}
			}
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (r *adminCampaignsRepo) GetEngagementCampaignOptions() (EngagementCampaignOptions, error) {
	if r.telegramDB == nil {
		return EngagementCampaignOptions{}, sql.ErrConnDone
	}

	dinnerRows, err := r.telegramDB.Query(`
		SELECT id::text, COALESCE(description, 'Dinner #' || id::text) AS label
		FROM dinners
		ORDER BY dinner_date DESC, id DESC
		LIMIT 100
	`)
	if err != nil {
		return EngagementCampaignOptions{}, err
	}
	defer dinnerRows.Close()

	result := EngagementCampaignOptions{
		Dinners:  make([]EngagementFilterOption, 0, 32),
		Packages: make([]EngagementFilterOption, 0, 16),
	}
	for dinnerRows.Next() {
		var item EngagementFilterOption
		if err := dinnerRows.Scan(&item.Value, &item.Label); err != nil {
			return EngagementCampaignOptions{}, err
		}
		result.Dinners = append(result.Dinners, item)
	}
	if err := dinnerRows.Err(); err != nil {
		return EngagementCampaignOptions{}, err
	}

	packageRows, err := r.telegramDB.Query(`
		SELECT DISTINCT COALESCE(menu, '')
		FROM package_info
		WHERE NULLIF(BTRIM(COALESCE(menu, '')), '') IS NOT NULL
		ORDER BY 1 ASC
	`)
	if err != nil {
		return EngagementCampaignOptions{}, err
	}
	defer packageRows.Close()
	seenPackages := make(map[string]struct{})
	for packageRows.Next() {
		var storedMenu string
		if err := packageRows.Scan(&storedMenu); err != nil {
			return EngagementCampaignOptions{}, err
		}
		value, label, _ := deriveApplicationPackageMeta(storedMenu)
		if strings.TrimSpace(value) == "" {
			continue
		}
		if _, exists := seenPackages[value]; exists {
			continue
		}
		seenPackages[value] = struct{}{}
		result.Packages = append(result.Packages, EngagementFilterOption{
			Value: value,
			Label: label,
		})
	}
	return result, packageRows.Err()
}

func validateCampaignPayload(payload EngagementCampaignComposerPayload, allowScheduled bool) error {
	payload.Title = strings.TrimSpace(payload.Title)
	if payload.Title == "" {
		return errors.New("campaign title is required")
	}
	switch strings.TrimSpace(payload.MessageType) {
	case "text", "photo", "image", "video", "document", "audio", "voice", "location", "contact", "poll", "quiz", "rating":
	default:
		return fmt.Errorf("unsupported message type %q", payload.MessageType)
	}
	switch strings.TrimSpace(payload.Status) {
	case "", campaignStatusDraft, campaignStatusScheduled:
	case campaignStatusSending:
		if !allowScheduled {
			return errors.New("campaigns cannot be created directly in sending state")
		}
	default:
		return fmt.Errorf("unsupported campaign status %q", payload.Status)
	}
	if strings.TrimSpace(payload.Audience.AudienceType) == "" {
		return errors.New("audience type is required")
	}
	if payload.RateLimitPerMinute < 0 {
		return errors.New("rate limit cannot be negative")
	}
	if payload.MaxRetries < 0 {
		return errors.New("max retries cannot be negative")
	}
	if err := validateCampaignMessageMedia(payload.MessageType, payload.Message.Media); err != nil {
		return err
	}
	return nil
}

func validateCampaignMessageMedia(messageType string, media *EngagementCampaignMedia) error {
	messageType = strings.ToLower(strings.TrimSpace(messageType))
	if media == nil {
		return nil
	}
	kind := strings.ToLower(strings.TrimSpace(media.Kind))
	value := strings.TrimSpace(media.Value)
	if value == "" {
		return nil
	}
	if kind != "url" {
		return nil
	}

	parsed, err := url.Parse(value)
	if err != nil || parsed == nil || parsed.Host == "" {
		return errors.New("media URL is invalid")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("media URL must use http or https")
	}

	host := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if isUnsupportedCampaignWebPageHost(host) {
		return fmt.Errorf("%s campaigns require a direct media file URL, not a webpage link from %s", messageType, host)
	}

	ext := strings.ToLower(path.Ext(parsed.Path))
	switch messageType {
	case "video":
		if !hasAllowedMediaExtension(ext, ".mp4", ".mov", ".m4v", ".webm") {
			return errors.New("video campaigns require a direct video file URL such as .mp4")
		}
	case "photo", "image":
		if !hasAllowedMediaExtension(ext, ".jpg", ".jpeg", ".png", ".webp", ".gif") {
			return errors.New("image campaigns require a direct image file URL such as .jpg or .png")
		}
	case "audio":
		if !hasAllowedMediaExtension(ext, ".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac") {
			return errors.New("audio campaigns require a direct audio file URL such as .mp3")
		}
	case "voice":
		if !hasAllowedMediaExtension(ext, ".ogg", ".oga", ".opus") {
			return errors.New("voice campaigns require a direct voice file URL such as .ogg")
		}
	case "document":
		if ext == "" {
			return errors.New("document campaigns require a direct file URL with an extension such as .pdf or .docx")
		}
	}
	return nil
}

func isUnsupportedCampaignWebPageHost(host string) bool {
	switch host {
	case "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "facebook.com", "www.facebook.com", "instagram.com", "www.instagram.com", "tiktok.com", "www.tiktok.com":
		return true
	default:
		return false
	}
}

func hasAllowedMediaExtension(ext string, allowed ...string) bool {
	if ext == "" {
		return false
	}
	for _, item := range allowed {
		if ext == item {
			return true
		}
	}
	return false
}

func normalizeCampaignPayload(payload EngagementCampaignComposerPayload) EngagementCampaignComposerPayload {
	payload.Title = strings.TrimSpace(payload.Title)
	payload.Description = strings.TrimSpace(payload.Description)
	payload.MessageType = strings.ToLower(strings.TrimSpace(payload.MessageType))
	payload.Status = strings.ToLower(strings.TrimSpace(payload.Status))
	payload.Audience.AudienceType = strings.ToLower(strings.TrimSpace(payload.Audience.AudienceType))
	payload.Audience.Language = strings.ToLower(strings.TrimSpace(payload.Audience.Language))
	payload.Audience.Search = strings.TrimSpace(payload.Audience.Search)
	payload.Message.ParseMode = strings.TrimSpace(payload.Message.ParseMode)
	if payload.Status == "" {
		payload.Status = campaignStatusDraft
	}
	if payload.RateLimitPerMinute <= 0 {
		payload.RateLimitPerMinute = 60
	}
	if payload.MaxRetries <= 0 {
		payload.MaxRetries = 3
	}
	return payload
}

func (r *adminCampaignsRepo) syncCampaignDeliveries(tx *sql.Tx, campaignID int64, audience EngagementCampaignAudienceConfig) error {
	users, _, err := r.resolveAudienceUsers(audience, 0)
	if err != nil {
		return err
	}
	userIDs := make([]string, 0, len(users))
	for _, item := range users {
		userIDs = append(userIDs, item.UserID)
	}

	if _, err := tx.Exec(`
		DELETE FROM engagement_campaign_deliveries
		WHERE campaign_id = $1
		  AND delivery_kind = 'normal'
		  AND status IN ('pending', 'retrying', 'cancelled')
		  AND NOT (user_id::text = ANY($2))
	`, campaignID, pq.Array(userIDs)); err != nil {
		return err
	}

	for _, userID := range userIDs {
		if _, err := tx.Exec(`
			INSERT INTO engagement_campaign_deliveries (
				campaign_id,
				user_id,
				delivery_kind,
				status,
				attempt_count,
				next_attempt_at,
				created_at,
				updated_at
			) VALUES ($1, $2, 'normal', 'pending', 0, now(), now(), now())
			ON CONFLICT (campaign_id, user_id, delivery_kind) DO UPDATE
			SET updated_at = now()
			WHERE engagement_campaign_deliveries.status NOT IN ('sent', 'blocked')
		`, campaignID, userID); err != nil {
			return err
		}
	}
	return nil
}

func (r *adminCampaignsRepo) resolveAudienceUsers(audience EngagementCampaignAudienceConfig, previewLimit int) ([]EngagementCampaignAudienceUser, []EngagementCampaignAudienceUser, error) {
	if r.telegramDB == nil {
		return nil, nil, sql.ErrConnDone
	}

	audience = normalizeAudienceConfig(audience)
	args := make([]any, 0, 12)
	conditions := make([]string, 0, 12)

	if !audience.IncludeBlocked {
		conditions = append(conditions, `NOT EXISTS (
			SELECT 1
			FROM blocked_users bu
			WHERE bu.user_id = u.id
			  AND (bu.unblock_date IS NULL OR bu.unblock_date > now())
		)`)
	}
	if audience.Language != "" {
		args = append(args, audience.Language)
		conditions = append(conditions, fmt.Sprintf(`LOWER(COALESCE(u.language, '')) = $%d`, len(args)))
	}
	if audience.TermsAccepted != nil {
		args = append(args, *audience.TermsAccepted)
		conditions = append(conditions, fmt.Sprintf(`u.terms_accepted = $%d`, len(args)))
	}
	if audience.Search != "" {
		args = append(args, "%"+audience.Search+"%")
		conditions = append(conditions, fmt.Sprintf(`(
			COALESCE(u.username, '') ILIKE $%d OR
			COALESCE(u.name, '') ILIKE $%d OR
			COALESCE(u.surname, '') ILIKE $%d OR
			COALESCE(u.phone, '') ILIKE $%d OR
			u.id::text ILIKE $%d
		)`, len(args), len(args), len(args), len(args), len(args)))
	}
	if len(audience.SelectedUsers) > 0 {
		args = append(args, pq.Array(audience.SelectedUsers))
		conditions = append(conditions, fmt.Sprintf(`u.id::text = ANY($%d)`, len(args)))
	}
	if len(audience.DinnerIDs) > 0 {
		args = append(args, pq.Array(audience.DinnerIDs))
		conditions = append(conditions, fmt.Sprintf(`EXISTS (
			SELECT 1
			FROM package_info pi
			WHERE pi.user_id = u.id
			  AND pi.dinner_id = ANY($%d)
		)`, len(args)))
	}
	if len(audience.Packages) > 0 {
		args = append(args, pq.Array(audience.Packages))
		conditions = append(conditions, fmt.Sprintf(`EXISTS (
			SELECT 1
			FROM package_info pi
			WHERE pi.user_id = u.id
			  AND LOWER(COALESCE(pi.menu, '')) LIKE ANY(
			  	SELECT '%%' || item || '%%'
			  	FROM unnest($%d::text[]) AS item
			  )
		)`, len(args)))
	}

	switch audience.AudienceType {
	case "all_users", "custom":
	case "active_users", "passive_users":
		ids, err := r.loadActiveAudienceUserIDs()
		if err != nil {
			return nil, nil, err
		}
		if len(ids) == 0 {
			if audience.AudienceType == "active_users" {
				return []EngagementCampaignAudienceUser{}, []EngagementCampaignAudienceUser{}, nil
			}
		} else {
			args = append(args, pq.Array(ids))
			condition := fmt.Sprintf(`u.id::text = ANY($%d)`, len(args))
			if audience.AudienceType == "passive_users" {
				condition = "NOT (" + condition + ")"
			}
			conditions = append(conditions, condition)
		}
	case "paid_users":
		conditions = append(conditions, "COALESCE(u.total_payments, 0) > 0")
	case "unpaid_users":
		conditions = append(conditions, "COALESCE(u.total_payments, 0) <= 0")
	case "vip_users":
		conditions = append(conditions, `EXISTS (
			SELECT 1
			FROM package_info pi
			WHERE pi.user_id = u.id
			  AND LOWER(COALESCE(pi.menu, '')) LIKE '%vip%'
		)`)
	case "referral_users":
		conditions = append(conditions, `(COALESCE(u.friends_invited, 0) > 0 OR NULLIF(BTRIM(COALESCE(u.referral_used_code, '')), '') IS NOT NULL)`)
	case "selected_users", "users_by_dinner", "users_by_package":
	default:
		return nil, nil, fmt.Errorf("unsupported audience type %q", audience.AudienceType)
	}

	query := `
		SELECT
			u.id::text,
			TRIM(BOTH FROM CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.surname, ''))) AS name,
			COALESCE(u.username, ''),
			COALESCE(u.phone, ''),
			COALESCE((
				SELECT pi.status
				FROM package_info pi
				WHERE pi.user_id = u.id
				ORDER BY pi.updated_at DESC, pi.id DESC
				LIMIT 1
			), '')
		FROM users u
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY u.updated_at DESC, u.id DESC"

	rows, err := r.telegramDB.Query(query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	all := make([]EngagementCampaignAudienceUser, 0, 64)
	for rows.Next() {
		var item EngagementCampaignAudienceUser
		if err := rows.Scan(&item.UserID, &item.Name, &item.Username, &item.Phone, &item.Status); err != nil {
			return nil, nil, err
		}
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			item.Name = item.Username
		}
		if item.Name == "" {
			item.Name = "User #" + item.UserID
		}
		all = append(all, item)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	preview := []EngagementCampaignAudienceUser{}
	if previewLimit > 0 {
		if len(all) > previewLimit {
			preview = append(preview, all[:previewLimit]...)
		} else {
			preview = append(preview, all...)
		}
	}
	return all, preview, nil
}

func normalizeAudienceConfig(audience EngagementCampaignAudienceConfig) EngagementCampaignAudienceConfig {
	audience.AudienceType = strings.ToLower(strings.TrimSpace(audience.AudienceType))
	audience.Language = strings.ToLower(strings.TrimSpace(audience.Language))
	audience.Search = strings.TrimSpace(audience.Search)
	for index, item := range audience.Packages {
		audience.Packages[index] = strings.ToLower(strings.TrimSpace(item))
	}
	for index, item := range audience.SelectedUsers {
		audience.SelectedUsers[index] = strings.TrimSpace(item)
	}
	return audience
}

func (r *adminCampaignsRepo) loadActiveAudienceUserIDs() ([]string, error) {
	return loadMeaningfulActiveUserKeys(r.activityDB, "telegram", time.Now().UTC().AddDate(0, 0, -30))
}

func (r *adminCampaignsRepo) loadCampaignMetrics(campaignID int64, audienceUsers []EngagementCampaignAudienceUser, startedAt *time.Time, createdAt time.Time) (EngagementCampaignDeliveryMetrics, error) {
	metrics := EngagementCampaignDeliveryMetrics{}
	if r.telegramDB == nil {
		return metrics, sql.ErrConnDone
	}

	const deliveryQuery = `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'pending') AS pending,
			COUNT(*) FILTER (WHERE status = 'sending') AS sending,
			COUNT(*) FILTER (WHERE status = 'sent') AS sent,
			COUNT(*) FILTER (WHERE status = 'failed') AS failed,
			COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
			COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
			COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
			COUNT(*) FILTER (WHERE button_clicks > 0) AS clicked_users,
			COALESCE(SUM(button_clicks), 0) AS button_clicks,
			COALESCE(SUM(poll_votes), 0) AS poll_votes,
			COALESCE(SUM(quiz_correct_answers), 0) AS quiz_correct
		FROM engagement_campaign_deliveries
		WHERE campaign_id = $1
	`
	if err := r.telegramDB.QueryRow(deliveryQuery, campaignID).Scan(
		&metrics.Total,
		&metrics.Pending,
		&metrics.Sending,
		&metrics.Sent,
		&metrics.Failed,
		&metrics.Blocked,
		&metrics.Skipped,
		&metrics.Cancelled,
		&metrics.ClickedUsers,
		&metrics.ButtonClicks,
		&metrics.PollVotes,
		&metrics.QuizCorrect,
	); err != nil {
		return metrics, err
	}

	if len(audienceUsers) == 0 {
		return metrics, nil
	}
	userIDs := make([]string, 0, len(audienceUsers))
	for _, item := range audienceUsers {
		userIDs = append(userIDs, item.UserID)
	}
	anchor := createdAt
	if startedAt != nil && !startedAt.IsZero() {
		anchor = startedAt.UTC()
	}

	if err := r.telegramDB.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE created_at >= $2) AS applications_after,
			COUNT(*) FILTER (WHERE status = 'paid' AND updated_at >= $2) AS payments_after,
			COALESCE(SUM(CASE WHEN status = 'paid' AND updated_at >= $2 THEN price ELSE 0 END), 0) AS revenue_after
		FROM package_info
		WHERE user_id::text = ANY($1)
	`, pq.Array(userIDs), anchor).Scan(
		&metrics.ApplicationsAfter,
		&metrics.PaymentsAfter,
		&metrics.RevenueAfter,
	); err != nil {
		return metrics, err
	}
	return metrics, nil
}
