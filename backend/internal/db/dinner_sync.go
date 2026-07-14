package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	dinnerSyncOperationUpsert = "upsert"
	dinnerSyncOperationDelete = "delete"

	dinnerSyncStatusPending    = "pending"
	dinnerSyncStatusProcessing = "processing"
	dinnerSyncStatusFailed     = "failed"
	dinnerSyncStatusCompleted  = "completed"
)

const dinnerSyncClaimTimeout = 5 * time.Minute

var ErrDinnerDeleteBlockedByTelegramDependencies = errors.New("cannot delete dinner while telegram bookings or dinner-linked records still exist")
var ErrDinnerSyncAuthoritativeRowMissing = errors.New("authoritative landing dinner row is missing for sync job")

type dinnerSyncJob struct {
	ID                int64
	DinnerID          int64
	Operation         string
	SourceVersion     int64
	SourceUpdatedAt   time.Time
	Status            string
	AttemptCount      int
	LastError         string
	NextRetryAt       time.Time
	ProcessingStarted sql.NullTime
}

type dinnerMirrorRow struct {
	ID                int64
	Description       string
	Places            int
	AlreadyRegistered int
	Location          string
	DinnerDate        time.Time
	SilverSeats       *int
	GoldSeats         *int
	VIPSeats          *int
	SilverPrice       *float64
	GoldPrice         *float64
	VIPPrice          *float64
	Expired           bool
	CreatedAt         time.Time
	UpdatedAt         time.Time
	SyncVersion       int64
}

func (d *dinnersRepo) enqueueDinnerSyncJobTx(tx *sql.Tx, dinnerID int64, operation string, sourceVersion int64, sourceUpdatedAt time.Time) error {
	if tx == nil {
		return errors.New("transaction is required")
	}
	_, err := tx.Exec(`
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
	`, dinnerID, operation, sourceVersion, sourceUpdatedAt.UTC(), dinnerSyncStatusPending)
	return err
}

