-- +goose Up
-- +goose StatementBegin
ALTER TABLE landing_dinners
    ADD COLUMN IF NOT EXISTS sync_version BIGINT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS dinner_sync_outbox (
    id BIGSERIAL PRIMARY KEY,
    dinner_id BIGINT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    source_version BIGINT NOT NULL,
    source_updated_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processing_started_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT dinner_sync_outbox_dinner_unique UNIQUE (dinner_id)
);

CREATE INDEX IF NOT EXISTS idx_dinner_sync_outbox_claim
    ON dinner_sync_outbox (status, next_retry_at, processing_started_at, updated_at, id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_dinner_sync_outbox_claim;
DROP TABLE IF EXISTS dinner_sync_outbox;
ALTER TABLE landing_dinners DROP COLUMN IF EXISTS sync_version;
-- +goose StatementEnd
