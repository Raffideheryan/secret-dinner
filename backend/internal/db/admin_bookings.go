package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type adminBookingsRepo struct {
	db *sql.DB
}

var ErrInvalidTelegramApplicationStatusTransition = errors.New("invalid telegram application status transition")
var ErrTelegramApplicationStaleUpdate = errors.New("telegram application was updated by another admin")
var ErrTelegramApplicationReasonRequired = errors.New("reason is required for risky status overrides")

// Strict transition map mirroring the frontend rules. Terminal states (rejected,
// cancelled, no_show) cannot be exited — only the same status is allowed.
// no_show is intentionally only reachable from paid, preventing the impossible
// state of a no-show on a booking that was never paid.
var allowedTelegramApplicationStatusTransitions = map[string][]string{
	"draft":               {"draft", "pending_application", "cancelled"},
	"pending_application": {"pending_application", "contacted", "approved", "rejected", "cancelled"},
	"contacted":           {"contacted", "approved", "rejected", "cancelled"},
	"approved":            {"approved", "waiting_payment", "cancelled"},
	"waiting_payment":     {"waiting_payment", "paid", "cancelled"},
	"paid":                {"paid", "no_show", "cancelled"},
	"rejected":            {"rejected"},
	"cancelled":           {"cancelled"},
	"no_show":             {"no_show"},
}

func NewAdminBookingsDB(db *sql.DB) AdminBookingsDB {
	return &adminBookingsRepo{db: db}
}

func (r *adminBookingsRepo) Close() error {
	return r.db.Close()
}

