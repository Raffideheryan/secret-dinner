-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users_landing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    dinner_id BIGINT NULL,
    chosen_package TEXT NULL CHECK (chosen_package IN ('silver', 'gold', 'vip', 'custom')),
    hobbies TEXT NOT NULL,
    allergies TEXT NULL,
    guest_count INTEGER NOT NULL CHECK (guest_count > 0),
    phone VARCHAR(15) NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_landing_email ON users_landing (email);
CREATE INDEX IF NOT EXISTS idx_users_landing_phone ON users_landing (phone);
CREATE INDEX IF NOT EXISTS idx_users_landing_full_name ON users_landing (full_name);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_users_landing_full_name;
DROP INDEX IF EXISTS idx_users_landing_phone;
DROP INDEX IF EXISTS idx_users_landing_email;
DROP TABLE IF EXISTS users_landing;
-- +goose StatementEnd
