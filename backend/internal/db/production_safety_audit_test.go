package db

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

func TestNewSyncMigrationsDoNotContainDestructiveUpStatements(t *testing.T) {
	t.Parallel()

	root := repoRootFromCaller(t)
	migrations := []string{
		filepath.Join(root, "secret-dinner", "backend", "internal", "db", "migrations", "20260710130000_telegram_booking_status_notifications.sql"),
		filepath.Join(root, "secret-dinner", "backend", "internal", "db", "migrations", "20260710150000_dinner_sync_outbox.sql"),
		filepath.Join(root, "secret-dinner", "backend", "internal", "db", "migrations", "20260710151000_telegram_dinners_sync_version.sql"),
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710090000_backfill_user_payment_totals.sql"),
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710130000_telegram_booking_status_notifications.sql"),
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710151000_telegram_dinners_sync_version.sql"),
	}

	for _, migrationPath := range migrations {
		upSQL := mustReadUpMigrationSQL(t, migrationPath)
		normalized := strings.ToUpper(strings.Join(strings.Fields(upSQL), " "))
		for _, forbidden := range []string{
			" TRUNCATE ",
			" DROP TABLE ",
			" DROP COLUMN ",
			" DELETE FROM ",
			" ALTER TABLE PACKAGE_INFO DROP CONSTRAINT ",
			" ALTER TABLE DINNERS DROP CONSTRAINT ",
			" ALTER TABLE LANDING_DINNERS DROP CONSTRAINT ",
		} {
			if strings.Contains(" "+normalized+" ", forbidden) {
				t.Fatalf("%s contains forbidden pattern %q in its Up migration", migrationPath, strings.TrimSpace(forbidden))
			}
		}
	}
}

