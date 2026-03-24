-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS landing_dinners (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    places INTEGER NOT NULL CHECK (places >= 0),
    already_registered INTEGER NOT NULL DEFAULT 0 CHECK (already_registered >= 0),
    location TEXT NOT NULL,
    dinner_date DATE NOT NULL,
    silver_price NUMERIC(12, 2),
    gold_price NUMERIC(12, 2),
    vip_price NUMERIC(12, 2),
    expired BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_dinners_location ON landing_dinners (location);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_landing_dinner_id'
    ) THEN
        ALTER TABLE users_landing
            ADD CONSTRAINT fk_users_landing_dinner_id
            FOREIGN KEY (dinner_id)
            REFERENCES landing_dinners(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
    END IF;
END;
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users_landing DROP CONSTRAINT IF EXISTS fk_users_landing_dinner_id;
DROP INDEX IF EXISTS idx_landing_dinners_location;
DROP TABLE IF EXISTS landing_dinners;
-- +goose StatementEnd
