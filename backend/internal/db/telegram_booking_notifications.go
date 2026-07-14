package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

const telegramBookingNotificationClaimTimeout = 5 * time.Minute

type TelegramBookingStatusNotification struct {
	ID             int64
	PackageInfoID  int64
	UserID         int64
	PublicCode     string
	Status         string
	Language       string
	CreatedAt      time.Time
	FailedAttempts int
	LastError      string
}

func shouldNotifyTelegramApplicationStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "approved", "rejected", "waiting_payment", "paid", "cancelled", "no_show":
		return true
	default:
		return false
	}
}

func enqueueTelegramBookingStatusNotificationTx(tx *sql.Tx, packageInfoID, userID int64, publicCode, status, language string) error {
	if tx == nil || packageInfoID <= 0 || userID <= 0 || !shouldNotifyTelegramApplicationStatus(status) {
		return nil
	}
	_, err := tx.Exec(`
		INSERT INTO telegram_booking_status_notifications (
			package_info_id,
			user_id,
			public_code,
			status,
			language
		) VALUES ($1, $2, BTRIM($3), BTRIM($4), BTRIM($5))
		ON CONFLICT (package_info_id, status) DO UPDATE
		SET user_id = EXCLUDED.user_id,
			public_code = EXCLUDED.public_code,
			language = EXCLUDED.language,
			updated_at = now()
	`, packageInfoID, userID, publicCode, status, language)
	return err
}

func (r *adminBookingsRepo) claimNextTelegramBookingStatusNotification(packageInfoID int64) (TelegramBookingStatusNotification, error) {
	if r == nil || r.db == nil {
		return TelegramBookingStatusNotification{}, sql.ErrConnDone
	}
	var item TelegramBookingStatusNotification
	err := r.db.QueryRow(`
		WITH candidate AS (
			SELECT id
			FROM telegram_booking_status_notifications
			WHERE package_info_id = $1
			  AND sent_at IS NULL
			  AND (processing_at IS NULL OR processing_at < now() - $2::interval)
			ORDER BY created_at ASC, id ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE telegram_booking_status_notifications t
		SET processing_at = now(),
			last_attempt_at = now(),
			updated_at = now()
		FROM candidate
		WHERE t.id = candidate.id
		RETURNING t.id, t.package_info_id, t.user_id, COALESCE(t.public_code, ''), COALESCE(t.status, ''), COALESCE(t.language, ''), t.created_at, COALESCE(t.failed_attempts, 0), COALESCE(t.last_error, '')
	`, packageInfoID, formatIntervalLiteral(telegramBookingNotificationClaimTimeout)).Scan(
		&item.ID,
		&item.PackageInfoID,
		&item.UserID,
		&item.PublicCode,
		&item.Status,
		&item.Language,
		&item.CreatedAt,
		&item.FailedAttempts,
		&item.LastError,
	)
	if err != nil {
		return TelegramBookingStatusNotification{}, err
	}
	return item, nil
}

func (r *adminBookingsRepo) markTelegramBookingStatusNotificationSent(id int64) error {
	if id <= 0 {
		return nil
	}
	_, err := r.db.Exec(`
		UPDATE telegram_booking_status_notifications
		SET sent_at = now(),
			processing_at = NULL,
			last_error = NULL,
			updated_at = now()
		WHERE id = $1
	`, id)
	return err
}

func (r *adminBookingsRepo) markTelegramBookingStatusNotificationFailed(id int64, deliveryErr error) error {
	if id <= 0 {
		return nil
	}
	message := ""
	if deliveryErr != nil {
		message = strings.TrimSpace(deliveryErr.Error())
	}
	_, err := r.db.Exec(`
		UPDATE telegram_booking_status_notifications
		SET processing_at = NULL,
			failed_attempts = failed_attempts + 1,
			last_error = NULLIF(BTRIM($2), ''),
			updated_at = now()
		WHERE id = $1
	`, id, message)
	return err
}

func (r *adminBookingsRepo) DispatchTelegramApplicationNotifications(packageInfoID int64, deliver func(TelegramBookingStatusNotification) error) error {
	if r == nil || r.db == nil {
		return nil
	}
	if deliver == nil {
		return errors.New("notification deliverer is required")
	}
	for {
		item, err := r.claimNextTelegramBookingStatusNotification(packageInfoID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil
			}
			return err
		}
		if err := deliver(item); err != nil {
			markErr := r.markTelegramBookingStatusNotificationFailed(item.ID, err)
			if markErr != nil {
				return errors.Join(err, markErr)
			}
			return err
		}
		if err := r.markTelegramBookingStatusNotificationSent(item.ID); err != nil {
			return err
		}
	}
}

func formatIntervalLiteral(d time.Duration) string {
	if d <= 0 {
		return "0 seconds"
	}
	return strings.TrimSpace(fmt.Sprintf("%d seconds", int64(d/time.Second)))
}
