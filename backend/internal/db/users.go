package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

type UsersDB interface {
	Insert(Users) (string, error)
	UpdateSelection(userID string, dinnerID int64, chosenPackage string) error
	Close() error
	CountLandingUsers() (int64, error)
}

type usersRepo struct {
	db         *sql.DB
	telegramDB *sql.DB
}

func NewUsersDB(db *sql.DB, telegramDB *sql.DB) UsersDB {
	return &usersRepo{db: db, telegramDB: telegramDB}
}

func (u *usersRepo) Insert(users Users) (string, error) {
	query := `INSERT INTO
			users_landing(full_name,hobbies,allergies,guest_count,phone,email)
			VALUES ($1,$2,$3,$4,$5,$6)
			RETURNING id`

	var userID string
	if err := u.db.QueryRow(query, users.FullName, users.Hobbies, users.Allergies, users.GuestCount, users.Phone, users.Email).Scan(&userID); err != nil {
		return "", err
	}
	log.Info("User inserted success.")
	return userID, nil
}

func (u *usersRepo) UpdateSelection(userID string, dinnerID int64, chosenPackage string) error {
	tx, err := u.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	current, err := u.loadLandingSelectionForUpdate(tx, userID)
	if err != nil {
		return err
	}

	lockIDs := []int64{dinnerID}
	if current.CountsTowardCapacity && current.DinnerID.Valid && current.DinnerID.Int64 > 0 {
		lockIDs = append(lockIDs, current.DinnerID.Int64)
	}
	if err := lockDinnerSeatCapacityTx(tx, lockIDs...); err != nil {
		return err
	}
	peerTx, err := beginDinnerSeatLockTx(u.telegramDB, lockIDs...)
	if err != nil {
		return err
	}
	if peerTx != nil {
		defer func() {
			_ = peerTx.Rollback()
		}()
	}

	dinner, err := u.loadLandingDinnerForUpdate(tx, dinnerID)
	if err != nil {
		return err
	}

	telegramOccupied, err := u.countTelegramOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	landingOccupied, err := u.countLandingOccupiedSeats(tx, dinnerID, userID)
	if err != nil {
		return err
	}
	if dinner.Places-(telegramOccupied+landingOccupied) < current.GuestCount {
		return ErrDinnerSoldOut
	}

	selectedPackages, err := normalizeLandingGuestPackages(chosenPackage, current.GuestCount)
	if err != nil {
		return err
	}
	telegramPackageCounts, err := u.countTelegramPackageSeats(dinnerID)
	if err != nil {
		return err
	}
	landingPackageCounts, err := u.countLandingPackageSeats(tx, dinnerID, userID)
	if err != nil {
		return err
	}
	for tier, count := range countLandingPackages(selectedPackages) {
		remaining := remainingLandingPackageSeats(dinner, tier, telegramPackageCounts, landingPackageCounts)
		if remaining < count {
			return ErrDinnerSoldOut
		}
	}

	result, err := tx.Exec(`
		UPDATE users_landing
		SET dinner_id = $2, chosen_package = $3, selection_status = 'completed', updated_at = now()
		WHERE id = $1
	`, userID, dinnerID, chosenPackage)
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

	if err := u.syncLandingDinnerRegistrationsTx(tx, dinnerID); err != nil {
		return err
	}
	if current.CountsTowardCapacity && current.DinnerID.Valid && current.DinnerID.Int64 > 0 && current.DinnerID.Int64 != dinnerID {
		if err := u.syncLandingDinnerRegistrationsTx(tx, current.DinnerID.Int64); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	if peerTx != nil {
		if err := u.syncTelegramDinnerRegistrationsTx(peerTx, dinnerID); err != nil {
			return err
		}
		if current.CountsTowardCapacity && current.DinnerID.Valid && current.DinnerID.Int64 > 0 && current.DinnerID.Int64 != dinnerID {
			if err := u.syncTelegramDinnerRegistrationsTx(peerTx, current.DinnerID.Int64); err != nil {
				return err
			}
		}
		return peerTx.Commit()
	}
	return nil
}

func (u *usersRepo) Close() error {
	return u.db.Close()
}

func (u *usersRepo) CountLandingUsers() (int64, error) {
	const query = `SELECT COUNT(*) FROM users_landing`
	var count int64
	if err := u.db.QueryRow(query).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

type landingSelectionRecord struct {
	GuestCount           int
	DinnerID             sql.NullInt64
	ChosenPackage        sql.NullString
	SelectionStatus      sql.NullString
	AdminStatus          sql.NullString
	CountsTowardCapacity bool
}

type landingDinnerCapacity struct {
	Places      int
	SilverSeats sql.NullInt64
	GoldSeats   sql.NullInt64
	VIPSeats    sql.NullInt64
}

func (u *usersRepo) loadLandingSelectionForUpdate(tx *sql.Tx, userID string) (landingSelectionRecord, error) {
	var row landingSelectionRecord
	err := tx.QueryRow(`
		SELECT
			COALESCE(guest_count, 0),
			dinner_id,
			chosen_package,
			COALESCE(selection_status, 'open'),
			COALESCE(admin_status, 'new')
		FROM users_landing
		WHERE id = $1
		FOR UPDATE
	`, userID).Scan(&row.GuestCount, &row.DinnerID, &row.ChosenPackage, &row.SelectionStatus, &row.AdminStatus)
	if err != nil {
		return landingSelectionRecord{}, err
	}
	row.CountsTowardCapacity = row.DinnerID.Valid &&
		row.DinnerID.Int64 > 0 &&
		row.ChosenPackage.Valid &&
		row.ChosenPackage.String != "" &&
		row.GuestCount > 0 &&
		row.SelectionStatus.String == "completed" &&
		row.AdminStatus.String != "rejected"
	return row, nil
}

func (u *usersRepo) loadLandingDinnerForUpdate(tx *sql.Tx, dinnerID int64) (landingDinnerCapacity, error) {
	var dinner landingDinnerCapacity
	err := tx.QueryRow(`
		SELECT
			places,
			silver_seats,
			gold_seats,
			vip_seats
		FROM landing_dinners
		WHERE id = $1
		  AND expired = false
		FOR UPDATE
	`, dinnerID).Scan(&dinner.Places, &dinner.SilverSeats, &dinner.GoldSeats, &dinner.VIPSeats)
	return dinner, err
}

func (u *usersRepo) countLandingOccupiedSeats(tx *sql.Tx, dinnerID int64, excludeUserID string) (int, error) {
	var occupied sql.NullInt64
	query := `
		SELECT COALESCE(SUM(guest_count), 0)
		FROM users_landing
		WHERE dinner_id = $1
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
	`
	args := []any{dinnerID}
	if strings.TrimSpace(excludeUserID) != "" {
		query += ` AND id <> $2`
		args = append(args, excludeUserID)
	}
	err := tx.QueryRow(query, args...).Scan(&occupied)
	if err != nil {
		return 0, err
	}
	if !occupied.Valid {
		return 0, nil
	}
	return int(occupied.Int64), nil
}

func (u *usersRepo) countLandingPackageSeats(tx *sql.Tx, dinnerID int64, excludeUserID string) (map[string]int, error) {
	counts := map[string]int{"silver": 0, "gold": 0, "vip": 0}
	query := `
		SELECT COALESCE(chosen_package, ''), COALESCE(guest_count, 0)
		FROM users_landing
		WHERE dinner_id = $1
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
	`
	args := []any{dinnerID}
	if strings.TrimSpace(excludeUserID) != "" {
		query += ` AND id <> $2`
		args = append(args, excludeUserID)
	}
	rows, err := tx.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var pkg string
		var guests int
		if err := rows.Scan(&pkg, &guests); err != nil {
			return nil, err
		}
		switch pkg {
		case "silver", "gold", "vip":
			counts[pkg] += guests
		default:
			addLandingPackageCountsFromTelegramMenu(counts, pkg)
		}
	}
	return counts, rows.Err()
}

func (u *usersRepo) countTelegramOccupiedSeats(dinnerID int64) (int, error) {
	if u.telegramDB == nil {
		return 0, nil
	}
	rows, err := u.telegramDB.Query(`
		SELECT COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = $1
	`, dinnerID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	total := 0
	for rows.Next() {
		var status, menu string
		if err := rows.Scan(&status, &menu); err != nil {
			return 0, err
		}
		bookings, seats := telegramCapacityUsage(status, menu)
		if bookings == 0 {
			continue
		}
		total += int(seats)
	}
	return total, rows.Err()
}

func (u *usersRepo) countTelegramPackageSeats(dinnerID int64) (map[string]int, error) {
	counts := map[string]int{"silver": 0, "gold": 0, "vip": 0}
	if u.telegramDB == nil {
		return counts, nil
	}
	rows, err := u.telegramDB.Query(`
		SELECT COALESCE(pi.status, ''), COALESCE(pi.menu, '')
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		WHERE ru.dinner_id = $1
	`, dinnerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status, menu string
		if err := rows.Scan(&status, &menu); err != nil {
			return nil, err
		}
		if !telegramStatusCountsTowardCapacity(status) {
			continue
		}
		addLandingPackageCountsFromTelegramMenu(counts, menu)
	}
	return counts, rows.Err()
}

func remainingLandingPackageSeats(dinner landingDinnerCapacity, chosenPackage string, telegramCounts, landingCounts map[string]int) int {
	switch chosenPackage {
	case "silver":
		if !dinner.SilverSeats.Valid || dinner.SilverSeats.Int64 <= 0 {
			return 1 << 30
		}
		return int(dinner.SilverSeats.Int64) - telegramCounts["silver"] - landingCounts["silver"]
	case "gold":
		if !dinner.GoldSeats.Valid || dinner.GoldSeats.Int64 <= 0 {
			return 1 << 30
		}
		return int(dinner.GoldSeats.Int64) - telegramCounts["gold"] - landingCounts["gold"]
	case "vip":
		if !dinner.VIPSeats.Valid || dinner.VIPSeats.Int64 <= 0 {
			return 1 << 30
		}
		return int(dinner.VIPSeats.Int64) - telegramCounts["vip"] - landingCounts["vip"]
	default:
		return 1 << 30
	}
}

func addLandingPackageCountsFromTelegramMenu(counts map[string]int, menu string) {
	normalized := strings.ToLower(strings.TrimSpace(menu))
	if normalized == "silver" || normalized == "gold" || normalized == "vip" {
		counts[normalized]++
		return
	}
	for _, part := range strings.Split(normalized, ",") {
		entry := strings.TrimSpace(part)
		switch {
		case strings.Contains(entry, ":silver"):
			counts["silver"]++
		case strings.Contains(entry, ":gold"):
			counts["gold"]++
		case strings.Contains(entry, ":vip"):
			counts["vip"]++
		}
	}
}

func normalizeLandingGuestPackages(chosenPackage string, guestCount int) ([]string, error) {
	normalized := strings.ToLower(strings.TrimSpace(chosenPackage))
	if guestCount <= 0 {
		return nil, errors.New("guest count must be greater than 0")
	}
	if normalized == "" {
		return nil, errors.New("chosen package is required")
	}

	switch normalized {
	case "silver", "gold", "vip", "custom":
		packages := make([]string, guestCount)
		for index := range packages {
			packages[index] = normalized
		}
		return packages, nil
	}

	parts := strings.Split(normalized, ",")
	packages := make([]string, 0, len(parts))
	for _, part := range parts {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		tokens := strings.SplitN(entry, ":", 2)
		if len(tokens) != 2 || !strings.HasPrefix(tokens[0], "guest_") {
			return nil, fmt.Errorf("invalid guest package format: %s", entry)
		}
		pkg := strings.TrimSpace(tokens[1])
		switch pkg {
		case "silver", "gold", "vip", "custom":
			packages = append(packages, pkg)
		default:
			return nil, fmt.Errorf("invalid guest package value: %s", pkg)
		}
	}
	if len(packages) != guestCount {
		return nil, fmt.Errorf("expected %d guest packages, got %d", guestCount, len(packages))
	}
	return packages, nil
}

func countLandingPackages(packages []string) map[string]int {
	counts := map[string]int{
		"silver": 0,
		"gold":   0,
		"vip":    0,
	}
	for _, pkg := range packages {
		switch pkg {
		case "silver", "gold", "vip":
			counts[pkg]++
		}
	}
	return counts
}

func (u *usersRepo) syncLandingDinnerRegistrationsTx(tx *sql.Tx, dinnerID int64) error {
	landingCount, err := u.countLandingOccupiedSeats(tx, dinnerID, "")
	if err != nil {
		return err
	}
	telegramCount, err := u.countTelegramOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	total := landingCount + telegramCount
	if _, err := tx.Exec(`UPDATE landing_dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
		return err
	}
	return nil
}

func (u *usersRepo) syncTelegramDinnerRegistrationsTx(tx *sql.Tx, dinnerID int64) error {
	if tx == nil {
		return nil
	}
	landingCount, err := u.countLandingOccupiedSeatsDB(dinnerID)
	if err != nil {
		return err
	}
	telegramCount, err := u.countTelegramOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	total := landingCount + telegramCount
	if _, err := tx.Exec(`UPDATE dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return nil
}

func (u *usersRepo) countLandingOccupiedSeatsDB(dinnerID int64) (int, error) {
	var occupied sql.NullInt64
	err := u.db.QueryRow(`
		SELECT COALESCE(SUM(guest_count), 0)
		FROM users_landing
		WHERE dinner_id = $1
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
	`, dinnerID).Scan(&occupied)
	if err != nil {
		return 0, err
	}
	if !occupied.Valid {
		return 0, nil
	}
	return int(occupied.Int64), nil
}
