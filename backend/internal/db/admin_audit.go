package db

import "database/sql"

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
		) VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), BTRIM($7))
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

func (r *adminAuditRepo) ListAdminAuditLogs(limit int) ([]AdminAuditLogRecord, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	const query = `
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
		ORDER BY created_at DESC, id DESC
		LIMIT $1
	`
	rows, err := r.db.Query(query, limit)
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
