-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_activity_events (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_key TEXT NOT NULL DEFAULT '',
    user_key TEXT NOT NULL DEFAULT '',
    session_key TEXT NOT NULL DEFAULT '',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    page_path TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_activity_events_source
        CHECK (source IN ('telegram', 'landing')),
    CONSTRAINT chk_user_activity_events_identity
        CHECK (
            NULLIF(BTRIM(user_key), '') IS NOT NULL
            OR NULLIF(BTRIM(session_key), '') IS NOT NULL
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_events_source_event_key
    ON user_activity_events (source, event_key)
    WHERE NULLIF(BTRIM(event_key), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_events_source_occurred_at
    ON user_activity_events (source, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_source_event_name_occurred_at
    ON user_activity_events (source, event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_source_user_key_occurred_at
    ON user_activity_events (source, user_key, occurred_at DESC)
    WHERE NULLIF(BTRIM(user_key), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_events_source_session_key_occurred_at
    ON user_activity_events (source, session_key, occurred_at DESC)
    WHERE NULLIF(BTRIM(session_key), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_events_source_entity_occurred_at
    ON user_activity_events (source, entity_type, entity_id, occurred_at DESC)
    WHERE NULLIF(BTRIM(entity_type), '') IS NOT NULL
      AND NULLIF(BTRIM(entity_id), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_events_metadata_gin
    ON user_activity_events
    USING GIN (metadata jsonb_path_ops);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_user_activity_events_metadata_gin;
DROP INDEX IF EXISTS idx_user_activity_events_source_entity_occurred_at;
DROP INDEX IF EXISTS idx_user_activity_events_source_session_key_occurred_at;
DROP INDEX IF EXISTS idx_user_activity_events_source_user_key_occurred_at;
DROP INDEX IF EXISTS idx_user_activity_events_source_event_name_occurred_at;
DROP INDEX IF EXISTS idx_user_activity_events_source_occurred_at;
DROP INDEX IF EXISTS idx_user_activity_events_source_event_key;
DROP TABLE IF EXISTS user_activity_events;
-- +goose StatementEnd
