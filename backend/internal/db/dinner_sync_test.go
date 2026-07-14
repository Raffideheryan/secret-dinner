package db

import (
	"database/sql"
	"errors"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestCreateDinnerQueuesRetryWhenTelegramMirrorWriteFails(t *testing.T) {
	t.Parallel()

	repo, landingDB, landingMock, telegramDB, telegramMock := newDinnerRepoMocks(t)
	defer landingDB.Close()
	defer telegramDB.Close()

	now := time.Date(2026, 7, 10, 13, 0, 0, 0, time.UTC)

	landingMock.ExpectBegin()
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		INSERT INTO landing_dinners (
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired
		)
		VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, COALESCE(sync_version, 1), updated_at
	`)).
		WithArgs("Secret Dinner", 12, "Yerevan", now, nil, nil, nil, nil, nil, nil, false).
		WillReturnRows(sqlmock.NewRows([]string{"id", "sync_version", "updated_at"}).AddRow(int64(55), int64(1), now))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinner_sync_outbox (
			dinner_id,
			operation,
			source_version,
			source_updated_at,
			status,
			attempt_count,
			last_error,
			next_retry_at,
			processing_started_at,
			completed_at
		) VALUES ($1, $2, $3, $4, $5, 0, NULL, now(), NULL, NULL)
		ON CONFLICT (dinner_id) DO UPDATE
		SET operation = EXCLUDED.operation,
			source_version = EXCLUDED.source_version,
			source_updated_at = EXCLUDED.source_updated_at,
			status = 'pending',
			attempt_count = 0,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = NULL,
			updated_at = now()
	`)).
		WithArgs(int64(55), dinnerSyncOperationUpsert, int64(1), now, dinnerSyncStatusPending).
		WillReturnResult(sqlmock.NewResult(1, 1))
	landingMock.ExpectCommit()

	expectClaimedSyncJob(landingMock, int64(9001), int64(55), dinnerSyncOperationUpsert, int64(1), now, 1)
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			created_at,
			updated_at,
			COALESCE(sync_version, 1)
		FROM landing_dinners
		WHERE id = $1
	`)).
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "description", "places", "already_registered", "location", "dinner_date",
			"silver_seats", "gold_seats", "vip_seats", "silver_price", "gold_price", "vip_price",
			"expired", "created_at", "updated_at", "sync_version",
		}).AddRow(int64(55), "Secret Dinner", 12, 0, "Yerevan", now, nil, nil, nil, nil, nil, nil, false, now, now, int64(1)))
	telegramMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinners (
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			sync_version
		) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (id) DO UPDATE
		SET description = EXCLUDED.description,
			places = EXCLUDED.places,
			location = EXCLUDED.location,
			dinner_date = EXCLUDED.dinner_date,
			silver_seats = EXCLUDED.silver_seats,
			gold_seats = EXCLUDED.gold_seats,
			vip_seats = EXCLUDED.vip_seats,
			silver_price = EXCLUDED.silver_price,
			gold_price = EXCLUDED.gold_price,
			vip_price = EXCLUDED.vip_price,
			expired = EXCLUDED.expired,
			sync_version = EXCLUDED.sync_version,
			updated_at = now()
		WHERE COALESCE(dinners.sync_version, 0) <= EXCLUDED.sync_version
	`)).
		WithArgs(int64(55), "Secret Dinner", 12, "Yerevan", now, nil, nil, nil, nil, nil, nil, false, int64(1)).
		WillReturnError(errors.New("telegram unavailable"))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULLIF(BTRIM($4), ''),
			next_retry_at = $5,
			processing_started_at = NULL,
			completed_at = NULL,
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`)).
		WithArgs(int64(9001), int64(1), dinnerSyncStatusFailed, "telegram unavailable", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	expectDinnerFetch(landingMock, telegramMock, int64(55), now, 0)

	dinner, err := repo.CreateDinner(DinnerMutation{
		Description: "Secret Dinner",
		Places:      12,
		Location:    "Yerevan",
		DinnerDate:  now,
	})
	if err != nil {
		t.Fatalf("CreateDinner: %v", err)
	}
	if dinner.ID != 55 {
		t.Fatalf("dinner.ID = %d, want 55", dinner.ID)
	}

	assertMocksMet(t, landingMock, telegramMock)
}

func TestUpdateDinnerUpsertsMirrorWhenTelegramRowIsMissing(t *testing.T) {
	t.Parallel()

	repo, landingDB, landingMock, telegramDB, telegramMock := newDinnerRepoMocks(t)
	defer landingDB.Close()
	defer telegramDB.Close()

	now := time.Date(2026, 7, 10, 14, 0, 0, 0, time.UTC)

	landingMock.ExpectBegin()
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		UPDATE landing_dinners
		SET description = $2,
			places = $3,
			location = $4,
			dinner_date = $5,
			silver_seats = $6,
			gold_seats = $7,
			vip_seats = $8,
			silver_price = $9,
			gold_price = $10,
			vip_price = $11,
			expired = $12,
			sync_version = COALESCE(sync_version, 1) + 1,
			updated_at = now()
		WHERE id = $1
		RETURNING COALESCE(sync_version, 1), updated_at
	`)).
		WithArgs(int64(55), "Updated Dinner", 20, "Dilijan", now, nil, nil, nil, nil, nil, nil, false).
		WillReturnRows(sqlmock.NewRows([]string{"sync_version", "updated_at"}).AddRow(int64(2), now))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinner_sync_outbox (
			dinner_id,
			operation,
			source_version,
			source_updated_at,
			status,
			attempt_count,
			last_error,
			next_retry_at,
			processing_started_at,
			completed_at
		) VALUES ($1, $2, $3, $4, $5, 0, NULL, now(), NULL, NULL)
		ON CONFLICT (dinner_id) DO UPDATE
		SET operation = EXCLUDED.operation,
			source_version = EXCLUDED.source_version,
			source_updated_at = EXCLUDED.source_updated_at,
			status = 'pending',
			attempt_count = 0,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = NULL,
			updated_at = now()
	`)).
		WithArgs(int64(55), dinnerSyncOperationUpsert, int64(2), now, dinnerSyncStatusPending).
		WillReturnResult(sqlmock.NewResult(1, 1))
	landingMock.ExpectCommit()

	expectClaimedSyncJob(landingMock, int64(9002), int64(55), dinnerSyncOperationUpsert, int64(2), now, 1)
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			created_at,
			updated_at,
			COALESCE(sync_version, 1)
		FROM landing_dinners
		WHERE id = $1
	`)).
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "description", "places", "already_registered", "location", "dinner_date",
			"silver_seats", "gold_seats", "vip_seats", "silver_price", "gold_price", "vip_price",
			"expired", "created_at", "updated_at", "sync_version",
		}).AddRow(int64(55), "Updated Dinner", 20, 0, "Dilijan", now, nil, nil, nil, nil, nil, nil, false, now.Add(-time.Hour), now, int64(2)))
	telegramMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinners (
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			sync_version
		) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (id) DO UPDATE
		SET description = EXCLUDED.description,
			places = EXCLUDED.places,
			location = EXCLUDED.location,
			dinner_date = EXCLUDED.dinner_date,
			silver_seats = EXCLUDED.silver_seats,
			gold_seats = EXCLUDED.gold_seats,
			vip_seats = EXCLUDED.vip_seats,
			silver_price = EXCLUDED.silver_price,
			gold_price = EXCLUDED.gold_price,
			vip_price = EXCLUDED.vip_price,
			expired = EXCLUDED.expired,
			sync_version = EXCLUDED.sync_version,
			updated_at = now()
		WHERE COALESCE(dinners.sync_version, 0) <= EXCLUDED.sync_version
	`)).
		WithArgs(int64(55), "Updated Dinner", 20, "Dilijan", now, nil, nil, nil, nil, nil, nil, false, int64(2)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = now(),
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`)).
		WithArgs(int64(9002), int64(2), dinnerSyncStatusCompleted).
		WillReturnResult(sqlmock.NewResult(0, 1))
	expectOccupancySync(landingMock, telegramMock, int64(55), 0, true)

	err := repo.UpdateDinner(55, DinnerMutation{
		Description: "Updated Dinner",
		Places:      20,
		Location:    "Dilijan",
		DinnerDate:  now,
	})
	if err != nil {
		t.Fatalf("UpdateDinner: %v", err)
	}

	assertMocksMet(t, landingMock, telegramMock)
}

