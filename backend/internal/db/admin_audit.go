package db

import (
	"database/sql"
	"fmt"
	"strings"
)

type adminAuditRepo struct {
	db *sql.DB
}

func NewAdminAuditDB(db *sql.DB) AdminAuditDB {
	return &adminAuditRepo{db: db}
}

func (r *adminAuditRepo) Close() error {
	return nil
}

func (r *adminAuditRepo) InsertAdminAuditLog(entry AdminAuditLogEntry) error {
	const query = `
		INSERT INTO admin_audit_logs (
			admin_username,
			action_type,
			entity_type,
			entity_id,
			previous_value,
			new_value,
			reason
		) VALUES (
			$1,
			$2,
			$3,
			$4,
			CAST(NULLIF(BTRIM($5), '') AS JSONB),
			CAST(NULLIF(BTRIM($6), '') AS JSONB),
			BTRIM($7)
		)
	`
	_, err := r.db.Exec(
		query,
		entry.AdminUsername,
		entry.ActionType,
		entry.EntityType,
		entry.EntityID,
		entry.PreviousValue,
		entry.NewValue,
		entry.Reason,
	)
	return err
}

func (r *adminAuditRepo) ListAdminAuditLogs(params AdminAuditLogListParams) ([]AdminAuditLogRecord, error) {
	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	conditions := make([]string, 0, 5)
	args := make([]any, 0, 7)

	search := strings.TrimSpace(params.Search)
	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf(`(
			admin_username ILIKE %s OR
			action_type ILIKE %s OR
			entity_type ILIKE %s OR
			entity_id ILIKE %s OR
			COALESCE(reason, '') ILIKE %s OR
			COALESCE(previous_value::text, '') ILIKE %s OR
			COALESCE(new_value::text, '') ILIKE %s
		)`, placeholder, placeholder, placeholder, placeholder, placeholder, placeholder, placeholder))
	}

	if entityType := strings.TrimSpace(params.EntityType); entityType != "" {
		args = append(args, entityType)
		conditions = append(conditions, fmt.Sprintf("entity_type = $%d", len(args)))
	}
	if actionType := strings.TrimSpace(params.ActionType); actionType != "" {
		args = append(args, actionType)
		conditions = append(conditions, fmt.Sprintf("action_type = $%d", len(args)))
	}
	if adminUsername := strings.TrimSpace(params.AdminUsername); adminUsername != "" {
		args = append(args, adminUsername)
		conditions = append(conditions, fmt.Sprintf("admin_username = $%d", len(args)))
	}

	switch strings.TrimSpace(params.ReasonState) {
	case "with_reason":
		conditions = append(conditions, "NULLIF(BTRIM(COALESCE(reason, '')), '') IS NOT NULL")
	case "without_reason":
		conditions = append(conditions, "NULLIF(BTRIM(COALESCE(reason, '')), '') IS NULL")
	}

	query := `
		SELECT
			id,
			admin_username,
			action_type,
			entity_type,
			entity_id,
			COALESCE(previous_value::text, ''),
			COALESCE(new_value::text, ''),
			COALESCE(reason, ''),
			created_at
		FROM admin_audit_logs
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	args = append(args, limit, offset)
	query += fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]AdminAuditLogRecord, 0, limit)
	for rows.Next() {
		var item AdminAuditLogRecord
		if err := rows.Scan(
			&item.ID,
			&item.AdminUsername,
			&item.ActionType,
			&item.EntityType,
			&item.EntityID,
			&item.PreviousValue,
			&item.NewValue,
			&item.Reason,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}
