package db

import (
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

func (r *adminUsersRepo) GetSmartSegments() ([]SmartSegmentResult, error) {
	segments := make([]SmartSegmentResult, 0, 7)

	if r.telegramDB != nil {
		highValue, err := r.segmentHighValue()
		if err != nil {
			log.WithError(err).Warn("failed to compute high_value segment")
		} else {
			segments = append(segments, highValue)
		}

		referralChampions, err := r.segmentReferralChampions()
		if err != nil {
			log.WithError(err).Warn("failed to compute referral_champions segment")
		} else {
			segments = append(segments, referralChampions)
		}

		frequentAttendees, err := r.segmentFrequentAttendees()
		if err != nil {
			log.WithError(err).Warn("failed to compute frequent_attendees segment")
		} else {
			segments = append(segments, frequentAttendees)
		}

		frequentNoShows, err := r.segmentFrequentNoShows()
		if err != nil {
			log.WithError(err).Warn("failed to compute frequent_no_shows segment")
		} else {
			segments = append(segments, frequentNoShows)
		}

		potentialVIPs, err := r.segmentPotentialVIPs()
		if err != nil {
			log.WithError(err).Warn("failed to compute potential_vips segment")
		} else {
			segments = append(segments, potentialVIPs)
		}

		passive, err := r.segmentPassiveUsers()
		if err != nil {
			log.WithError(err).Warn("failed to compute passive_users segment")
		} else {
			segments = append(segments, passive)
		}

		churnRisk, err := r.segmentChurnRisk()
		if err != nil {
			log.WithError(err).Warn("failed to compute churn_risk segment")
		} else {
			segments = append(segments, churnRisk)
		}
	}

	return segments, nil
}

func (r *adminUsersRepo) segmentHighValue() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.total_payments >= 200
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COALESCE(u.total_payments, 0)
		FROM users u
		WHERE u.total_payments >= 200
		ORDER BY u.total_payments DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "high_value",
		Label:       "High Value Users",
		Description: "Users who have paid ≥ $200 in total",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentReferralChampions() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.friends_invited >= 3
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COALESCE(u.friends_invited, 0)::float8
		FROM users u
		WHERE u.friends_invited >= 3
		ORDER BY u.friends_invited DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "referral_champions",
		Label:       "Referral Champions",
		Description: "Users who have invited ≥ 3 friends",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentFrequentAttendees() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.attendance_count >= 3
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COALESCE(u.attendance_count, 0)::float8
		FROM users u
		WHERE u.attendance_count >= 3
		ORDER BY u.attendance_count DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "frequent_attendees",
		Label:       "Frequent Attendees",
		Description: "Users who have attended ≥ 3 dinners",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentFrequentNoShows() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM (
			SELECT u.id
			FROM users u
			JOIN registered_users ru ON ru.user_id = u.id
			JOIN package_info pi ON pi.id = ru.package_info_id AND pi.status = 'no_show'
			GROUP BY u.id
			HAVING COUNT(pi.id) >= 2
		) AS segment_users
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COUNT(pi.id)::float8 AS no_show_count
		FROM users u
		JOIN registered_users ru ON ru.user_id = u.id
		JOIN package_info pi ON pi.id = ru.package_info_id AND pi.status = 'no_show'
		GROUP BY u.id, u.name, u.surname
		HAVING COUNT(pi.id) >= 2
		ORDER BY no_show_count DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "frequent_no_shows",
		Label:       "Frequent No-Shows",
		Description: "Users who have not shown up ≥ 2 times",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentPotentialVIPs() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) = 0
		  AND (
		    COALESCE(u.friends_invited, 0) >= 2
		    OR COALESCE(u.attendance_count, 0) >= 1
		    OR COALESCE(u.points, 0) >= 100
		  )
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COALESCE(u.attendance_count, 0)::float8
		FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) = 0
		  AND (
		    COALESCE(u.friends_invited, 0) >= 2
		    OR COALESCE(u.attendance_count, 0) >= 1
		    OR COALESCE(u.points, 0) >= 100
		  )
		ORDER BY u.points DESC, u.friends_invited DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "potential_vips",
		Label:       "Potential VIPs",
		Description: "Engaged users who haven't paid yet — prime conversion targets",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentPassiveUsers() (SmartSegmentResult, error) {
	ids, err := r.loadMeaningfulActiveUserIDs()
	if err != nil {
		return SmartSegmentResult{}, err
	}
	condition := ""
	args := []any{}
	if len(ids) > 0 {
		args = append(args, pq.Array(ids))
		condition = fmt.Sprintf("AND u.id::text <> ALL($%d)", len(args))
	}
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.terms_accepted = true
		`+condition, args...)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			0::float8
		FROM users u
		WHERE u.terms_accepted = true
		`+condition+`
		ORDER BY u.created_at DESC
		LIMIT 50
	`, args...)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "passive_users",
		Label:       "Passive Users",
		Description: "Registered with terms accepted but no activity, payments, or referrals",
		Count:       count,
		Users:       users,
	}, nil
}

