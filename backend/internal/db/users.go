package db

import (
	"database/sql"
)

type UsersDB interface {
	Insert(Users) (string, error)
	UpdateSelection(userID string, dinnerID int64, chosenPackage string) error
	Close() error
	CountLandingUsers() (int64, error)
}

type usersRepo struct {
	db *sql.DB
}

func NewUsersDB(db *sql.DB) UsersDB {
	return &usersRepo{db: db}
}

func (u *usersRepo) Insert(users Users) (string, error) {
	query := `INSERT INTO
			users_landing(full_name,hobbies,allergies,guest_count,phone,email)
			VALUES ($1,$2,$3,$4,$5,$6)
			RETURNING id`

	var userID string
	if err := u.db.QueryRow(query, users.FullName, users.Hobbies, users.Allergies, users.GuestCount, users.Phone, users.Email).Scan(&userID); err != nil {
		return "", err
	}
	log.Info("User inserted success.")
	return userID, nil
}

func (u *usersRepo) UpdateSelection(userID string, dinnerID int64, chosenPackage string) error {
	query := `
		UPDATE users_landing
		SET dinner_id = $2, chosen_package = $3, updated_at = now()
		WHERE id = $1
	`
	result, err := u.db.Exec(query, userID, dinnerID, chosenPackage)
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

	return nil
}

func (u *usersRepo) Close() error {
	return u.db.Close()
}

func (u *usersRepo) CountLandingUsers() (int64, error) {
	const query = `SELECT COUNT(*) FROM users_landing`
	var count int64
	if err := u.db.QueryRow(query).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}
