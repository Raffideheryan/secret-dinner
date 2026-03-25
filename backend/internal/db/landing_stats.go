package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type LandingStatsDB interface {
	GetAdminStats() (LandingDashboardStats, error)
	Close() error
}

type landingStatsRepo struct {
	db *sql.DB
}

func NewLandingStatsDB(db *sql.DB) LandingStatsDB {
	return &landingStatsRepo{db: db}
}

func (r *landingStatsRepo) Close() error {
	return r.db.Close()
}

func (r *landingStatsRepo) GetAdminStats() (LandingDashboardStats, error) {
	const summaryQuery = `
		SELECT
			COUNT(*) AS total_users,
			COUNT(*) FILTER (WHERE dinner_id IS NOT NULL AND chosen_package IS NOT NULL) AS completed_selections,
			COUNT(*) FILTER (WHERE dinner_id IS NULL OR chosen_package IS NULL) AS pending_selections,
			COUNT(DISTINCT dinner_id) FILTER (WHERE dinner_id IS NOT NULL) AS selected_dinners,
			COALESCE(SUM(guest_count), 0) AS total_guests,
			COALESCE(AVG(guest_count), 0)::float8 AS avg_guests_per_user,
			COALESCE(
				AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)
				FILTER (WHERE dinner_id IS NOT NULL AND chosen_package IS NOT NULL AND updated_at >= created_at),
				0
			)::float8 AS avg_selection_hours,
			COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS recent_24h,
			COUNT(*) FILTER (
				WHERE dinner_id IS NOT NULL
					AND chosen_package IS NOT NULL
					AND updated_at >= now() - interval '24 hours'
			) AS recent_selections_24h,
			MAX(created_at) AS latest_application_at
		FROM users_landing
	`

	stats := LandingDashboardStats{}
	var latestApplication sql.NullTime
	if err := r.db.QueryRow(summaryQuery).Scan(
		&stats.TotalUsers,
		&stats.CompletedSelections,
		&stats.PendingSelections,
		&stats.SelectedDinners,
		&stats.TotalGuests,
		&stats.AvgGuestsPerUser,
		&stats.AvgSelectionHours,
		&stats.Recent24h,
		&stats.RecentSelections24h,
		&latestApplication,
	); err != nil {
		return LandingDashboardStats{}, err
	}
	if latestApplication.Valid {
		t := latestApplication.Time
		stats.LatestApplicationAt = &t
	}
	if stats.TotalUsers > 0 {
		stats.ConversionPercent = (float64(stats.CompletedSelections) / float64(stats.TotalUsers)) * 100
	}

	selectionP50, selectionP90, err := r.loadSelectionPercentiles()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.SelectionP50Hours = selectionP50
	stats.SelectionP90Hours = selectionP90

	const activeDinnersQuery = `
		SELECT COUNT(*)
		FROM landing_dinners
		WHERE expired = false AND dinner_date >= CURRENT_DATE
	`
	if err := r.db.QueryRow(activeDinnersQuery).Scan(&stats.ActiveDinners); err != nil {
		return LandingDashboardStats{}, err
	}

	const potentialRevenueQuery = `
		SELECT
			COALESCE(SUM(
				CASE lower(ul.chosen_package)
					WHEN 'silver' THEN COALESCE(ld.silver_price, 0)
					WHEN 'gold' THEN COALESCE(ld.gold_price, 0)
					WHEN 'vip' THEN COALESCE(ld.vip_price, 0)
					ELSE 0
				END
			), 0)::float8
		FROM users_landing ul
		JOIN landing_dinners ld ON ld.id = ul.dinner_id
		WHERE ul.dinner_id IS NOT NULL AND ul.chosen_package IS NOT NULL
	`
	if err := r.db.QueryRow(potentialRevenueQuery).Scan(&stats.PotentialRevenue); err != nil {
		return LandingDashboardStats{}, err
	}

	const packageBreakdownQuery = `
		SELECT lower(chosen_package), COUNT(*)
		FROM users_landing
		GROUP BY lower(chosen_package)
	`
	rows, err := r.db.Query(packageBreakdownQuery)
	if err != nil {
		return LandingDashboardStats{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var pkg sql.NullString
		var count int64
		if err := rows.Scan(&pkg, &count); err != nil {
			return LandingDashboardStats{}, err
		}

		switch strings.ToLower(strings.TrimSpace(pkg.String)) {
		case "silver":
			stats.PackageBreakdown.Silver = count
		case "gold":
			stats.PackageBreakdown.Gold = count
		case "vip":
			stats.PackageBreakdown.VIP = count
		case "custom":
			stats.PackageBreakdown.Custom = count
		default:
			stats.PackageBreakdown.Unselected += count
		}
	}
	if err := rows.Err(); err != nil {
		return LandingDashboardStats{}, err
	}

	submissions, err := r.loadDailySubmissions()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.DailySubmissions = submissions

	selections, err := r.loadDailySelections()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.DailySelections = selections

	hourly, err := r.loadHourlySubmissions()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.HourlySubmissions = hourly

	weekdaySubmissions, weekdaySelections, err := r.loadWeekdayFlow()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.WeekdaySubmissions = weekdaySubmissions
	stats.WeekdaySelections = weekdaySelections

	guestDistribution, err := r.loadGuestDistribution()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.GuestDistribution = guestDistribution

	lagBuckets, err := r.loadSelectionLagBuckets()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.SelectionLagBuckets = lagBuckets

	domains, err := r.loadTopEmailDomains()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.TopEmailDomains = domains

	topDinners, err := r.loadTopDinners()
	if err != nil {
		return LandingDashboardStats{}, err
	}
	stats.TopDinners = topDinners

	return stats, nil
}

func (r *landingStatsRepo) loadDailySubmissions() ([]DailyCountPoint, error) {
	const query = `
		SELECT day::date, COALESCE(cnt, 0)
		FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') day
		LEFT JOIN (
			SELECT date(created_at) AS d, COUNT(*) AS cnt
			FROM users_landing
			GROUP BY date(created_at)
		) grouped ON grouped.d = day::date
		ORDER BY day::date
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]DailyCountPoint, 0, 14)
	for rows.Next() {
		var day time.Time
		var count int64
		if err := rows.Scan(&day, &count); err != nil {
			return nil, err
		}
		points = append(points, DailyCountPoint{
			Day:   day.Format("2006-01-02"),
			Count: count,
		})
	}
	return points, rows.Err()
}

func (r *landingStatsRepo) loadDailySelections() ([]DailyCountPoint, error) {
	const query = `
		SELECT day::date, COALESCE(cnt, 0)
		FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') day
		LEFT JOIN (
			SELECT date(updated_at) AS d, COUNT(*) AS cnt
			FROM users_landing
			WHERE dinner_id IS NOT NULL AND chosen_package IS NOT NULL
			GROUP BY date(updated_at)
		) grouped ON grouped.d = day::date
		ORDER BY day::date
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]DailyCountPoint, 0, 14)
	for rows.Next() {
		var day time.Time
		var count int64
		if err := rows.Scan(&day, &count); err != nil {
			return nil, err
		}
		points = append(points, DailyCountPoint{
			Day:   day.Format("2006-01-02"),
			Count: count,
		})
	}
	return points, rows.Err()
}

