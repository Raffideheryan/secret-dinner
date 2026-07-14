-- +goose Up
CREATE TABLE IF NOT EXISTS telegram_booking_status_notifications (
    id BIGSERIAL PRIMARY KEY,
    package_info_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    public_code TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ NULL,
    processing_at TIMESTAMPTZ NULL,
    last_attempt_at TIMESTAMPTZ NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    CONSTRAINT telegram_booking_status_notifications_package_status_unique UNIQUE (package_info_id, status)
);

CREATE INDEX IF NOT EXISTS telegram_booking_status_notifications_pending_idx
    ON telegram_booking_status_notifications (package_info_id, sent_at, processing_at, created_at);

-- +goose Down
DROP TABLE IF EXISTS telegram_booking_status_notifications;
