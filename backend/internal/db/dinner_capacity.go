package db

import (
	"database/sql"
	"strings"

	"github.com/lib/pq"
)

var telegramCapacityStatuses = map[string]struct{}{
	"draft":               {},
	"pending_application": {},
	"contacted":           {},
	"approved":            {},
	"waiting_payment":     {},
	"paid":                {},
}

func countLandingDinnerSeats(db *sql.DB, ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if db == nil || len(ids) == 0 {
		return result, nil
	}

	const query = `
		SELECT dinner_id, COALESCE(SUM(guest_count), 0) AS seats
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
		GROUP BY dinner_id
	`

	rows, err := db.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dinnerID int64
		var seats int64
		if err := rows.Scan(&dinnerID, &seats); err != nil {
			return nil, err
		}
		result[dinnerID] = seats
	}

	return result, rows.Err()
}

func countTelegramDinnerSeats(db *sql.DB, ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if db == nil || len(ids) == 0 {
		return result, nil
	}

	const query = `
		SELECT ru.dinner_id, COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = ANY($1)
	`

	rows, err := db.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dinnerID int64
		var status string
		var menu string
		if err := rows.Scan(&dinnerID, &status, &menu); err != nil {
			return nil, err
		}
		_, seats := telegramCapacityUsage(status, menu)
		result[dinnerID] += seats
	}

	return result, rows.Err()
}

func telegramStatusCountsTowardCapacity(status string) bool {
	_, ok := telegramCapacityStatuses[strings.ToLower(strings.TrimSpace(status))]
	return ok
}

func countLandingDinnerBookings(db *sql.DB, ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if db == nil || len(ids) == 0 {
		return result, nil
	}

	const query = `
		SELECT dinner_id, COUNT(*) AS bookings
		FROM users_landing
		WHERE dinner_id = ANY($1)
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
		GROUP BY dinner_id
	`

	rows, err := db.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dinnerID int64
		var bookings int64
		if err := rows.Scan(&dinnerID, &bookings); err != nil {
			return nil, err
		}
		result[dinnerID] = bookings
	}

	return result, rows.Err()
}

func countTelegramDinnerBookings(db *sql.DB, ids []int64) (map[int64]int64, error) {
	result := make(map[int64]int64, len(ids))
	if db == nil || len(ids) == 0 {
		return result, nil
	}

	const query = `
		SELECT ru.dinner_id, COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = ANY($1)
	`

	rows, err := db.Query(query, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dinnerID int64
		var status string
		var menu string
		if err := rows.Scan(&dinnerID, &status, &menu); err != nil {
			return nil, err
		}
		bookings, _ := telegramCapacityUsage(status, menu)
		result[dinnerID] += bookings
	}

	return result, rows.Err()
}

func telegramCapacityUsage(status string, menu string) (bookings int64, seats int64) {
	if !telegramStatusCountsTowardCapacity(status) {
		return 0, 0
	}
	_, _, guestCount := deriveApplicationPackageMeta(menu)
	if guestCount <= 0 {
		return 0, 0
	}
	return 1, int64(guestCount)
}