func (d *dinnersRepo) claimDinnerSyncJob(filterDinnerID *int64) (dinnerSyncJob, error) {
	if d.landingDB == nil {
		return dinnerSyncJob{}, sql.ErrConnDone
	}
	tx, err := d.landingDB.Begin()
	if err != nil {
		return dinnerSyncJob{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	conditions := []string{
		fmt.Sprintf(`(
			(status IN ('%s', '%s') AND next_retry_at <= now())
			OR
			(status = '%s' AND processing_started_at IS NOT NULL AND processing_started_at < now() - $1::interval)
		)`, dinnerSyncStatusPending, dinnerSyncStatusFailed, dinnerSyncStatusProcessing),
	}
	args := []any{fmt.Sprintf("%d seconds", int64(dinnerSyncClaimTimeout/time.Second))}
	if filterDinnerID != nil && *filterDinnerID > 0 {
		args = append(args, *filterDinnerID)
		conditions = append(conditions, fmt.Sprintf("dinner_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
		WITH candidate AS (
			SELECT id
			FROM dinner_sync_outbox
			WHERE %s
			ORDER BY next_retry_at ASC, updated_at ASC, id ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE dinner_sync_outbox o
		SET status = '%s',
			attempt_count = o.attempt_count + 1,
			last_error = NULL,
			processing_started_at = now(),
			updated_at = now()
		FROM candidate
		WHERE o.id = candidate.id
		RETURNING o.id, o.dinner_id, o.operation, o.source_version, o.source_updated_at, o.status,
			o.attempt_count, COALESCE(o.last_error, ''), o.next_retry_at, o.processing_started_at
	`, strings.Join(conditions, " AND "), dinnerSyncStatusProcessing)

	var job dinnerSyncJob
	err = tx.QueryRow(query, args...).Scan(
		&job.ID,
		&job.DinnerID,
		&job.Operation,
		&job.SourceVersion,
		&job.SourceUpdatedAt,
		&job.Status,
		&job.AttemptCount,
		&job.LastError,
		&job.NextRetryAt,
		&job.ProcessingStarted,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return dinnerSyncJob{}, sql.ErrNoRows
		}
		return dinnerSyncJob{}, err
	}
	if err := tx.Commit(); err != nil {
		return dinnerSyncJob{}, err
	}
	return job, nil
}

func (d *dinnersRepo) markDinnerSyncJobCompleted(job dinnerSyncJob) error {
	if d.landingDB == nil || job.ID <= 0 {
		return nil
	}
	_, err := d.landingDB.Exec(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULL,
			next_retry_at = now(),
			processing_started_at = NULL,
			completed_at = now(),
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`, job.ID, job.SourceVersion, dinnerSyncStatusCompleted)
	return err
}

func (d *dinnersRepo) markDinnerSyncJobFailed(job dinnerSyncJob, syncErr error) error {
	if d.landingDB == nil || job.ID <= 0 {
		return nil
	}
	message := ""
	if syncErr != nil {
		message = strings.TrimSpace(syncErr.Error())
	}
	_, err := d.landingDB.Exec(`
		UPDATE dinner_sync_outbox
		SET status = $3,
			last_error = NULLIF(BTRIM($4), ''),
			next_retry_at = $5,
			processing_started_at = NULL,
			completed_at = NULL,
			updated_at = now()
		WHERE id = $1
		  AND source_version = $2
	`, job.ID, job.SourceVersion, dinnerSyncStatusFailed, message, time.Now().UTC().Add(dinnerSyncRetryDelay(job.AttemptCount)))
	return err
}

func dinnerSyncRetryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > 6 {
		attempt = 6
	}
	return time.Duration(1<<uint(attempt-1)) * time.Minute
}

func (d *dinnersRepo) ProcessPendingDinnerSyncJobs(limit int) (int, error) {
	if limit <= 0 {
		limit = 1
	}
	processed := 0
	for processed < limit {
		job, err := d.claimDinnerSyncJob(nil)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return processed, nil
			}
			return processed, err
		}
		if err := d.processClaimedDinnerSyncJob(job); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func (d *dinnersRepo) processDinnerSyncJobNow(dinnerID int64) {
	if dinnerID <= 0 {
		return
	}
	job, err := d.claimDinnerSyncJob(&dinnerID)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			log.WithError(err).WithField("dinner_id", dinnerID).Warn("Failed to claim immediate dinner sync job")
		}
		return
	}
	if err := d.processClaimedDinnerSyncJob(job); err != nil {
		log.WithError(err).WithFields(map[string]any{
			"dinner_id":      job.DinnerID,
			"sync_job_id":    job.ID,
			"source_version": job.SourceVersion,
			"attempt":        job.AttemptCount,
			"operation":      job.Operation,
		}).Warn("Immediate dinner sync job failed; leaving job pending for retry")
	}
}

func (d *dinnersRepo) processClaimedDinnerSyncJob(job dinnerSyncJob) error {
	if err := d.applyDinnerSyncJob(job); err != nil {
		if markErr := d.markDinnerSyncJobFailed(job, err); markErr != nil {
			return errors.Join(err, markErr)
		}
		return err
	}
	if err := d.markDinnerSyncJobCompleted(job); err != nil {
		return err
	}
	if job.Operation == dinnerSyncOperationUpsert {
		if err := d.SyncDinnerRegistrations(job.DinnerID); err != nil {
			log.WithError(err).WithFields(map[string]any{
				"dinner_id":      job.DinnerID,
				"sync_job_id":    job.ID,
				"source_version": job.SourceVersion,
				"operation":      job.Operation,
			}).Warn("Dinner catalog sync completed but occupancy reconciliation failed")
		}
	}
	return nil
}

func (d *dinnersRepo) applyDinnerSyncJob(job dinnerSyncJob) error {
	switch job.Operation {
	case dinnerSyncOperationUpsert:
		row, err := d.loadLandingDinnerMirrorRow(job.DinnerID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrDinnerSyncAuthoritativeRowMissing
			}
			return err
		}
		return d.upsertTelegramDinnerMirror(row)
	case dinnerSyncOperationDelete:
		return d.deleteTelegramDinnerMirror(job.DinnerID, job.SourceVersion)
	default:
		return fmt.Errorf("unknown dinner sync operation: %s", job.Operation)
	}
}

func (d *dinnersRepo) loadLandingDinnerMirrorRow(dinnerID int64) (dinnerMirrorRow, error) {
	var row dinnerMirrorRow
	var silverSeats, goldSeats, vipSeats sql.NullInt64
	var silverPrice, goldPrice, vipPrice sql.NullFloat64
	err := d.landingDB.QueryRow(`
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
	`, dinnerID).Scan(
		&row.ID,
		&row.Description,
		&row.Places,
		&row.AlreadyRegistered,
		&row.Location,
		&row.DinnerDate,
		&silverSeats,
		&goldSeats,
		&vipSeats,
		&silverPrice,
		&goldPrice,
		&vipPrice,
		&row.Expired,
		&row.CreatedAt,
		&row.UpdatedAt,
		&row.SyncVersion,
	)
	if err != nil {
		return dinnerMirrorRow{}, err
	}
	row.SilverSeats = nullableIntPointer(silverSeats)
	row.GoldSeats = nullableIntPointer(goldSeats)
	row.VIPSeats = nullableIntPointer(vipSeats)
	row.SilverPrice = nullableFloatPointer(silverPrice)
	row.GoldPrice = nullableFloatPointer(goldPrice)
	row.VIPPrice = nullableFloatPointer(vipPrice)
	return row, nil
}

func (d *dinnersRepo) loadAllLandingDinnerMirrorRows() (map[int64]dinnerMirrorRow, error) {
	rows, err := d.landingDB.Query(`
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
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[int64]dinnerMirrorRow)
	for rows.Next() {
		var row dinnerMirrorRow
		var silverSeats, goldSeats, vipSeats sql.NullInt64
		var silverPrice, goldPrice, vipPrice sql.NullFloat64
		if err := rows.Scan(
			&row.ID,
			&row.Description,
			&row.Places,
			&row.AlreadyRegistered,
			&row.Location,
			&row.DinnerDate,
			&silverSeats,
			&goldSeats,
			&vipSeats,
			&silverPrice,
			&goldPrice,
			&vipPrice,
			&row.Expired,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.SyncVersion,
		); err != nil {
			return nil, err
		}
		row.SilverSeats = nullableIntPointer(silverSeats)
		row.GoldSeats = nullableIntPointer(goldSeats)
		row.VIPSeats = nullableIntPointer(vipSeats)
		row.SilverPrice = nullableFloatPointer(silverPrice)
		row.GoldPrice = nullableFloatPointer(goldPrice)
		row.VIPPrice = nullableFloatPointer(vipPrice)
		result[row.ID] = row
	}
	return result, rows.Err()
}

func (d *dinnersRepo) loadAllTelegramDinnerMirrorRows() (map[int64]dinnerMirrorRow, error) {
	result := make(map[int64]dinnerMirrorRow)
	if d.telegramDB == nil {
		return result, nil
	}
	rows, err := d.telegramDB.Query(`
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
			COALESCE(sync_version, 0)
		FROM dinners
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var row dinnerMirrorRow
		var silverSeats, goldSeats, vipSeats sql.NullInt64
		var silverPrice, goldPrice, vipPrice sql.NullFloat64
		if err := rows.Scan(
			&row.ID,
			&row.Description,
			&row.Places,
			&row.AlreadyRegistered,
			&row.Location,
			&row.DinnerDate,
			&silverSeats,
			&goldSeats,
			&vipSeats,
			&silverPrice,
			&goldPrice,
			&vipPrice,
			&row.Expired,
			&row.CreatedAt,
			&row.UpdatedAt,
			&row.SyncVersion,
		); err != nil {
			return nil, err
		}
		row.SilverSeats = nullableIntPointer(silverSeats)
		row.GoldSeats = nullableIntPointer(goldSeats)
		row.VIPSeats = nullableIntPointer(vipSeats)
		row.SilverPrice = nullableFloatPointer(silverPrice)
		row.GoldPrice = nullableFloatPointer(goldPrice)
		row.VIPPrice = nullableFloatPointer(vipPrice)
		result[row.ID] = row
	}
	return result, rows.Err()
}

func (d *dinnersRepo) upsertTelegramDinnerMirror(row dinnerMirrorRow) error {
	if d.telegramDB == nil {
		return nil
	}
	_, err := d.telegramDB.Exec(`
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
	`, row.ID, row.Description, row.Places, row.Location, row.DinnerDate, toNullableSeatCount(row.SilverSeats), toNullableSeatCount(row.GoldSeats), toNullableSeatCount(row.VIPSeats), toNullablePrice(row.SilverPrice), toNullablePrice(row.GoldPrice), toNullablePrice(row.VIPPrice), row.Expired, row.SyncVersion)
	return err
}

func (d *dinnersRepo) deleteTelegramDinnerMirror(dinnerID int64, sourceVersion int64) error {
	if d.telegramDB == nil {
		return nil
	}
	hasDeps, err := d.telegramDinnerHasDependencies(dinnerID)
	if err != nil {
		return err
	}
	if hasDeps {
		return ErrDinnerDeleteBlockedByTelegramDependencies
	}
	_, err = d.telegramDB.Exec(`
		DELETE FROM dinners
		WHERE id = $1
		  AND COALESCE(sync_version, 0) <= $2
	`, dinnerID, sourceVersion)
	return err
}

func (d *dinnersRepo) telegramDinnerHasDependencies(dinnerID int64) (bool, error) {
	if d.telegramDB == nil || dinnerID <= 0 {
		return false, nil
	}
	var hasDependencies bool
	err := d.telegramDB.QueryRow(`
		SELECT
			EXISTS (SELECT 1 FROM package_info WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM registered_users WHERE dinner_id = $1)
			OR EXISTS (SELECT 1 FROM custom_package WHERE dinner_id = $1)
	`, dinnerID).Scan(&hasDependencies)
	return hasDependencies, err
}

func (d *dinnersRepo) countPendingDinnerSyncJobs() (int, error) {
	if d.landingDB == nil {
		return 0, nil
	}
	var count int
	err := d.landingDB.QueryRow(`
		SELECT COUNT(*)
		FROM dinner_sync_outbox
		WHERE status <> $1
	`, dinnerSyncStatusCompleted).Scan(&count)
	return count, err
}

func (d *dinnersRepo) ReconcileDinnerMirrors(dryRun bool) (DinnerMirrorReconciliationReport, error) {
	report := DinnerMirrorReconciliationReport{DryRun: dryRun}
	landingRows, err := d.loadAllLandingDinnerMirrorRows()
	if err != nil {
		return report, err
	}
	telegramRows, err := d.loadAllTelegramDinnerMirrorRows()
	if err != nil {
		return report, err
	}
	if !dryRun {
		processed, err := d.ProcessPendingDinnerSyncJobs(100)
		if err != nil {
			return report, err
		}
		report.PendingJobsProcessed = processed
		telegramRows, err = d.loadAllTelegramDinnerMirrorRows()
		if err != nil {
			return report, err
		}
	}

	for dinnerID, landingRow := range landingRows {
		telegramRow, exists := telegramRows[dinnerID]
		switch {
		case !exists:
			report.InsertedMirrors = append(report.InsertedMirrors, dinnerID)
			if !dryRun {
				if err := d.upsertTelegramDinnerMirror(landingRow); err != nil {
					report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("insert mirror dinner %d: %v", dinnerID, err))
					continue
				}
			}
		case dinnerMirrorRowsEqual(landingRow, telegramRow):
			report.AlreadyConsistent = append(report.AlreadyConsistent, dinnerID)
		default:
			report.UpdatedMirrors = append(report.UpdatedMirrors, dinnerID)
			if !dryRun {
				if err := d.upsertTelegramDinnerMirror(landingRow); err != nil {
					report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("update mirror dinner %d: %v", dinnerID, err))
					continue
				}
			}
		}

		derivedTotal, mismatch, err := d.dinnerOccupancyMismatch(dinnerID, exists, telegramRow)
		if err != nil {
			report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("check occupancy dinner %d: %v", dinnerID, err))
			continue
		}
		if mismatch {
			report.OccupancyMismatches = append(report.OccupancyMismatches, dinnerID)
			if !dryRun {
				if err := d.SyncDinnerRegistrations(dinnerID); err != nil {
					report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("repair occupancy dinner %d to %d: %v", dinnerID, derivedTotal, err))
				} else {
					report.OccupancyRepaired = append(report.OccupancyRepaired, dinnerID)
				}
			}
		}
	}

	for dinnerID, telegramRow := range telegramRows {
		if _, exists := landingRows[dinnerID]; exists {
			continue
		}
		report.MissingAuthoritative = append(report.MissingAuthoritative, dinnerID)
		hasDeps, err := d.telegramDinnerHasDependencies(dinnerID)
		if err != nil {
			report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("inspect orphan mirror dinner %d: %v", dinnerID, err))
			continue
		}
		if hasDeps {
			report.BlockedOrphanMirrors = append(report.BlockedOrphanMirrors, dinnerID)
			continue
		}
		if !dryRun {
			if err := d.deleteTelegramDinnerMirror(dinnerID, telegramRow.SyncVersion); err != nil {
				report.FailedOperations = append(report.FailedOperations, fmt.Sprintf("delete orphan mirror dinner %d: %v", dinnerID, err))
				continue
			}
		}
		report.DeletedOrphanMirrors = append(report.DeletedOrphanMirrors, dinnerID)
	}

	remaining, err := d.countPendingDinnerSyncJobs()
	if err != nil {
		return report, err
	}
	report.PendingJobsRemaining = remaining
	return report, nil
}

