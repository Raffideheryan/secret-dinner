package db

import (
	"database/sql"
)

type UsersDB interface {
	Insert(Users) error
	Close() error
	CountLandingUsers() (int64, error)
}

type usersRepo struct {
	db *sql.DB
}

func NewUsersDB(db *sql.DB) UsersDB {
	return &usersRepo{db: db}
}

func (u *usersRepo) Insert(users Users) error {
	query := `INSERT INTO
			users_landing(full_name,hobbies,allergies,guest_count,phone,email)
			VALUES ($1,$2,$3,$4,$5,$6)`

	if _, err := u.db.Exec(query, users.FullName, users.Hobbies, users.Allergies, users.GuestCount, users.Phone, users.Email); err != nil {
		return err
	}
	log.Info("User inserted success.")
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