func TestSyncMigrationsApplyOnRepresentativeExistingData(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("SYNC_AUDIT_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("SYNC_AUDIT_POSTGRES_DSN is not set")
	}

	root := repoRootFromCaller(t)
	schema := fmt.Sprintf("sync_audit_%d_%d", time.Now().UnixNano(), rand.Intn(1000))

	adminDB := openAuditDB(t, dsn)
	t.Cleanup(func() {
		_, _ = adminDB.Exec(`DROP SCHEMA IF EXISTS ` + pqQuoteIdentifier(schema) + ` CASCADE`)
		_ = adminDB.Close()
	})

	if _, err := adminDB.Exec(`CREATE SCHEMA ` + pqQuoteIdentifier(schema)); err != nil {
		t.Fatalf("CREATE SCHEMA: %v", err)
	}

	schemaDB := openAuditDB(t, withSearchPathDSN(t, dsn, schema))
	defer schemaDB.Close()

	for _, stmt := range []string{
		`CREATE TABLE users (id BIGINT PRIMARY KEY, total_payments NUMERIC(12,2) NOT NULL DEFAULT 0)`,
		`CREATE TABLE dinners (id BIGINT PRIMARY KEY, description TEXT NOT NULL, places INTEGER NOT NULL, already_registered INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL, dinner_date DATE NOT NULL, expired BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
		`CREATE TABLE package_info (id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, dinner_id BIGINT NOT NULL, status TEXT NOT NULL, price NUMERIC(12,2) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
		`CREATE TABLE registered_users (id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, dinner_id BIGINT NOT NULL, package_info_id BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
		`CREATE TABLE custom_package (id BIGINT PRIMARY KEY, user_id BIGINT NOT NULL, dinner_id BIGINT NOT NULL)`,
		`CREATE TABLE users_landing (id TEXT PRIMARY KEY, dinner_id BIGINT NULL, chosen_package TEXT NULL, guest_count INTEGER NOT NULL DEFAULT 0, selection_status TEXT NULL, admin_status TEXT NULL)`,
		`CREATE TABLE landing_dinners (id BIGINT PRIMARY KEY, description TEXT NOT NULL, places INTEGER NOT NULL, already_registered INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL, dinner_date DATE NOT NULL, expired BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
	} {
		if _, err := schemaDB.Exec(stmt); err != nil {
			t.Fatalf("baseline statement failed: %v", err)
		}
	}

	for _, stmt := range []string{
		`INSERT INTO users (id, total_payments) VALUES (1, 999.00), (2, 5.00)`,
		`INSERT INTO dinners (id, description, places, already_registered, location, dinner_date) VALUES (10, 'Telegram dinner', 12, 0, 'Yerevan', CURRENT_DATE)`,
		`INSERT INTO landing_dinners (id, description, places, already_registered, location, dinner_date) VALUES (10, 'Landing dinner', 12, 0, 'Yerevan', CURRENT_DATE)`,
		`INSERT INTO package_info (id, user_id, dinner_id, status, price) VALUES (100, 1, 10, 'paid', 25.00), (101, 1, 10, 'no_show', 5.00), (102, 2, 10, 'cancelled', 100.00)`,
		`INSERT INTO registered_users (id, user_id, dinner_id, package_info_id) VALUES (1000, 1, 10, 100), (1001, 1, 10, 101), (1002, 2, 10, 102)`,
	} {
		if _, err := schemaDB.Exec(stmt); err != nil {
			t.Fatalf("seed statement failed: %v", err)
		}
	}

	migrations := []string{
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710090000_backfill_user_payment_totals.sql"),
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710130000_telegram_booking_status_notifications.sql"),
		filepath.Join(root, "secret-dinner-bot", "internal", "repo", "db", "migrations", "20260710151000_telegram_dinners_sync_version.sql"),
		filepath.Join(root, "secret-dinner", "backend", "internal", "db", "migrations", "20260710150000_dinner_sync_outbox.sql"),
	}
	for _, migrationPath := range migrations {
		if _, err := schemaDB.Exec(mustReadUpMigrationSQL(t, migrationPath)); err != nil {
			t.Fatalf("applying %s failed: %v", filepath.Base(migrationPath), err)
		}
	}

	var totalPayments string
	if err := schemaDB.QueryRow(`SELECT total_payments::text FROM users WHERE id = 1`).Scan(&totalPayments); err != nil {
		t.Fatalf("query total_payments: %v", err)
	}
	if totalPayments != "30.00" {
		t.Fatalf("total_payments = %s, want 30.00", totalPayments)
	}

	var syncVersion int64
	if err := schemaDB.QueryRow(`SELECT sync_version FROM landing_dinners WHERE id = 10`).Scan(&syncVersion); err != nil {
		t.Fatalf("query landing sync_version: %v", err)
	}
	if syncVersion != 1 {
		t.Fatalf("landing sync_version = %d, want 1", syncVersion)
	}
	if err := schemaDB.QueryRow(`SELECT sync_version FROM dinners WHERE id = 10`).Scan(&syncVersion); err != nil {
		t.Fatalf("query telegram sync_version: %v", err)
	}
	if syncVersion != 0 {
		t.Fatalf("telegram sync_version = %d, want 0", syncVersion)
	}

	var notificationsTableExists bool
	if err := schemaDB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = current_schema()
			  AND table_name = 'telegram_booking_status_notifications'
		)
	`).Scan(&notificationsTableExists); err != nil {
		t.Fatalf("query notifications table existence: %v", err)
	}
	if !notificationsTableExists {
		t.Fatal("telegram_booking_status_notifications table was not created")
	}

	var outboxTableExists bool
	if err := schemaDB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = current_schema()
			  AND table_name = 'dinner_sync_outbox'
		)
	`).Scan(&outboxTableExists); err != nil {
		t.Fatalf("query outbox table existence: %v", err)
	}
	if !outboxTableExists {
		t.Fatal("dinner_sync_outbox table was not created")
	}
}

