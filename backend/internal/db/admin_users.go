package db

import (
	"database/sql"
	"fmt"
	"strings"
)

type adminUsersRepo struct {
	landingDB  *sql.DB
	telegramDB *sql.DB
}

func NewAdminUsersDB(landingDB, telegramDB *sql.DB) AdminUsersDB {
	return &adminUsersRepo{
		landingDB:  landingDB,
		telegramDB: telegramDB,
	}
}

func (r *adminUsersRepo) Close() error {
	// Uses shared DB connections managed by other repositories.
	return nil
}

func (r *adminUsersRepo) ListLandingUsers(params UserListParams) ([]LandingUserRecord, error) {
	if r.landingDB == nil {
		return nil, nil
	}

	limit := normalizeLimit(params.Limit, 50)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)
	status := strings.ToLower(strings.TrimSpace(params.Status))

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 3)

	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf("(ul.full_name ILIKE %s OR ul.email ILIKE %s OR ul.phone ILIKE %s)", placeholder, placeholder, placeholder))
	}

	switch status {
	case "completed":
		conditions = append(conditions, "COALESCE(ul.selection_status, 'open') = 'completed'")
	case "open":
		conditions = append(conditions, "COALESCE(ul.selection_status, 'open') = 'open'")
	}

	query := `
		SELECT
			ul.id::text,
			ul.full_name,
			ul.email,
			ul.phone,
			ul.guest_count,
			COALESCE(ul.hobbies, ''),
			COALESCE(ul.allergies, ''),
			ul.dinner_id,
			ul.chosen_package,
			COALESCE(ul.selection_status, CASE WHEN ul.dinner_id IS NOT NULL AND ul.chosen_package IS NOT NULL THEN 'completed' ELSE 'open' END),
			COALESCE(ld.description, ''),
			ul.created_at,
			ul.updated_at
		FROM users_landing ul
		LEFT JOIN landing_dinners ld ON ld.id = ul.dinner_id
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY ul.created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.landingDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]LandingUserRecord, 0, limit)
	for rows.Next() {
		var item LandingUserRecord
		var dinnerID sql.NullInt64
		var chosenPackage sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.FullName,
			&item.Email,
			&item.Phone,
			&item.GuestCount,
			&item.Hobbies,
			&item.Allergies,
			&dinnerID,
			&chosenPackage,
			&item.SelectionStatus,
			&item.DinnerTitle,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		if dinnerID.Valid {
			id := dinnerID.Int64
			item.DinnerID = &id
		}
		if chosenPackage.Valid && chosenPackage.String != "" {
			cp := chosenPackage.String
			item.ChosenPackage = &cp
		}

		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *adminUsersRepo) LandingUsersSummary() (LandingUsersSummary, error) {
	if r.landingDB == nil {
		return LandingUsersSummary{}, nil
	}
	const query = `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE COALESCE(selection_status, 'open') = 'completed') AS completed,
			COUNT(*) FILTER (WHERE COALESCE(selection_status, 'open') = 'open') AS open
		FROM users_landing
	`
	var summary LandingUsersSummary
	if err := r.landingDB.QueryRow(query).Scan(&summary.Total, &summary.Completed, &summary.Open); err != nil {
		return LandingUsersSummary{}, err
	}
	return summary, nil
}

func (r *adminUsersRepo) UpdateLandingUserStatus(userID string, status string) error {
	if r.landingDB == nil {
		return sql.ErrConnDone
	}

	const query = `
		UPDATE users_landing
		SET selection_status = $2, updated_at = now()
		WHERE id::text = $1
	`

	result, err := r.landingDB.Exec(query, userID, status)
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

func (r *adminUsersRepo) ListTelegramUsers(params UserListParams) ([]TelegramUserRecord, error) {
	if r.telegramDB == nil {
		return []TelegramUserRecord{}, nil
	}

	limit := normalizeLimit(params.Limit, 50)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)
	status := strings.ToLower(strings.TrimSpace(params.Status))

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 3)

	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf("(u.username ILIKE %s OR COALESCE(u.name, '') ILIKE %s OR COALESCE(u.surname, '') ILIKE %s OR COALESCE(u.phone, '') ILIKE %s)", placeholder, placeholder, placeholder, placeholder))
	}

	switch status {
	case "paying":
		conditions = append(conditions, "u.total_payments > 0")
	case "blocked":
		conditions = append(conditions, "EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.user_id = u.id AND (bu.unblock_date IS NULL OR bu.unblock_date > now()))")
	case "terms":
		conditions = append(conditions, "u.terms_accepted = true")
	}

	query := `
		SELECT
			u.id,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.total_payments, 0)::float8,
			COALESCE(u.attendance_count, 0),
			COALESCE(u.friends_invited, 0),
			u.created_at,
			u.updated_at,
			COALESCE(COUNT(ru.id), 0) AS orders_count,
			MAX(ru.created_at) AS last_registered_at,
			EXISTS (
				SELECT 1
				FROM blocked_users bu
				WHERE bu.user_id = u.id
					AND (bu.unblock_date IS NULL OR bu.unblock_date > now())
			) AS blocked_active
		FROM users u
		LEFT JOIN registered_users ru ON ru.user_id = u.id
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	args = append(args, limit, offset)
	query += fmt.Sprintf(`
		GROUP BY u.id, u.username, u.name, u.surname, u.phone, u.language, u.terms_accepted, u.total_payments, u.attendance_count, u.friends_invited, u.created_at, u.updated_at
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, len(args)-1, len(args))

	rows, err := r.telegramDB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]TelegramUserRecord, 0, limit)
	for rows.Next() {
		var item TelegramUserRecord
		var lastRegistered sql.NullTime
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.Name,
			&item.Surname,
			&item.Phone,
			&item.Language,
			&item.TermsAccepted,
			&item.TotalPayments,
			&item.AttendanceCount,
			&item.FriendsInvited,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.OrdersCount,
			&lastRegistered,
			&item.BlockedActive,
		); err != nil {
			return nil, err
		}
		if lastRegistered.Valid {
			t := lastRegistered.Time
			item.LastRegisteredAt = &t
		}
		result = append(result, item)
	}

	return result, rows.Err()
}

func (r *adminUsersRepo) TelegramUsersSummary() (TelegramUsersSummary, error) {
	if r.telegramDB == nil {
		return TelegramUsersSummary{}, nil
	}

	const query = `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE terms_accepted = true) AS terms_accepted,
			COUNT(*) FILTER (WHERE total_payments > 0) AS paying_users,
			COUNT(*) FILTER (
				WHERE EXISTS (
					SELECT 1
					FROM blocked_users bu
					WHERE bu.user_id = users.id
						AND (bu.unblock_date IS NULL OR bu.unblock_date > now())
				)
			) AS blocked_active
		FROM users
	`

	var summary TelegramUsersSummary
	if err := r.telegramDB.QueryRow(query).Scan(
		&summary.Total,
		&summary.TermsAccepted,
		&summary.PayingUsers,
		&summary.BlockedActive,
	); err != nil {
		return TelegramUsersSummary{}, err
	}

	return summary, nil
}

func normalizeLimit(limit, fallback int) int {
	if limit <= 0 {
		return fallback
	}
	if limit > 200 {
		return 200
	}
	return limit
}

func normalizeOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}
