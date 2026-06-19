package db

import (
	"database/sql"
	"strings"
	"time"

	"github.com/lib/pq"
)

func loadMeaningfulActiveUserKeys(activityDB *sql.DB, source string, since time.Time) ([]string, error) {
	if activityDB == nil {
		return []string{}, nil
	}

	meaningful := sortedMeaningfulEvents()
	if len(meaningful) == 0 {
		return []string{}, nil
	}

	rows, err := activityDB.Query(`
		SELECT DISTINCT user_key
		FROM user_activity_events
		WHERE source = $1
		  AND NULLIF(BTRIM(user_key), '') IS NOT NULL
		  AND occurred_at >= $2
		  AND LOWER(event_name) = ANY($3)
	`, strings.ToLower(strings.TrimSpace(source)), since.UTC(), pq.Array(meaningful))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]string, 0, 64)
	for rows.Next() {
		var userKey string
		if err := rows.Scan(&userKey); err != nil {
			return nil, err
		}
		result = append(result, strings.TrimSpace(userKey))
	}
	return result, rows.Err()
}
