-- +goose Up
-- +goose StatementBegin
ALTER TABLE users_landing
    DROP CONSTRAINT IF EXISTS users_landing_chosen_package_check;

ALTER TABLE users_landing
    ADD CONSTRAINT users_landing_chosen_package_check
    CHECK (
        chosen_package IS NULL
        OR chosen_package IN ('silver', 'gold', 'vip', 'custom')
        OR chosen_package ~ '^guest_[0-9]+:(silver|gold|vip|custom)(,guest_[0-9]+:(silver|gold|vip|custom))*$'
    );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users_landing
    DROP CONSTRAINT IF EXISTS users_landing_chosen_package_check;

ALTER TABLE users_landing
    ADD CONSTRAINT users_landing_chosen_package_check
    CHECK (chosen_package IN ('silver', 'gold', 'vip', 'custom'));
-- +goose StatementEnd
