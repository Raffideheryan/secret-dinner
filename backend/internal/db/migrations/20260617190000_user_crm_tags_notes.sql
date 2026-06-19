-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS user_admin_tags (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    user_key TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_admin_tags UNIQUE (source, user_key, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_admin_tags_lookup
    ON user_admin_tags (source, user_key, created_at DESC);

CREATE TABLE IF NOT EXISTS user_admin_notes (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    user_key TEXT NOT NULL,
    note_text TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_admin_notes_lookup
    ON user_admin_notes (source, user_key, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_user_admin_notes_lookup;
DROP INDEX IF EXISTS idx_user_admin_tags_lookup;
DROP TABLE IF EXISTS user_admin_notes;
DROP TABLE IF EXISTS user_admin_tags;
-- +goose StatementEnd
