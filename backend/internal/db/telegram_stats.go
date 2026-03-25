package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type TelegramStatsDB interface {
	GetAdminStats() (TelegramDashboardStats, error)
	Close() error
}

type telegramStatsRepo struct {
	db *sql.DB
}

func NewTelegramStatsDB(db *sql.DB) TelegramStatsDB {
	return &telegramStatsRepo{db: db}
}

func (r *telegramStatsRepo) Close() error {
	return r.db.Close()
}

func (r *telegramStatsRepo) GetAdminStats() (TelegramDashboardStats, error) {
	const summaryQuery = `
		SELECT
			(SELECT COUNT(*) FROM users) AS total_users,
			(SELECT COUNT(*) FROM users WHERE terms_accepted = true) AS accepted_terms_users,
			(SELECT COUNT(*) FROM users WHERE phone IS NOT NULL AND btrim(phone) <> '') AS users_with_phone,
			(SELECT COUNT(*) FROM users WHERE total_payments > 0) AS users_with_payments,
			(SELECT COUNT(*) FROM dinners) AS total_dinners,
			(SELECT COUNT(*) FROM dinners WHERE expired = false AND dinner_date >= CURRENT_DATE) AS active_dinners,
			(SELECT COUNT(*) FROM registered_users) AS registrations_total,
			(SELECT COUNT(*) FROM referals) AS referrals_total,
			(SELECT COUNT(*) FROM blocked_users WHERE unblock_date IS NULL OR unblock_date > now()) AS blocked_active,
			COALESCE((SELECT SUM(price)::float8 FROM package_info), 0) AS revenue_total,
			COALESCE((
				SELECT SUM(pi.price)::float8
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.created_at >= now() - interval '24 hours'
			), 0) AS revenue_24h,
			COALESCE((
				SELECT COUNT(*)
				FROM registered_users ru
				WHERE ru.created_at >= now() - interval '24 hours'
			), 0) AS orders_24h,
			(SELECT MIN(dinner_date)::timestamptz FROM dinners WHERE expired = false AND dinner_date >= CURRENT_DATE) AS next_dinner_date,
			(SELECT MAX(dinner_date)::timestamptz FROM dinners) AS last_dinner_date
	`

	var nextDinner sql.NullTime
	var lastDinner sql.NullTime

	stats := TelegramDashboardStats{}
	if err := r.db.QueryRow(summaryQuery).Scan(
		&stats.TotalUsers,
		&stats.AcceptedTermsUsers,
		&stats.UsersWithPhone,
		&stats.UsersWithPayments,
		&stats.TotalDinners,
		&stats.ActiveDinners,
		&stats.RegistrationsTotal,
		&stats.ReferralsTotal,
		&stats.BlockedActive,
		&stats.RevenueTotal,
		&stats.Revenue24h,
		&stats.Orders24h,
		&nextDinner,
		&lastDinner,
	); err != nil {
		return TelegramDashboardStats{}, err
	}

	if nextDinner.Valid {
		t := nextDinner.Time
		stats.NextDinnerDate = &t
	}
	if lastDinner.Valid {
		t := lastDinner.Time
		stats.LastDinnerDate = &t
	}

	if stats.TotalUsers > 0 {
		stats.TermsAcceptancePct = (float64(stats.AcceptedTermsUsers) / float64(stats.TotalUsers)) * 100
		stats.PhoneCoveragePct = (float64(stats.UsersWithPhone) / float64(stats.TotalUsers)) * 100
		stats.ReferralCoveragePct = (float64(stats.ReferralsTotal) / float64(stats.TotalUsers)) * 100
		stats.BlockedRatePct = (float64(stats.BlockedActive) / float64(stats.TotalUsers)) * 100
	}
	if stats.RegistrationsTotal > 0 {
		stats.AvgOrderValue = stats.RevenueTotal / float64(stats.RegistrationsTotal)
	}

	const packageBreakdownQuery = `
		SELECT lower(menu), COUNT(*)
		FROM package_info
		GROUP BY lower(menu)
	`
	rows, err := r.db.Query(packageBreakdownQuery)
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var pkg sql.NullString
		var count int64
		if err := rows.Scan(&pkg, &count); err != nil {
			return TelegramDashboardStats{}, err
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
		return TelegramDashboardStats{}, err
	}

	dailyOrders, err := r.loadDailyOrders()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.DailyOrders = dailyOrders

	dailyUsers, err := r.loadDailyUsers()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.DailyNewUsers = dailyUsers

	registrationsByHour, err := r.loadRegistrationsByHour()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.RegistrationsByHour = registrationsByHour

	ordersByWeekday, err := r.loadOrdersByWeekday()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.OrdersByWeekday = ordersByWeekday

	revenueByPackage, err := r.loadRevenueByPackage()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.RevenueByPackage = revenueByPackage

	fillBands, err := r.loadDinnerFillBands()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.DinnerFillBands = fillBands

	topDinners, err := r.loadTopDinners()
	if err != nil {
		return TelegramDashboardStats{}, err
	}
	stats.TopDinners = topDinners

	return stats, nil
}

