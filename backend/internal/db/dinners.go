package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type DinnersDB interface {
	GetActiveDinners() ([]Dinners, error)
	GetAdminDinners() ([]Dinners, error)
	CreateDinner(input DinnerMutation) (Dinners, error)
	UpdateDinner(id int64, input DinnerMutation) error
	DeleteDinner(id int64) error
	SyncDinnerRegistrations(dinnerID int64) error
	SyncAllDinnerRegistrations() error
	ProcessPendingDinnerSyncJobs(limit int) (int, error)
	ReconcileDinnerMirrors(dryRun bool) (DinnerMirrorReconciliationReport, error)
	Close() error
}

type dinnersRepo struct {
	landingDB  *sql.DB
	telegramDB *sql.DB
}

func NewDinnersDB(landingDB, telegramDB *sql.DB) DinnersDB {
	return &dinnersRepo{
		landingDB:  landingDB,
		telegramDB: telegramDB,
	}
}

func (d *dinnersRepo) Close() error {
	var closeErr error
	if d.landingDB != nil {
		if err := d.landingDB.Close(); err != nil {
			closeErr = err
		}
	}
	if d.telegramDB != nil {
		if err := d.telegramDB.Close(); err != nil && closeErr == nil {
			closeErr = err
		}
	}
	return closeErr
}

func (d *dinnersRepo) GetActiveDinners() ([]Dinners, error) {
	const query = `
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
		WHERE expired = false
		ORDER BY dinner_date ASC
	`
	dinners, err := d.fetchDinners(query)
	if err != nil {
		return nil, err
	}
	d.attachCombinedRegistrations(dinners)
	return dinners, nil
}

func (d *dinnersRepo) GetAdminDinners() ([]Dinners, error) {
	const query = `
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
		ORDER BY dinner_date ASC, id ASC
	`
	dinners, err := d.fetchDinners(query)
	if err != nil {
		return nil, err
	}
	d.attachCombinedRegistrations(dinners)
	return dinners, nil
}

func (d *dinnersRepo) CreateDinner(input DinnerMutation) (Dinners, error) {
	if strings.TrimSpace(input.Description) == "" || strings.TrimSpace(input.Location) == "" || input.DinnerDate.IsZero() {
		return Dinners{}, errors.New("description, location and dinnerDate are required")
	}
	if input.Places < 0 {
		return Dinners{}, errors.New("places must be >= 0")
	}

	tx, err := d.landingDB.Begin()
	if err != nil {
		return Dinners{}, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const insertLanding = `
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
	`

	var dinnerID int64
	var sourceVersion int64
	var sourceUpdatedAt time.Time
	if err := tx.QueryRow(
		insertLanding,
		input.Description,
		input.Places,
		input.Location,
		input.DinnerDate,
		toNullableSeatCount(input.SilverSeats),
		toNullableSeatCount(input.GoldSeats),
		toNullableSeatCount(input.VIPSeats),
		toNullablePrice(input.SilverPrice),
		toNullablePrice(input.GoldPrice),
		toNullablePrice(input.VIPPrice),
		input.Expired,
	).Scan(&dinnerID, &sourceVersion, &sourceUpdatedAt); err != nil {
		return Dinners{}, err
	}
	if err := d.enqueueDinnerSyncJobTx(tx, dinnerID, dinnerSyncOperationUpsert, sourceVersion, sourceUpdatedAt.UTC()); err != nil {
		return Dinners{}, err
	}
	if err := tx.Commit(); err != nil {
		return Dinners{}, err
	}
	committed = true

	d.processDinnerSyncJobNow(dinnerID)

	return d.getDinnerByID(dinnerID)
}

func (d *dinnersRepo) UpdateDinner(id int64, input DinnerMutation) error {
	if strings.TrimSpace(input.Description) == "" || strings.TrimSpace(input.Location) == "" || input.DinnerDate.IsZero() {
		return errors.New("description, location and dinnerDate are required")
	}
	if input.Places < 0 {
		return errors.New("places must be >= 0")
	}

	tx, err := d.landingDB.Begin()
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const updateLanding = `
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
	`

	var sourceVersion int64
	var sourceUpdatedAt time.Time
	err = tx.QueryRow(
		updateLanding,
		id,
		input.Description,
		input.Places,
		input.Location,
		input.DinnerDate,
		toNullableSeatCount(input.SilverSeats),
		toNullableSeatCount(input.GoldSeats),
		toNullableSeatCount(input.VIPSeats),
		toNullablePrice(input.SilverPrice),
		toNullablePrice(input.GoldPrice),
		toNullablePrice(input.VIPPrice),
		input.Expired,
	).Scan(&sourceVersion, &sourceUpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sql.ErrNoRows
		}
		return err
	}
	if err := d.enqueueDinnerSyncJobTx(tx, id, dinnerSyncOperationUpsert, sourceVersion, sourceUpdatedAt.UTC()); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true

	d.processDinnerSyncJobNow(id)
	return nil
}

func (d *dinnersRepo) DeleteDinner(id int64) error {
	if id <= 0 {
		return sql.ErrNoRows
	}
	hasDeps, err := d.telegramDinnerHasDependencies(id)
	if err != nil {
		return err
	}
	if hasDeps {
		return ErrDinnerDeleteBlockedByTelegramDependencies
	}

	tx, err := d.landingDB.Begin()
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	var sourceVersion int64
	var sourceUpdatedAt time.Time
	err = tx.QueryRow(`
		DELETE FROM landing_dinners
		WHERE id = $1
		RETURNING COALESCE(sync_version, 1) + 1, now()
	`, id).Scan(&sourceVersion, &sourceUpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sql.ErrNoRows
		}
		return err
	}

	if err := d.enqueueDinnerSyncJobTx(tx, id, dinnerSyncOperationDelete, sourceVersion, sourceUpdatedAt.UTC()); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true

	d.processDinnerSyncJobNow(id)
	return nil
}

