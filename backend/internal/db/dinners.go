package db

import "database/sql"

type DinnersDB interface {
	GetActiveDinners() ([]Dinners, error)
	Close() error
}

type dinnersRepo struct {
	db *sql.DB
}

func NewDinnersDB(db *sql.DB) DinnersDB {
	return &dinnersRepo{db: db}
}

func (d *dinnersRepo) GetActiveDinners() ([]Dinners, error) {
	query := `
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
		ORDER BY dinner_date ASC;
	`

	rows, err := d.db.Query(query)
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

func (d *dinnersRepo) Close() error {
	return d.db.Close()
}