func (r *landingStatsRepo) loadHourlySubmissions() ([]HourlyCountPoint, error) {
	const query = `
		SELECT hour_slot, COALESCE(cnt, 0)
		FROM generate_series(
			date_trunc('hour', now()) - interval '23 hours',
			date_trunc('hour', now()),
			interval '1 hour'
		) hour_slot
		LEFT JOIN (
			SELECT date_trunc('hour', created_at) AS h, COUNT(*) AS cnt
			FROM users_landing
			WHERE created_at >= now() - interval '24 hours'
			GROUP BY date_trunc('hour', created_at)
		) grouped ON grouped.h = hour_slot
		ORDER BY hour_slot
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]HourlyCountPoint, 0, 24)
	for rows.Next() {
		var hourSlot time.Time
		var count int64
		if err := rows.Scan(&hourSlot, &count); err != nil {
			return nil, err
		}
		points = append(points, HourlyCountPoint{
			Hour:  hourSlot.Format("15:04"),
			Count: count,
		})
	}
	return points, rows.Err()
}

func (r *landingStatsRepo) loadTopDinners() ([]DinnerFlowStat, error) {
	const query = `
		SELECT
			ld.id,
			ld.description,
			COALESCE(COUNT(ul.id), 0) AS registrations,
			COALESCE(ld.places, 0) AS capacity
		FROM landing_dinners ld
		LEFT JOIN users_landing ul
			ON ul.dinner_id = ld.id
			AND ul.chosen_package IS NOT NULL
		GROUP BY ld.id, ld.description, ld.places
		ORDER BY registrations DESC, ld.id DESC
		LIMIT 8
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make([]DinnerFlowStat, 0, 8)
	for rows.Next() {
		item := DinnerFlowStat{}
		if err := rows.Scan(&item.DinnerID, &item.Description, &item.Registrations, &item.Capacity); err != nil {
			return nil, err
		}
		if item.Capacity > 0 {
			item.FillPercent = (float64(item.Registrations) / float64(item.Capacity)) * 100
		}
		stats = append(stats, item)
	}
	return stats, rows.Err()
}

func (r *landingStatsRepo) loadSelectionPercentiles() (float64, float64, error) {
	const query = `
		SELECT
			COALESCE(
				percentile_cont(0.5) WITHIN GROUP (
					ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
				),
				0
			)::float8 AS p50_hours,
			COALESCE(
				percentile_cont(0.9) WITHIN GROUP (
					ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
				),
				0
			)::float8 AS p90_hours
		FROM users_landing
		WHERE dinner_id IS NOT NULL
			AND chosen_package IS NOT NULL
			AND updated_at >= created_at
	`

	var p50, p90 float64
	if err := r.db.QueryRow(query).Scan(&p50, &p90); err != nil {
		return 0, 0, err
	}
	return p50, p90, nil
}