func (d *dinnersRepo) dinnerOccupancyMismatch(dinnerID int64, mirrorExists bool, telegramRow dinnerMirrorRow) (int64, bool, error) {
	landingCount, err := d.countLandingRegistrations([]int64{dinnerID})
	if err != nil {
		return 0, false, err
	}
	telegramCount, err := d.countTelegramRegistrations([]int64{dinnerID})
	if err != nil {
		return 0, false, err
	}
	total := landingCount[dinnerID] + telegramCount[dinnerID]
	landingRow, err := d.loadLandingDinnerMirrorRow(dinnerID)
	if err != nil {
		return 0, false, err
	}
	mismatch := int64(landingRow.AlreadyRegistered) != total
	if mirrorExists {
		mismatch = mismatch || int64(telegramRow.AlreadyRegistered) != total
	}
	return total, mismatch, nil
}

func dinnerMirrorRowsEqual(source, mirror dinnerMirrorRow) bool {
	return source.ID == mirror.ID &&
		source.Description == mirror.Description &&
		source.Places == mirror.Places &&
		source.Location == mirror.Location &&
		source.DinnerDate.Equal(mirror.DinnerDate) &&
		equalNullableIntPointers(source.SilverSeats, mirror.SilverSeats) &&
		equalNullableIntPointers(source.GoldSeats, mirror.GoldSeats) &&
		equalNullableIntPointers(source.VIPSeats, mirror.VIPSeats) &&
		equalNullableFloatPointers(source.SilverPrice, mirror.SilverPrice) &&
		equalNullableFloatPointers(source.GoldPrice, mirror.GoldPrice) &&
		equalNullableFloatPointers(source.VIPPrice, mirror.VIPPrice) &&
		source.Expired == mirror.Expired &&
		source.SyncVersion == mirror.SyncVersion
}

func equalNullableIntPointers(left, right *int) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return *left == *right
	}
}

func equalNullableFloatPointers(left, right *float64) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return *left == *right
	}
}

func nullableIntPointer(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int64)
	return &v
}

func nullableFloatPointer(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	v := value.Float64
	return &v
}
