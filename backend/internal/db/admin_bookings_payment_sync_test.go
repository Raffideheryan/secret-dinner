package db

import (
	"errors"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestUpdateTelegramApplicationSyncsUserPaymentSummary(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	repo := &adminBookingsRepo{db: db}
	expectedUpdatedAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	createdAt := expectedUpdatedAt.Add(-2 * time.Hour)
	afterUpdatedAt := expectedUpdatedAt.Add(5 * time.Minute)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, updated_at FROM package_info WHERE id = $1 FOR UPDATE`)).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "updated_at"}).AddRow(int64(8901103922), expectedUpdatedAt))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE pi.id = $1
		LIMIT 1
	`)).
		WithArgs(int64(42)).
		WillReturnRows(mockTelegramApplicationRows().
			AddRow(
				int64(42), "SD-PAID-001", int64(8901103922), "raffi", "Raffi", "Deheryan", "+374...", "english",
				int64(7), "Secret Dinner", expectedUpdatedAt, "vip", 25000.0, "waiting_payment", "", "private",
				true, "2026-06-05", "REF001", "USED001", 35, 20, createdAt, expectedUpdatedAt,
			))
	mock.ExpectExec(regexp.QuoteMeta(`SELECT pg_advisory_xact_lock($1)`)).
		WithArgs(dinnerSeatLockKey(int64(7))).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE package_info
		SET status = $2,
			admin_note = BTRIM($3),
			updated_at = now()
		WHERE id = $1
	`)).
		WithArgs(int64(42), "paid", "paid manually").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE users u
		SET total_payments = COALESCE((
			SELECT SUM(price)::numeric(12, 2)
			FROM package_info
			WHERE user_id = $1
			  AND status IN ('paid', 'no_show')
		), 0),
			updated_at = now()
		WHERE id = $1
	`)).
		WithArgs(int64(8901103922)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`
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
	`)).
		WithArgs(int64(42), int64(8901103922), "SD-PAID-001", "paid", "english").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE pi.id = $1
		LIMIT 1
	`)).
		WithArgs(int64(42)).
		WillReturnRows(mockTelegramApplicationRows().
			AddRow(
				int64(42), "SD-PAID-001", int64(8901103922), "raffi", "Raffi", "Deheryan", "+374...", "english",
				int64(7), "Secret Dinner", expectedUpdatedAt, "vip", 25000.0, "paid", "paid manually", "private",
				true, "2026-06-05", "REF001", "USED001", 35, 20, createdAt, afterUpdatedAt,
			))
	mock.ExpectCommit()

	before, after, err := repo.UpdateTelegramApplication(42, "paid", "paid manually", expectedUpdatedAt)
	if err != nil {
		t.Fatalf("UpdateTelegramApplication: %v", err)
	}
	if before.Status != "waiting_payment" {
		t.Fatalf("before.Status = %q, want waiting_payment", before.Status)
	}
	if after.Status != "paid" {
		t.Fatalf("after.Status = %q, want paid", after.Status)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestUpdateTelegramApplicationSameStatusAndNoteIsIdempotent(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	repo := &adminBookingsRepo{db: db}
	expectedUpdatedAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	createdAt := expectedUpdatedAt.Add(-2 * time.Hour)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, updated_at FROM package_info WHERE id = $1 FOR UPDATE`)).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "updated_at"}).AddRow(int64(8901103922), expectedUpdatedAt))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE pi.id = $1
		LIMIT 1
	`)).
		WithArgs(int64(42)).
		WillReturnRows(mockTelegramApplicationRows().
			AddRow(
				int64(42), "SD-PAID-001", int64(8901103922), "raffi", "Raffi", "Deheryan", "+374...", "english",
				int64(7), "Secret Dinner", expectedUpdatedAt, "vip", 25000.0, "paid", "paid manually", "private",
				true, "2026-06-05", "REF001", "USED001", 35, 20, createdAt, expectedUpdatedAt,
			))
	mock.ExpectCommit()

	before, after, err := repo.UpdateTelegramApplication(42, "paid", "paid manually", expectedUpdatedAt)
	if err != nil {
		t.Fatalf("UpdateTelegramApplication: %v", err)
	}
	if before.Status != after.Status || before.AdminNote != after.AdminNote {
		t.Fatalf("expected no-op result, got before=%+v after=%+v", before, after)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestUpdateTelegramApplicationRollsBackWhenPaymentSyncFails(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer db.Close()

	repo := &adminBookingsRepo{db: db}
	expectedUpdatedAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	createdAt := expectedUpdatedAt.Add(-2 * time.Hour)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, updated_at FROM package_info WHERE id = $1 FOR UPDATE`)).
		WithArgs(int64(42)).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "updated_at"}).AddRow(int64(8901103922), expectedUpdatedAt))
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE pi.id = $1
		LIMIT 1
	`)).
		WithArgs(int64(42)).
		WillReturnRows(mockTelegramApplicationRows().
			AddRow(
				int64(42), "SD-PAID-001", int64(8901103922), "raffi", "Raffi", "Deheryan", "+374...", "english",
				int64(7), "Secret Dinner", expectedUpdatedAt, "vip", 25000.0, "waiting_payment", "", "private",
				true, "2026-06-05", "REF001", "USED001", 35, 20, createdAt, expectedUpdatedAt,
			))
	mock.ExpectExec(regexp.QuoteMeta(`SELECT pg_advisory_xact_lock($1)`)).
		WithArgs(dinnerSeatLockKey(int64(7))).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE package_info
		SET status = $2,
			admin_note = BTRIM($3),
			updated_at = now()
		WHERE id = $1
	`)).
		WithArgs(int64(42), "paid", "paid manually").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE users u
		SET total_payments = COALESCE((
			SELECT SUM(price)::numeric(12, 2)
			FROM package_info
			WHERE user_id = $1
			  AND status IN ('paid', 'no_show')
		), 0),
			updated_at = now()
		WHERE id = $1
	`)).
		WithArgs(int64(8901103922)).
		WillReturnError(errors.New("sync failed"))
	mock.ExpectRollback()

	if _, _, err := repo.UpdateTelegramApplication(42, "paid", "paid manually", expectedUpdatedAt); err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func mockTelegramApplicationRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id",
		"public_code",
		"user_id",
		"username",
		"name",
		"surname",
		"phone",
		"language",
		"dinner_id",
		"description",
		"dinner_date",
		"menu",
		"price",
		"status",
		"admin_note",
		"table_preference",
		"terms_accepted",
		"legal_version",
		"referral_code",
		"referal_code",
		"points",
		"discount",
		"created_at",
		"updated_at",
	})
}