func (r *adminBookingsRepo) ListTelegramApplications(params UserListParams) ([]TelegramApplicationRecord, error) {
	limit := normalizeLimit(params.Limit, 50)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)
	status := strings.ToLower(strings.TrimSpace(params.Status))

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 3)

	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf(`(
			COALESCE(pi.public_code, '') ILIKE %s OR
			COALESCE(d.description, '') ILIKE %s OR
			COALESCE(u.username, '') ILIKE %s OR
			COALESCE(u.name, '') ILIKE %s OR
			COALESCE(u.surname, '') ILIKE %s OR
			COALESCE(u.phone, '') ILIKE %s OR
			COALESCE(pi.menu, '') ILIKE %s
		)`, placeholder, placeholder, placeholder, placeholder, placeholder, placeholder, placeholder))
	}

	validStatus := map[string]struct{}{
		"draft":               {},
		"pending_application": {},
		"contacted":           {},
		"approved":            {},
		"rejected":            {},
		"waiting_payment":     {},
		"paid":                {},
		"cancelled":           {},
		"no_show":             {},
	}
	if _, ok := validStatus[status]; ok {
		args = append(args, status)
		conditions = append(conditions, fmt.Sprintf("pi.status = $%d", len(args)))
	}

	query := `
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY ru.created_at DESC, pi.id DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]TelegramApplicationRecord, 0, limit)
	for rows.Next() {
		var item TelegramApplicationRecord
		var dinnerDate sql.NullTime
		if err := rows.Scan(
			&item.PackageInfoID,
			&item.PublicCode,
			&item.UserID,
			&item.Username,
			&item.Name,
			&item.Surname,
			&item.Phone,
			&item.Language,
			&item.DinnerID,
			&item.DinnerTitle,
			&dinnerDate,
			&item.StoredMenu,
			&item.Price,
			&item.Status,
			&item.AdminNote,
			&item.TablePreference,
			&item.TermsAccepted,
			&item.LegalVersion,
			&item.ReferralCode,
			&item.ReferralUsedCode,
			&item.Points,
			&item.Discount,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if dinnerDate.Valid {
			t := dinnerDate.Time
			item.DinnerDate = &t
		}
		item.PackageCode, item.PackageLabel, item.GuestCount = deriveApplicationPackageMeta(item.StoredMenu)
		item.Source = "telegram_bot"
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *adminBookingsRepo) TelegramApplicationsSummary() (TelegramApplicationsSummary, error) {
	// vipApplicationsCount, goldApplicationsCount, totalGuestCount, and
	// referralSourcedCount are computed across all applications (not just the
	// current page) so that Bookings KPI cards show global totals.
	const query = `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE pi.status = 'pending_application') AS pending_application,
			COUNT(*) FILTER (WHERE pi.status = 'approved') AS approved,
			COUNT(*) FILTER (WHERE pi.status = 'waiting_payment') AS waiting_payment,
			COUNT(*) FILTER (WHERE pi.status = 'paid') AS paid,
			COUNT(*) FILTER (WHERE pi.status = 'cancelled') AS cancelled,
			COUNT(*) FILTER (WHERE pi.status = 'rejected') AS rejected,
			COUNT(*) FILTER (WHERE pi.status = 'no_show') AS no_show,
			COUNT(*) FILTER (WHERE lower(pi.menu) LIKE '%vip%') AS vip_applications_count,
			COUNT(*) FILTER (WHERE lower(pi.menu) LIKE '%gold%' AND lower(pi.menu) NOT LIKE '%vip%') AS gold_applications_count,
			COALESCE(SUM(
				CASE
					WHEN lower(pi.menu) IN ('silver', 'gold', 'vip', 'custom_menu') THEN 1
					WHEN pi.menu = '' OR pi.menu IS NULL THEN 0
					ELSE (LENGTH(pi.menu) - LENGTH(REPLACE(pi.menu, ',', ''))) + 1
				END
			), 0) AS total_guest_count,
			COUNT(*) FILTER (WHERE rv.referal_code IS NOT NULL AND rv.referal_code <> '') AS referral_sourced_count
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		LEFT JOIN referals rv ON rv.user_id = ru.user_id
	`
	var summary TelegramApplicationsSummary
	if err := r.db.QueryRow(query).Scan(
		&summary.Total,
		&summary.PendingApplication,
		&summary.Approved,
		&summary.WaitingPayment,
		&summary.Paid,
		&summary.Cancelled,
		&summary.Rejected,
		&summary.NoShow,
		&summary.VIPApplicationsCount,
		&summary.GoldApplicationsCount,
		&summary.TotalGuestCount,
		&summary.ReferralSourcedCount,
	); err != nil {
		return TelegramApplicationsSummary{}, err
	}
	return summary, nil
}

func (r *adminBookingsRepo) GetTelegramApplication(packageInfoID int64) (TelegramApplicationRecord, error) {
	return r.getTelegramApplication(packageInfoID)
}

func (r *adminBookingsRepo) UpdateTelegramApplication(packageInfoID int64, status string, note string, expectedUpdatedAt time.Time) (TelegramApplicationRecord, TelegramApplicationRecord, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}
	defer tx.Rollback()

	var currentUpdatedAt time.Time
	var currentStatus string
	if err := tx.QueryRow(
		`SELECT COALESCE(status, ''), updated_at FROM package_info WHERE id = $1 FOR UPDATE`,
		packageInfoID,
	).Scan(&currentStatus, &currentUpdatedAt); err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}

	if !currentUpdatedAt.UTC().Equal(expectedUpdatedAt.UTC()) {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, fmt.Errorf(
			"%w: expected version %s but current version is %s; refresh and try again",
			ErrTelegramApplicationStaleUpdate,
			expectedUpdatedAt.UTC().Format(time.RFC3339Nano),
			currentUpdatedAt.UTC().Format(time.RFC3339Nano),
		)
	}

	before, err := r.getTelegramApplicationWithQuerier(tx, packageInfoID)
	if err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}

	if err := validateTelegramApplicationStatusTransition(before.Status, status); err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}

	const query = `
		UPDATE package_info
		SET status = $2,
			admin_note = BTRIM($3),
			updated_at = now()
		WHERE id = $1
	`
	result, err := tx.Exec(query, packageInfoID, status, note)
	if err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}
	if rowsAffected == 0 {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, sql.ErrNoRows
	}

	after, err := r.getTelegramApplicationWithQuerier(tx, packageInfoID)
	if err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return TelegramApplicationRecord{}, TelegramApplicationRecord{}, err
	}
	return before, after, nil
}

func validateTelegramApplicationStatusTransition(currentStatus, nextStatus string) error {
	current := strings.ToLower(strings.TrimSpace(currentStatus))
	next := strings.ToLower(strings.TrimSpace(nextStatus))

	if current == next {
		return nil
	}

	allowedNext, ok := allowedTelegramApplicationStatusTransitions[current]
	if !ok {
		return fmt.Errorf("%w: cannot move from %q to %q", ErrInvalidTelegramApplicationStatusTransition, current, next)
	}

	for _, candidate := range allowedNext {
		if candidate == next {
			return nil
		}
	}
	return fmt.Errorf(
		"%w: cannot move from %q to %q; allowed next statuses: %s",
		ErrInvalidTelegramApplicationStatusTransition,
		current,
		next,
		strings.Join(allowedNext, ", "),
	)
}

func (r *adminBookingsRepo) getTelegramApplication(packageInfoID int64) (TelegramApplicationRecord, error) {
	return r.getTelegramApplicationWithQuerier(r.db, packageInfoID)
}

type telegramApplicationQuerier interface {
	QueryRow(query string, args ...any) *sql.Row
}

func (r *adminBookingsRepo) getTelegramApplicationWithQuerier(q telegramApplicationQuerier, packageInfoID int64) (TelegramApplicationRecord, error) {
	const query = `
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			d.id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0)::float8,
			COALESCE(pi.status, ''),
			COALESCE(pi.admin_note, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			COALESCE(u.discount, 0),
			ru.created_at,
			pi.updated_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		JOIN users u ON u.id = ru.user_id
		JOIN dinners d ON d.id = ru.dinner_id
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE pi.id = $1
		LIMIT 1
	`
	var item TelegramApplicationRecord
	var dinnerDate sql.NullTime
	if err := q.QueryRow(query, packageInfoID).Scan(
		&item.PackageInfoID,
		&item.PublicCode,
		&item.UserID,
		&item.Username,
		&item.Name,
		&item.Surname,
		&item.Phone,
		&item.Language,
		&item.DinnerID,
		&item.DinnerTitle,
		&dinnerDate,
		&item.StoredMenu,
		&item.Price,
		&item.Status,
		&item.AdminNote,
		&item.TablePreference,
		&item.TermsAccepted,
		&item.LegalVersion,
		&item.ReferralCode,
		&item.ReferralUsedCode,
		&item.Points,
		&item.Discount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return TelegramApplicationRecord{}, err
	}
	if dinnerDate.Valid {
		t := dinnerDate.Time
		item.DinnerDate = &t
	}
	item.PackageCode, item.PackageLabel, item.GuestCount = deriveApplicationPackageMeta(item.StoredMenu)
	item.Source = "telegram_bot"
	return item, nil
}

func deriveApplicationPackageMeta(menu string) (string, string, int) {
	normalized := strings.ToLower(strings.TrimSpace(menu))
	switch normalized {
	case "silver":
		return "silver", "Silver", 1
	case "gold":
		return "gold", "Gold", 1
	case "vip":
		return "vip", "VIP", 1
	case "custom_menu":
		return "custom", "Custom", 1
	case "":
		return "open", "Open", 0
	}

	if strings.Contains(normalized, "guest_") {
		parts := strings.Split(normalized, ",")
		guestCount := 0
		bestCode := "silver"
		bestRank := 1
		for _, part := range parts {
			entry := strings.TrimSpace(part)
			if entry == "" {
				continue
			}
			guestCount++
			switch {
			case strings.Contains(entry, ":vip"):
				bestCode, bestRank = "vip", 3
			case strings.Contains(entry, ":gold") && bestRank < 2:
				bestCode, bestRank = "gold", 2
			case strings.Contains(entry, ":silver") && bestRank < 1:
				bestCode, bestRank = "silver", 1
			}
		}
		return bestCode, strings.ToUpper(bestCode[:1]) + bestCode[1:], guestCount
	}

	if strings.Contains(normalized, ",") {
		count := len(strings.Split(normalized, ","))
		return "custom", "Custom", count
	}

	return "custom", "Custom", 1
}