func (r *telegramStatsRepo) loadDailyOrders() ([]DailyRevenuePoint, error) {
	const query = `
		SELECT day::date, COALESCE(cnt, 0), COALESCE(revenue, 0)::float8
		FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') day
		LEFT JOIN (
			SELECT date(ru.created_at) AS d,
				COUNT(*) AS cnt,
				COALESCE(SUM(pi.price), 0) AS revenue
			FROM registered_users ru
			JOIN package_info pi ON pi.id = ru.package_info_id
			GROUP BY date(ru.created_at)
		) grouped ON grouped.d = day::date
		ORDER BY day::date
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := make([]DailyRevenuePoint, 0, 14)
	for rows.Next() {
		var day time.Time
		var orders int64
		var revenue float64
		if err := rows.Scan(&day, &orders, &revenue); err != nil {
			return nil, err
		}
		points = append(points, DailyRevenuePoint{
			Day:     day.Format("2006-01-02"),
			Orders:  orders,
			Revenue: revenue,
		})
	}
	return points, rows.Err()
}

func (r *telegramStatsRepo) loadDailyUsers() ([]DailyCountPoint, error) {
	const query = `
		SELECT day::date, COALESCE(cnt, 0)
		FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') day
		LEFT JOIN (
			SELECT date(created_at) AS d, COUNT(*) AS cnt
			FROM users
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

func (r *telegramStatsRepo) loadTopDinners() ([]DinnerFlowStat, error) {
	const query = `
		SELECT
			d.id,
			d.description,
			COALESCE(COUNT(ru.id), 0) AS registrations,
			COALESCE(d.places, 0) AS capacity
		FROM dinners d
		LEFT JOIN registered_users ru ON ru.dinner_id = d.id
		GROUP BY d.id, d.description, d.places
		ORDER BY registrations DESC, d.id DESC
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

func (r *telegramStatsRepo) loadRegistrationsByHour() ([]HourlyCountPoint, error) {
	const query = `
		SELECT hour_slot, COALESCE(cnt, 0)
		FROM generate_series(
			date_trunc('hour', now()) - interval '23 hours',
			date_trunc('hour', now()),
			interval '1 hour'
		) hour_slot
		LEFT JOIN (
			SELECT date_trunc('hour', created_at) AS h, COUNT(*) AS cnt
			FROM registered_users
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

func (r *telegramStatsRepo) loadOrdersByWeekday() ([]LabelCountPoint, error) {
	const query = `
		SELECT EXTRACT(ISODOW FROM created_at)::int AS dow, COUNT(*)
		FROM registered_users
		GROUP BY dow
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	weekdayMap := make(map[int]int64)
	for rows.Next() {
		var dow int
		var count int64
		if err := rows.Scan(&dow, &count); err != nil {
			return nil, err
		}
		weekdayMap[dow] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	labels := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	result := make([]LabelCountPoint, 0, 7)
	for i, label := range labels {
		result = append(result, LabelCountPoint{
			Label: label,
			Count: weekdayMap[i+1],
		})
	}
	return result, nil
}

func (r *telegramStatsRepo) loadRevenueByPackage() ([]LabelValuePoint, error) {
	const query = `
		SELECT lower(pi.menu) AS pkg, COALESCE(SUM(pi.price), 0)::float8 AS revenue
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		GROUP BY pkg
		ORDER BY revenue DESC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]LabelValuePoint, 0, 6)
	for rows.Next() {
		var label string
		var value float64
		if err := rows.Scan(&label, &value); err != nil {
			return nil, err
		}
		result = append(result, LabelValuePoint{
			Label: strings.ToUpper(label),
			Value: value,
		})
	}
	return result, rows.Err()
}

func (r *telegramStatsRepo) loadDinnerFillBands() ([]LabelCountPoint, error) {
	const query = `
		WITH dinner_load AS (
			SELECT
				d.id,
				COALESCE(d.places, 0) AS places,
				COALESCE(COUNT(ru.id), 0) AS regs
			FROM dinners d
			LEFT JOIN registered_users ru ON ru.dinner_id = d.id
			GROUP BY d.id, d.places
		)
		SELECT band, COUNT(*)
		FROM (
			SELECT CASE
				WHEN places <= 0 THEN 'Unknown'
				WHEN (regs::float8 / NULLIF(places, 0)) < 0.30 THEN 'Low <30%'
				WHEN (regs::float8 / NULLIF(places, 0)) < 0.70 THEN 'Mid 30-70%'
				WHEN (regs::float8 / NULLIF(places, 0)) <= 1.00 THEN 'High 70-100%'
				ELSE 'Overbooked'
			END AS band
			FROM dinner_load
		) bands
		GROUP BY band
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var band string
		var count int64
		if err := rows.Scan(&band, &count); err != nil {
			return nil, err
		}
		m[band] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	order := []string{"Low <30%", "Mid 30-70%", "High 70-100%", "Overbooked", "Unknown"}
	result := make([]LabelCountPoint, 0, len(order))
	for _, label := range order {
		result = append(result, LabelCountPoint{
			Label: label,
			Count: m[label],
		})
	}

	log.WithField("fillBands", fmt.Sprintf("%+v", result)).Debug("telegram dinner fill bands loaded")
	return result, nil
}