func TestDeleteDinnerTreatsMissingTelegramMirrorAsNoOp(t *testing.T) {
	t.Parallel()

	repo, landingDB, landingMock, telegramDB, telegramMock := newDinnerRepoMocks(t)
	defer landingDB.Close()
	defer telegramDB.Close()

	now := time.Date(2026, 7, 10, 15, 0, 0, 0, time.UTC)

	telegramMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			EXISTS (SELECT 1 FROM package_info WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM registered_users WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM custom_package WHERE dinner_id = $1)
	`)).
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	landingMock.ExpectBegin()
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		DELETE FROM landing_dinners
		WHERE id = $1
		RETURNING COALESCE(sync_version, 1) + 1, now()
	`)).
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{"sync_version", "updated_at"}).AddRow(int64(4), now))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinner_sync_outbox (
			dinner_id,
			operation,
			source_version,
			source_updated_at,
			status,
			attempt_count,
			last_error,
			next_retry_at,
			processing_started_at,
			completed_at
		) VALUES ($1, $2, $3, $4, $5, 0, NULL, now(), NULL, NULL)
		ON CONFLICT (dinner_id) DO UPDATE
		SET operation = EXCLUDED.operation,
			source_version = EXCLUDED.source_version,
			source_updated_at = EXCLUDED.source_updated_at,
			status = 'pending',
			attempt_count = 0,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = NULL,
			updated_at = now()
	`)).
		WithArgs(int64(55), dinnerSyncOperationDelete, int64(4), now, dinnerSyncStatusPending).
		WillReturnResult(sqlmock.NewResult(1, 1))
	landingMock.ExpectCommit()

	expectClaimedSyncJob(landingMock, int64(9003), int64(55), dinnerSyncOperationDelete, int64(4), now, 1)
	telegramMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			EXISTS (SELECT 1 FROM package_info WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM registered_users WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM custom_package WHERE dinner_id = $1)
	`)).
		WithArgs(int64(55)).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	telegramMock.ExpectExec(regexp.QuoteMeta(`
		DELETE FROM dinners
		WHERE id = $1
		  AND COALESCE(sync_version, 0) <= $2
	`)).
		WithArgs(int64(55), int64(4)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = now(),
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`)).
		WithArgs(int64(9003), int64(4), dinnerSyncStatusCompleted).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.DeleteDinner(55); err != nil {
		t.Fatalf("DeleteDinner: %v", err)
	}

	assertMocksMet(t, landingMock, telegramMock)
}

func TestProcessClaimedDinnerSyncJobDoesNotFailCompletedCatalogSyncOnOccupancyError(t *testing.T) {
	t.Parallel()

	repo, landingDB, landingMock, telegramDB, telegramMock := newDinnerRepoMocks(t)
	defer landingDB.Close()
	defer telegramDB.Close()

	now := time.Date(2026, 7, 10, 16, 0, 0, 0, time.UTC)
	job := dinnerSyncJob{
		ID:              9010,
		DinnerID:        77,
		Operation:       dinnerSyncOperationUpsert,
		SourceVersion:   3,
		SourceUpdatedAt: now,
		AttemptCount:    2,
	}

	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			created_at,
			updated_at,
			COALESCE(sync_version, 1)
		FROM landing_dinners
		WHERE id = $1
	`)).
		WithArgs(int64(77)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "description", "places", "already_registered", "location", "dinner_date",
			"silver_seats", "gold_seats", "vip_seats", "silver_price", "gold_price", "vip_price",
			"expired", "created_at", "updated_at", "sync_version",
		}).AddRow(int64(77), "Occupancy Test", 8, 0, "Gyumri", now, nil, nil, nil, nil, nil, nil, false, now.Add(-time.Hour), now, int64(3)))
	telegramMock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO dinners (
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			sync_version
		) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		ON CONFLICT (id) DO UPDATE
		SET description = EXCLUDED.description,
			places = EXCLUDED.places,
			location = EXCLUDED.location,
			dinner_date = EXCLUDED.dinner_date,
			silver_seats = EXCLUDED.silver_seats,
			gold_seats = EXCLUDED.gold_seats,
			vip_seats = EXCLUDED.vip_seats,
			silver_price = EXCLUDED.silver_price,
			gold_price = EXCLUDED.gold_price,
			vip_price = EXCLUDED.vip_price,
			expired = EXCLUDED.expired,
			sync_version = EXCLUDED.sync_version,
			updated_at = now()
		WHERE COALESCE(dinners.sync_version, 0) <= EXCLUDED.sync_version
	`)).
		WithArgs(int64(77), "Occupancy Test", 8, "Gyumri", now, nil, nil, nil, nil, nil, nil, false, int64(3)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	landingMock.ExpectExec(regexp.QuoteMeta(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = now(),
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`)).
		WithArgs(int64(9010), int64(3), dinnerSyncStatusCompleted).
		WillReturnResult(sqlmock.NewResult(0, 1))
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT dinner_id, COALESCE(SUM(guest_count), 0) AS seats
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
		GROUP BY dinner_id
	`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnError(errors.New("landing occupancy query failed"))

	if err := repo.processClaimedDinnerSyncJob(job); err != nil {
		t.Fatalf("processClaimedDinnerSyncJob: %v", err)
	}

	assertMocksMet(t, landingMock, telegramMock)
}

func newDinnerRepoMocks(t *testing.T) (*dinnersRepo, *sql.DB, sqlmock.Sqlmock, *sql.DB, sqlmock.Sqlmock) {
	t.Helper()

	landingDB, landingMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("landing sqlmock.New: %v", err)
	}
	telegramDB, telegramMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("telegram sqlmock.New: %v", err)
	}
	return &dinnersRepo{landingDB: landingDB, telegramDB: telegramDB}, landingDB, landingMock, telegramDB, telegramMock
}

func expectClaimedSyncJob(mock sqlmock.Sqlmock, jobID, dinnerID int64, operation string, sourceVersion int64, sourceUpdatedAt time.Time, attemptCount int) {
	mock.ExpectBegin()
	mock.ExpectQuery(`WITH candidate AS`).
		WithArgs("300 seconds", dinnerID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "dinner_id", "operation", "source_version", "source_updated_at",
			"status", "attempt_count", "last_error", "next_retry_at", "processing_started_at",
		}).AddRow(jobID, dinnerID, operation, sourceVersion, sourceUpdatedAt, dinnerSyncStatusProcessing, attemptCount, "", sourceUpdatedAt, sourceUpdatedAt))
	mock.ExpectCommit()
}

func expectDinnerFetch(landingMock, telegramMock sqlmock.Sqlmock, dinnerID int64, dinnerDate time.Time, alreadyRegistered int) {
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price,
			expired,
			created_at,
			updated_at
		FROM landing_dinners
		WHERE id = $1
	`)).
		WithArgs(dinnerID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "description", "places", "already_registered", "location", "dinner_date",
			"silver_seats", "gold_seats", "vip_seats", "silver_price", "gold_price", "vip_price",
			"expired", "created_at", "updated_at",
		}).AddRow(dinnerID, "Secret Dinner", 12, alreadyRegistered, "Yerevan", dinnerDate, nil, nil, nil, nil, nil, nil, false, dinnerDate, dinnerDate))

	expectOccupancySync(landingMock, telegramMock, dinnerID, int64(alreadyRegistered), false)
	expectRegistrationReads(landingMock, telegramMock)
}

