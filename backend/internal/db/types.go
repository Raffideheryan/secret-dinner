package db

import (
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "db")

type Connections struct {
	Users   UsersDB
	Dinners DinnersDB
}

type Users struct {
	FullName   string `json:"fullName" db:"full_name"`
	Hobbies    string `json:"hobbies" db:"hobbies"`
	Allergies  string `json:"allergies" db:"allergies"`
	GuestCount int    `json:"guestCount" db:"guest_count"`
	Phone      string `json:"phone" db:"phone"`
	Email      string `json:"email" db:"email"`
}

type Dinners struct {
	ID                int64     `json:"id" db:"id"`
	Description       string    `json:"description" db:"description"`
	Places            int       `json:"places" db:"places"`
	AlreadyRegistered int       `json:"alreadyRegistered" db:"already_registered"`
	Location          string    `json:"location" db:"location"`
	DinnerDate        time.Time `json:"dinnerDate" db:"dinner_date"`
	SilverPrice       *float64  `json:"silverPrice" db:"silver_price"`
	GoldPrice         *float64  `json:"goldPrice" db:"gold_price"`
	VIPPrice          *float64  `json:"vipPrice" db:"vip_price"`
	Expired           bool      `json:"expired" db:"expired"`
	CreatedAt         time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
}
