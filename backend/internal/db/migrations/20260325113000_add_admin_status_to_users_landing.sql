-- +goose Up
-- +goose StatementBegin
ALTER TABLE users_landing
    ADD COLUMN IF NOT EXISTS admin_status TEXT NOT NULL DEFAULT 'new';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_landing_admin_status_check'
    ) THEN
        ALTER TABLE users_landing
            ADD CONSTRAINT users_landing_admin_status_check
            CHECK (admin_status IN ('new', 'review', 'contacted', 'approved', 'rejected'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_landing_admin_status ON users_landing (admin_status);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_users_landing_admin_status;
ALTER TABLE users_landing DROP CONSTRAINT IF EXISTS users_landing_admin_status_check;
ALTER TABLE users_landing DROP COLUMN IF EXISTS admin_status;
-- +goose StatementEnd
