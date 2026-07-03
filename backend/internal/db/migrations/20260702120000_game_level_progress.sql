-- +goose Up
-- +goose StatementBegin

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        -- Extra per-user game columns: current level and last played timestamp.
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS game_current_level INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS game_last_played_at TIMESTAMPTZ NULL;

        -- Best result the user has achieved on each level. Drives server-authoritative
        -- star ratings and prevents re-awarding points already earned for a level.
        CREATE TABLE IF NOT EXISTS game_level_progress (
            user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            level       INTEGER     NOT NULL,
            best_stars  INTEGER     NOT NULL DEFAULT 0,
            best_score  INTEGER     NOT NULL DEFAULT 0,
            completed   BOOLEAN     NOT NULL DEFAULT false,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, level)
        );

        CREATE INDEX IF NOT EXISTS idx_game_level_progress_user
            ON game_level_progress (user_id);

        -- Append-only ledger of every Game-Point reward granted, for auditing and to
        -- make reward history queryable.
        CREATE TABLE IF NOT EXISTS game_reward_history (
            id             BIGSERIAL   PRIMARY KEY,
            user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            level          INTEGER     NOT NULL,
            stars          INTEGER     NOT NULL,
            points_awarded INTEGER     NOT NULL,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_game_reward_history_user
            ON game_reward_history (user_id, created_at DESC);
    END IF;
END $$;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    DROP TABLE IF EXISTS game_reward_history;
    DROP TABLE IF EXISTS game_level_progress;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        ALTER TABLE users
            DROP COLUMN IF EXISTS game_last_played_at,
            DROP COLUMN IF EXISTS game_current_level;
    END IF;
END $$;
-- +goose StatementEnd