func (d *dinnersRepo) SyncAllDinnerRegistrations() error {
	ids, err := d.collectAllDinnerIDs()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := d.SyncDinnerRegistrations(id); err != nil {
			return err
		}
	}
	return nil
}

func (d *dinnersRepo) SyncDinnerRegistrations(dinnerID int64) error {
	if dinnerID <= 0 {
		return errors.New("dinnerID must be > 0")
	}

	landingCount, err := d.countLandingRegistrations([]int64{dinnerID})
	if err != nil {
		return err
	}
	telegramCount, err := d.countTelegramRegistrations([]int64{dinnerID})
	if err != nil {
		return err
	}

	total := landingCount[dinnerID] + telegramCount[dinnerID]
	if _, err := d.landingDB.Exec(`UPDATE landing_dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
		return err
	}
	if d.telegramDB != nil {
		if _, err := d.telegramDB.Exec(`UPDATE dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
			return err
		}
	}
	return nil
}

func (d *dinnersRepo) fetchDinners(query string, args ...any) ([]Dinners, error) {
	rows, err := d.landingDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dinners := make([]Dinners, 0)
	for rows.Next() {
		var dinner Dinners
		if err := rows.Scan(
			&dinner.ID,
			&dinner.Description,
			&dinner.Places,
			&dinner.AlreadyRegistered,
			&dinner.Location,
			&dinner.DinnerDate,
			&dinner.SilverSeats,
			&dinner.GoldSeats,
			&dinner.VIPSeats,
			&dinner.SilverPrice,
			&dinner.GoldPrice,
			&dinner.VIPPrice,
			&dinner.Expired,
			&dinner.CreatedAt,
			&dinner.UpdatedAt,
		); err != nil {
			return nil, err
		}
		dinners = append(dinners, dinner)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return dinners, nil
}

func (d *dinnersRepo) getDinnerByID(id int64) (Dinners, error) {
	const query = `
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
	`
	dinners, err := d.fetchDinners(query, id)
	if err != nil {
		return Dinners{}, err
	}
	if len(dinners) == 0 {
		return Dinners{}, sql.ErrNoRows
	}
	d.attachCombinedRegistrations(dinners)
	return dinners[0], nil
}

func (d *dinnersRepo) attachCombinedRegistrations(dinners []Dinners) {
	if len(dinners) == 0 {
		return
	}
	ids := make([]int64, 0, len(dinners))
	for _, dinner := range dinners {
		ids = append(ids, dinner.ID)
	}

	landingCount, err := d.countLandingRegistrations(ids)
	if err != nil {
		log.WithError(err).Warn("failed to count landing registrations")
		return
	}
	telegramCount, err := d.countTelegramRegistrations(ids)
	if err != nil {
		log.WithError(err).Warn("failed to count telegram registrations")
		return
	}
	landingBookings, err := countLandingDinnerBookings(d.landingDB, ids)
	if err != nil {
		log.WithError(err).Warn("failed to count landing bookings")
		return
	}
	telegramBookings, err := countTelegramDinnerBookings(d.telegramDB, ids)
	if err != nil {
		log.WithError(err).Warn("failed to count telegram bookings")
		return
	}

	for i := range dinners {
		id := dinners[i].ID
		dinners[i].AlreadyRegistered = int(landingCount[id] + telegramCount[id])
		dinners[i].ActiveBookings = int(landingBookings[id] + telegramBookings[id])
	}
}

func (d *dinnersRepo) countLandingRegistrations(ids []int64) (map[int64]int64, error) {
	return countLandingDinnerSeats(d.landingDB, ids)
}

func (d *dinnersRepo) countTelegramRegistrations(ids []int64) (map[int64]int64, error) {
	return countTelegramDinnerSeats(d.telegramDB, ids)
}

func (d *dinnersRepo) collectAllDinnerIDs() ([]int64, error) {
	idsSet := make(map[int64]struct{})
	loadIDs := func(database *sql.DB, query string) error {
		if database == nil {
			return nil
		}
		rows, err := database.Query(query)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return err
			}
			idsSet[id] = struct{}{}
		}
		return rows.Err()
	}

	if err := loadIDs(d.landingDB, `SELECT id FROM landing_dinners`); err != nil {
		return nil, err
	}
	if err := loadIDs(d.telegramDB, `SELECT id FROM dinners`); err != nil {
		return nil, err
	}

	ids := make([]int64, 0, len(idsSet))
	for id := range idsSet {
		ids = append(ids, id)
	}
	return ids, nil
}

func setDinnerSequence(database *sql.DB, tableName string) error {
	query := fmt.Sprintf(
		`SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1), true)`,
		tableName,
		tableName,
	)
	_, err := database.Exec(query)
	return err
}

func toNullablePrice(value *float64) interface{} {
	if value == nil {
		return nil
	}
	if *value < 0 {
		zero := 0.0
		return zero
	}
	return *value
}

func toNullableSeatCount(value *int) interface{} {
	if value == nil {
		return nil
	}
	if *value < 0 {
		zero := 0
		return zero
	}
	return *value
}