func expectOccupancySync(landingMock, telegramMock sqlmock.Sqlmock, dinnerID int64, total int64, updateWrites bool) {
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT dinner_id, COALESCE(SUM(guest_count), 0) AS seats
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
		GROUP BY dinner_id
	`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"dinner_id", "seats"}))
	telegramMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT ru.dinner_id, COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = ANY($1)
	`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"dinner_id", "status", "menu"}))
	if updateWrites {
		landingMock.ExpectExec(regexp.QuoteMeta(`UPDATE landing_dinners SET already_registered = $2, updated_at = now() WHERE id = $1`)).
			WithArgs(dinnerID, total).
			WillReturnResult(sqlmock.NewResult(0, 1))
		telegramMock.ExpectExec(regexp.QuoteMeta(`UPDATE dinners SET already_registered = $2, updated_at = now() WHERE id = $1`)).
			WithArgs(dinnerID, total).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}
}

func expectRegistrationReads(landingMock, telegramMock sqlmock.Sqlmock) {
	landingMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT dinner_id, COUNT(*) AS bookings
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
		GROUP BY dinner_id
	`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"dinner_id", "bookings"}))
	telegramMock.ExpectQuery(regexp.QuoteMeta(`
		SELECT ru.dinner_id, COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = ANY($1)
	`)).
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"dinner_id", "status", "menu"}))
}

func assertMocksMet(t *testing.T, mocks ...sqlmock.Sqlmock) {
	t.Helper()
	for _, mock := range mocks {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("ExpectationsWereMet: %v", err)
		}
	}
}
