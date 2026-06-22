-- +goose Up
-- +goose StatementBegin
ALTER TABLE landing_dinners
    ADD COLUMN IF NOT EXISTS silver_seats INTEGER,
    ADD COLUMN IF NOT EXISTS gold_seats INTEGER,
    ADD COLUMN IF NOT EXISTS vip_seats INTEGER;

ALTER TABLE landing_dinners
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_silver_seats,
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_gold_seats,
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_vip_seats;

ALTER TABLE landing_dinners
    ADD CONSTRAINT chk_landing_dinners_silver_seats CHECK (silver_seats IS NULL OR silver_seats >= 0),
    ADD CONSTRAINT chk_landing_dinners_gold_seats CHECK (gold_seats IS NULL OR gold_seats >= 0),
    ADD CONSTRAINT chk_landing_dinners_vip_seats CHECK (vip_seats IS NULL OR vip_seats >= 0);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE landing_dinners
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_silver_seats,
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_gold_seats,
    DROP CONSTRAINT IF EXISTS chk_landing_dinners_vip_seats,
    DROP COLUMN IF EXISTS silver_seats,
    DROP COLUMN IF EXISTS gold_seats,
    DROP COLUMN IF EXISTS vip_seats;
-- +goose StatementEnd
