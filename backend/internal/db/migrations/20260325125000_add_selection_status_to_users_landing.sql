-- +goose Up
-- +goose StatementBegin
ALTER TABLE users_landing
    ADD COLUMN IF NOT EXISTS selection_status TEXT;

UPDATE users_landing
SET selection_status = CASE
    WHEN dinner_id IS NOT NULL AND chosen_package IS NOT NULL THEN 'completed'
    ELSE 'open'
END
WHERE selection_status IS NULL;

ALTER TABLE users_landing
    ALTER COLUMN selection_status SET DEFAULT 'open';

ALTER TABLE users_landing
    ALTER COLUMN selection_status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_landing_selection_status_check'
    ) THEN
        ALTER TABLE users_landing
            ADD CONSTRAINT users_landing_selection_status_check
            CHECK (selection_status IN ('open', 'completed'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_landing_selection_status ON users_landing (selection_status);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_users_landing_selection_status;
ALTER TABLE users_landing DROP CONSTRAINT IF EXISTS users_landing_selection_status_check;
ALTER TABLE users_landing DROP COLUMN IF EXISTS selection_status;
-- +goose StatementEnd
