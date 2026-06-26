package db

import (
	"database/sql"
	"errors"
	"sort"
)

const dinnerSeatLockNamespace int64 = 0x5344

var ErrDinnerSoldOut = errors.New("dinner is sold out")

func dinnerSeatLockKey(dinnerID int64) int64 {
	return (dinnerSeatLockNamespace << 32) | (dinnerID & 0xffffffff)
}

func lockDinnerSeatCapacityTx(tx *sql.Tx, dinnerIDs ...int64) error {
	if tx == nil {
		return errors.New("transaction is required")
	}
	keys := make([]int64, 0, len(dinnerIDs))
	seen := make(map[int64]struct{}, len(dinnerIDs))
	for _, dinnerID := range dinnerIDs {
		if dinnerID <= 0 {
			continue
		}
		if _, exists := seen[dinnerID]; exists {
			continue
		}
		seen[dinnerID] = struct{}{}
		keys = append(keys, dinnerID)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
	for _, dinnerID := range keys {
		if _, err := tx.Exec(`SELECT pg_advisory_xact_lock($1)`, dinnerSeatLockKey(dinnerID)); err != nil {
			return err
		}
	}
	return nil
}

func beginDinnerSeatLockTx(database *sql.DB, dinnerIDs ...int64) (*sql.Tx, error) {
	if database == nil {
		return nil, nil
	}
	tx, err := database.Begin()
	if err != nil {
		return nil, err
	}
	if err := lockDinnerSeatCapacityTx(tx, dinnerIDs...); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	return tx, nil
}
