-- +goose Up
-- +goose StatementBegin
ALTER TABLE user_activity_events
    ADD COLUMN utm_source          TEXT NOT NULL DEFAULT '',
    ADD COLUMN utm_medium          TEXT NOT NULL DEFAULT '',
    ADD COLUMN utm_campaign        TEXT NOT NULL DEFAULT '',
    ADD COLUMN utm_content         TEXT NOT NULL DEFAULT '',
    ADD COLUMN utm_term            TEXT NOT NULL DEFAULT '',
    ADD COLUMN telegram_start_param TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_user_activity_events_utm_campaign
    ON user_activity_events (utm_campaign, occurred_at DESC)
    WHERE utm_campaign <> '';

CREATE INDEX IF NOT EXISTS idx_user_activity_events_utm_source
    ON user_activity_events (utm_source, occurred_at DESC)
    WHERE utm_source <> '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_user_activity_events_utm_source;
DROP INDEX IF EXISTS idx_user_activity_events_utm_campaign;
ALTER TABLE user_activity_events
    DROP COLUMN IF EXISTS telegram_start_param,
    DROP COLUMN IF EXISTS utm_term,
    DROP COLUMN IF EXISTS utm_content,
    DROP COLUMN IF EXISTS utm_campaign,
    DROP COLUMN IF EXISTS utm_medium,
    DROP COLUMN IF EXISTS utm_source;
-- +goose StatementEnd