func (r *landingStatsRepo) loadWeekdayFlow() ([]LabelCountPoint, []LabelCountPoint, error) {
	subMap := map[int]int64{}
	selectionMap := map[int]int64{}

	const submissionsQuery = `
		SELECT EXTRACT(ISODOW FROM created_at)::int AS dow, COUNT(*)
		FROM users_landing
		GROUP BY dow
	`
	subRows, err := r.db.Query(submissionsQuery)
	if err != nil {
		return nil, nil, err
	}
	defer subRows.Close()

	for subRows.Next() {
		var dow int
		var count int64
		if err := subRows.Scan(&dow, &count); err != nil {
			return nil, nil, err
		}
		subMap[dow] = count
	}
	if err := subRows.Err(); err != nil {
		return nil, nil, err
	}

	const selectionsQuery = `
		SELECT EXTRACT(ISODOW FROM updated_at)::int AS dow, COUNT(*)
		FROM users_landing
		WHERE dinner_id IS NOT NULL AND chosen_package IS NOT NULL
		GROUP BY dow
	`
	selectionRows, err := r.db.Query(selectionsQuery)
	if err != nil {
		return nil, nil, err
	}
	defer selectionRows.Close()

	for selectionRows.Next() {
		var dow int
		var count int64
		if err := selectionRows.Scan(&dow, &count); err != nil {
			return nil, nil, err
		}
		selectionMap[dow] = count
	}
	if err := selectionRows.Err(); err != nil {
		return nil, nil, err
	}

	labels := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	submissions := make([]LabelCountPoint, 0, 7)
	selections := make([]LabelCountPoint, 0, 7)
	for i, label := range labels {
		dow := i + 1
		submissions = append(submissions, LabelCountPoint{Label: label, Count: subMap[dow]})
		selections = append(selections, LabelCountPoint{Label: label, Count: selectionMap[dow]})
	}

	return submissions, selections, nil
}

func (r *landingStatsRepo) loadGuestDistribution() ([]LabelCountPoint, error) {
	const query = `
		SELECT bucket, COUNT(*)
		FROM (
			SELECT CASE
				WHEN guest_count <= 1 THEN '1'
				WHEN guest_count = 2 THEN '2'
				WHEN guest_count = 3 THEN '3'
				WHEN guest_count = 4 THEN '4'
				ELSE '5+'
			END AS bucket
			FROM users_landing
		) t
		GROUP BY bucket
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var bucket string
		var count int64
		if err := rows.Scan(&bucket, &count); err != nil {
			return nil, err
		}
		m[bucket] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	order := []string{"1", "2", "3", "4", "5+"}
	result := make([]LabelCountPoint, 0, len(order))
	for _, label := range order {
		result = append(result, LabelCountPoint{Label: label, Count: m[label]})
	}
	return result, nil
}

func (r *landingStatsRepo) loadSelectionLagBuckets() ([]LabelCountPoint, error) {
	const query = `
		SELECT bucket, COUNT(*)
		FROM (
			SELECT CASE
				WHEN lag_hours < 1 THEN '<1h'
				WHEN lag_hours < 6 THEN '1-6h'
				WHEN lag_hours < 24 THEN '6-24h'
				WHEN lag_hours < 72 THEN '1-3d'
				ELSE '3d+'
			END AS bucket
			FROM (
				SELECT EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 AS lag_hours
				FROM users_landing
				WHERE dinner_id IS NOT NULL
					AND chosen_package IS NOT NULL
					AND updated_at >= created_at
			) l
		) buckets
		GROUP BY bucket
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var bucket string
		var count int64
		if err := rows.Scan(&bucket, &count); err != nil {
			return nil, err
		}
		m[bucket] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	order := []string{"<1h", "1-6h", "6-24h", "1-3d", "3d+"}
	result := make([]LabelCountPoint, 0, len(order))
	for _, label := range order {
		result = append(result, LabelCountPoint{Label: label, Count: m[label]})
	}
	return result, nil
}

func (r *landingStatsRepo) loadTopEmailDomains() ([]LabelCountPoint, error) {
	const query = `
		SELECT split_part(lower(email), '@', 2) AS domain, COUNT(*) AS cnt
		FROM users_landing
		WHERE email LIKE '%@%'
		GROUP BY domain
		ORDER BY cnt DESC, domain
		LIMIT 8
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]LabelCountPoint, 0, 8)
	for rows.Next() {
		var domain string
		var count int64
		if err := rows.Scan(&domain, &count); err != nil {
			return nil, err
		}
		result = append(result, LabelCountPoint{
			Label: fmt.Sprintf("@%s", domain),
			Count: count,
		})
	}
	return result, rows.Err()
}