func (r *adminUsersRepo) segmentChurnRisk() (SmartSegmentResult, error) {
	count, err := r.countSegment(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) > 0
		  AND NOT EXISTS (
		    SELECT 1 FROM registered_users ru
		    WHERE ru.user_id = u.id
		      AND ru.created_at > now() - interval '120 days'
		  )
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			u.id::text,
			TRIM(COALESCE(u.name, '') || ' ' || COALESCE(u.surname, '')),
			COALESCE(u.total_payments, 0)
		FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) > 0
		  AND NOT EXISTS (
		    SELECT 1 FROM registered_users ru
		    WHERE ru.user_id = u.id
		      AND ru.created_at > now() - interval '120 days'
		  )
		ORDER BY u.total_payments DESC
		LIMIT 50
	`)
	if err != nil {
		return SmartSegmentResult{}, err
	}
	defer rows.Close()
	users, _, err := scanSegmentUsers(rows, "telegram")
	if err != nil {
		return SmartSegmentResult{}, err
	}
	return SmartSegmentResult{
		Key:         "churn_risk",
		Label:       "Churn Risk",
		Description: "Paying users with no booking activity in the last 120 days",
		Count:       count,
		Users:       users,
	}, nil
}

func scanSegmentUsers(rows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}, source string) ([]SmartSegmentUser, int64, error) {
	users := make([]SmartSegmentUser, 0, 8)
	for rows.Next() {
		var u SmartSegmentUser
		u.Source = source
		if err := rows.Scan(&u.ID, &u.Name, &u.Value); err != nil {
			return nil, 0, err
		}
		u.Name = strings.TrimSpace(u.Name)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return users, int64(len(users)), nil
}

func (r *adminUsersRepo) countSegment(query string, args ...any) (int64, error) {
	var count int64
	if err := r.telegramDB.QueryRow(query, args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *adminUsersRepo) loadMeaningfulActiveUserIDs() ([]string, error) {
	return loadMeaningfulActiveUserKeys(r.activityDB, "telegram", time.Now().UTC().AddDate(0, 0, -30))
}

func (r *adminUsersRepo) GetAdminRecommendations() ([]AdminRecommendation, error) {
	recs := make([]AdminRecommendation, 0, 8)

	if r.telegramDB == nil {
		return recs, nil
	}

	var churnCount int64
	if err := r.telegramDB.QueryRow(`
		SELECT COUNT(*) FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) > 0
		  AND NOT EXISTS (
		    SELECT 1 FROM registered_users ru
		    WHERE ru.user_id = u.id
		      AND ru.created_at > now() - interval '120 days'
		  )
	`).Scan(&churnCount); err == nil && churnCount > 0 {
		priority := "medium"
		if churnCount >= 10 {
			priority = "high"
		}
		recs = append(recs, AdminRecommendation{
			Priority: priority,
			Type:     "retention",
			Title:    "Re-engage churned users",
			Message:  fmt.Sprintf("%d paying users have had no booking activity in 120+ days.", churnCount),
			Action:   "Send a re-engagement campaign targeting the Churn Risk segment",
			Count:    churnCount,
		})
	}

	var passiveCount int64
	if err := r.telegramDB.QueryRow(`
		SELECT COUNT(*) FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) = 0
		  AND COALESCE(u.attendance_count, 0) = 0
		  AND COALESCE(u.friends_invited, 0) = 0
		  AND COALESCE(u.points, 0) = 0
	`).Scan(&passiveCount); err == nil && passiveCount > 0 {
		recs = append(recs, AdminRecommendation{
			Priority: "medium",
			Type:     "engagement",
			Title:    "Activate passive users",
			Message:  fmt.Sprintf("%d users accepted terms but have no engagement, payments, or referrals.", passiveCount),
			Action:   "Run an intro campaign with dinner preview for the Passive Users segment",
			Count:    passiveCount,
		})
	}

	var potentialVIPCount int64
	if err := r.telegramDB.QueryRow(`
		SELECT COUNT(*) FROM users u
		WHERE u.terms_accepted = true
		  AND COALESCE(u.total_payments, 0) = 0
		  AND (COALESCE(u.friends_invited, 0) >= 2 OR COALESCE(u.attendance_count, 0) >= 1 OR COALESCE(u.points, 0) >= 100)
	`).Scan(&potentialVIPCount); err == nil && potentialVIPCount > 0 {
		recs = append(recs, AdminRecommendation{
			Priority: "high",
			Type:     "revenue",
			Title:    "Convert Potential VIPs",
			Message:  fmt.Sprintf("%d engaged users haven't made a payment yet — high conversion potential.", potentialVIPCount),
			Action:   "Send a personalized invite or exclusive offer to the Potential VIPs segment",
			Count:    potentialVIPCount,
		})
	}

	var noShowCount int64
	if err := r.telegramDB.QueryRow(`
		SELECT COUNT(DISTINCT u.id) FROM users u
		JOIN registered_users ru ON ru.user_id = u.id
		JOIN package_info pi ON pi.id = ru.package_info_id AND pi.status = 'no_show'
		GROUP BY u.id
		HAVING COUNT(pi.id) >= 2
	`).Scan(&noShowCount); err == nil && noShowCount > 0 {
		recs = append(recs, AdminRecommendation{
			Priority: "low",
			Type:     "engagement",
			Title:    "Follow up with repeat no-shows",
			Message:  fmt.Sprintf("%d users have missed 2+ dinners after registering.", noShowCount),
			Action:   "Consider a personal check-in or adjusted reminder flow for no-show users",
			Count:    noShowCount,
		})
	}

	var referralChampionCount int64
	if err := r.telegramDB.QueryRow(`
		SELECT COUNT(*) FROM users WHERE friends_invited >= 3
	`).Scan(&referralChampionCount); err == nil && referralChampionCount > 0 {
		recs = append(recs, AdminRecommendation{
			Priority: "medium",
			Type:     "growth",
			Title:    "Reward referral champions",
			Message:  fmt.Sprintf("%d users have each referred 3+ friends. Recognizing them drives more referrals.", referralChampionCount),
			Action:   "Tag them as Referral Leader and send a thank-you with a loyalty bonus",
			Count:    referralChampionCount,
		})
	}

	return recs, nil
}
