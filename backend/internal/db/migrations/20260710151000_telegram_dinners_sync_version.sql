-- +goose Up
-- +goose StatementBegin
ALTER TABLE IF EXISTS dinners
    ADD COLUMN IF NOT EXISTS sync_version BIGINT NOT NULL DEFAULT 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE IF EXISTS dinners
    DROP COLUMN IF EXISTS sync_version;
-- +goose StatementEnd
