-- +goose Up
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS game_points         INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS game_high_score     INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS game_convert_today  INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS game_convert_date   DATE NULL;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        ALTER TABLE users
            DROP COLUMN IF EXISTS game_convert_date,
            DROP COLUMN IF EXISTS game_convert_today,
            DROP COLUMN IF EXISTS game_high_score,
            DROP COLUMN IF EXISTS game_points;
    END IF;
END $$;
-- +goose StatementEnd
