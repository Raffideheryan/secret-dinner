package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"
)

type DinnersDB interface {
	GetActiveDinners() ([]Dinners, error)
	GetAdminDinners() ([]Dinners, error)
	CreateDinner(input DinnerMutation) (Dinners, error)
	UpdateDinner(id int64, input DinnerMutation) error
	DeleteDinner(id int64) error
	SyncDinnerRegistrations(dinnerID int64) error
	SyncAllDinnerRegistrations() error
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

	const insertLanding = `
		INSERT INTO landing_dinners (
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_price,
			gold_price,
			vip_price,
			expired
		)
		VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	var dinnerID int64
	if err := d.landingDB.QueryRow(
		insertLanding,
		input.Description,
		input.Places,
		input.Location,
		input.DinnerDate,
		toNullablePrice(input.SilverPrice),
		toNullablePrice(input.GoldPrice),
		toNullablePrice(input.VIPPrice),
		input.Expired,
	).Scan(&dinnerID); err != nil {
		return Dinners{}, err
	}

	if d.telegramDB != nil {
		const insertTelegram = `
			INSERT INTO dinners (
				id,
				description,
				places,
				already_registered,
				location,
				dinner_date,
				silver_price,
				gold_price,
				vip_price,
				expired
			)
			VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9)
		`
		if _, err := d.telegramDB.Exec(
			insertTelegram,
			dinnerID,
			input.Description,
			input.Places,
			input.Location,
			input.DinnerDate,
			toNullablePrice(input.SilverPrice),
			toNullablePrice(input.GoldPrice),
			toNullablePrice(input.VIPPrice),
			input.Expired,
		); err != nil {
			_, _ = d.landingDB.Exec(`DELETE FROM landing_dinners WHERE id = $1`, dinnerID)
			return Dinners{}, err
		}

		if err := setDinnerSequence(d.telegramDB, "dinners"); err != nil {
			return Dinners{}, err
		}
	}

	if err := setDinnerSequence(d.landingDB, "landing_dinners"); err != nil {
		return Dinners{}, err
	}

	if err := d.SyncDinnerRegistrations(dinnerID); err != nil {
		log.WithError(err).Warn("failed to sync dinner registrations after create")
	}

	dinners, err := d.GetAdminDinners()
	if err != nil {
		return Dinners{}, err
	}
	for _, dinner := range dinners {
		if dinner.ID == dinnerID {
			return dinner, nil
		}
	}

	return Dinners{}, sql.ErrNoRows
}

func (d *dinnersRepo) UpdateDinner(id int64, input DinnerMutation) error {
	if strings.TrimSpace(input.Description) == "" || strings.TrimSpace(input.Location) == "" || input.DinnerDate.IsZero() {
		return errors.New("description, location and dinnerDate are required")
	}
	if input.Places < 0 {
		return errors.New("places must be >= 0")
	}

	const updateLanding = `
		UPDATE landing_dinners
		SET description = $2,
			places = $3,
			location = $4,
			dinner_date = $5,
			silver_price = $6,
			gold_price = $7,
			vip_price = $8,
			expired = $9,
			updated_at = now()
		WHERE id = $1
	`

	result, err := d.landingDB.Exec(
		updateLanding,
		id,
		input.Description,
		input.Places,
		input.Location,
		input.DinnerDate,
		toNullablePrice(input.SilverPrice),
		toNullablePrice(input.GoldPrice),
		toNullablePrice(input.VIPPrice),
		input.Expired,
	)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if d.telegramDB != nil {
		const updateTelegram = `
			UPDATE dinners
			SET description = $2,
				places = $3,
				location = $4,
				dinner_date = $5,
				silver_price = $6,
				gold_price = $7,
				vip_price = $8,
				expired = $9,
				updated_at = now()
			WHERE id = $1
		`
		if _, err := d.telegramDB.Exec(
			updateTelegram,
			id,
			input.Description,
			input.Places,
			input.Location,
			input.DinnerDate,
			toNullablePrice(input.SilverPrice),
			toNullablePrice(input.GoldPrice),
			toNullablePrice(input.VIPPrice),
			input.Expired,
		); err != nil {
			return err
		}
	}

	return nil
}

func (d *dinnersRepo) DeleteDinner(id int64) error {
	result, err := d.landingDB.Exec(`DELETE FROM landing_dinners WHERE id = $1`, id)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	if d.telegramDB != nil {
		if _, err := d.telegramDB.Exec(`DELETE FROM dinners WHERE id = $1`, id); err != nil {
			return err
		}
	}
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

func (d *dinnersRepo) fetchDinners(query string) ([]Dinners, error) {
	rows, err := d.landingDB.Query(query)
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

	for i := range dinners {
		id := dinners[i].ID
		dinners[i].AlreadyRegistered = int(landingCount[id] + telegramCount[id])
	}
}

func (d *dinnersRepo) countLandingRegistrations(ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	const query = `
		SELECT dinner_id, COUNT(*)
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		GROUP BY dinner_id
	`
	rows, err := d.landingDB.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dinnerID int64
		var count int64
		if err := rows.Scan(&dinnerID, &count); err != nil {
			return nil, err
		}
		result[dinnerID] = count
	}
	return result, rows.Err()
}

func (d *dinnersRepo) countTelegramRegistrations(ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if d.telegramDB == nil || len(ids) == 0 {
		return result, nil
	}
	const query = `
		SELECT dinner_id, COUNT(*)
		FROM registered_users
		WHERE dinner_id = ANY($1)
		GROUP BY dinner_id
	`
	rows, err := d.telegramDB.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var dinnerID int64
		var count int64
		if err := rows.Scan(&dinnerID, &count); err != nil {
			return nil, err
		}
		result[dinnerID] = count
	}
	return result, rows.Err()
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