func TestDinnerSyncClaimSingleConsumer(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("SYNC_AUDIT_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("SYNC_AUDIT_POSTGRES_DSN is not set")
	}

	schema := fmt.Sprintf("sync_claim_%d_%d", time.Now().UnixNano(), rand.Intn(1000))
	adminDB := openAuditDB(t, dsn)
	t.Cleanup(func() {
		_, _ = adminDB.Exec(`DROP SCHEMA IF EXISTS ` + pqQuoteIdentifier(schema) + ` CASCADE`)
		_ = adminDB.Close()
	})
	if _, err := adminDB.Exec(`CREATE SCHEMA ` + pqQuoteIdentifier(schema)); err != nil {
		t.Fatalf("CREATE SCHEMA: %v", err)
	}

	schemaDSN := withSearchPathDSN(t, dsn, schema)
	setupDB := openAuditDB(t, schemaDSN)
	defer setupDB.Close()
	setupStatements := []string{
		`CREATE TABLE dinner_sync_outbox (
			id BIGSERIAL PRIMARY KEY,
			dinner_id BIGINT NOT NULL,
			operation TEXT NOT NULL,
			source_version BIGINT NOT NULL,
			source_updated_at TIMESTAMPTZ NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			attempt_count INTEGER NOT NULL DEFAULT 0,
			last_error TEXT NULL,
			next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			processing_started_at TIMESTAMPTZ NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			completed_at TIMESTAMPTZ NULL,
			CONSTRAINT dinner_sync_outbox_dinner_unique UNIQUE (dinner_id)
		)`,
		`INSERT INTO dinner_sync_outbox (dinner_id, operation, source_version, source_updated_at, status, next_retry_at) VALUES (55, 'upsert', 1, now(), 'pending', now())`,
	}
	for _, stmt := range setupStatements {
		if _, err := setupDB.Exec(stmt); err != nil {
			t.Fatalf("setup statement failed: %v", err)
		}
	}

	repoA := &dinnersRepo{landingDB: openAuditDB(t, schemaDSN)}
	defer repoA.landingDB.Close()
	repoB := &dinnersRepo{landingDB: openAuditDB(t, schemaDSN)}
	defer repoB.landingDB.Close()

	type claimResult struct {
		job dinnerSyncJob
		err error
	}
	results := make(chan claimResult, 2)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for _, repo := range []*dinnersRepo{repoA, repoB} {
		wg.Add(1)
		go func(r *dinnersRepo) {
			defer wg.Done()
			<-start
			job, err := r.claimDinnerSyncJob(nil)
			results <- claimResult{job: job, err: err}
		}(repo)
	}
	close(start)
	wg.Wait()
	close(results)

	claimed := 0
	noRows := 0
	for result := range results {
		switch {
		case result.err == nil && result.job.DinnerID == 55:
			claimed++
		case result.err != nil && strings.Contains(result.err.Error(), sql.ErrNoRows.Error()):
			noRows++
		case result.err == sql.ErrNoRows:
			noRows++
		default:
			t.Fatalf("unexpected claim result: job=%+v err=%v", result.job, result.err)
		}
	}
	if claimed != 1 || noRows != 1 {
		t.Fatalf("claimed=%d noRows=%d, want 1 and 1", claimed, noRows)
	}
}

func repoRootFromCaller(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", "..", ".."))
}

func mustReadUpMigrationSQL(t *testing.T, migrationPath string) string {
	t.Helper()
	raw, err := os.ReadFile(migrationPath)
	if err != nil {
		t.Fatalf("ReadFile(%s): %v", migrationPath, err)
	}
	var builder strings.Builder
	inUp := false
	for _, line := range strings.Split(string(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		switch trimmed {
		case "-- +goose Up":
			inUp = true
			continue
		case "-- +goose Down":
			inUp = false
		}
		if !inUp {
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose") {
			continue
		}
		builder.WriteString(line)
		builder.WriteString("\n")
	}
	return builder.String()
}

func openAuditDB(t *testing.T, dsn string) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		t.Fatalf("db.PingContext: %v", err)
	}
	return db
}

func withSearchPathDSN(t *testing.T, dsn string, schema string) string {
	t.Helper()
	if strings.Contains(dsn, "://") {
		parsed, err := url.Parse(dsn)
		if err != nil {
			t.Fatalf("url.Parse: %v", err)
		}
		query := parsed.Query()
		query.Set("options", "-csearch_path="+schema)
		parsed.RawQuery = query.Encode()
		return parsed.String()
	}
	return dsn + " options='-csearch_path=" + schema + "'"
}

func pqQuoteIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
