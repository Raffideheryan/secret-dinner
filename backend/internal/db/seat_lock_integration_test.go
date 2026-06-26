package db

import (
	"database/sql"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

func TestDinnerSeatLockPreventsLandingMiniAppOversell(t *testing.T) {
	landingURL := os.Getenv("DATABASE_URL")
	telegramURL := os.Getenv("TELEGRAM_DATABASE_URL")
	if landingURL == "" || telegramURL == "" {
		t.Skip("DATABASE_URL and TELEGRAM_DATABASE_URL are required for integration test")
	}

	landingDB, err := sql.Open("postgres", landingURL)
	if err != nil {
		t.Fatalf("open landing db: %v", err)
	}
	defer landingDB.Close()

	telegramDB, err := sql.Open("postgres", telegramURL)
	if err != nil {
		t.Fatalf("open telegram db: %v", err)
	}
	defer telegramDB.Close()

	stamp := time.Now().UnixNano()
	landingUser := Users{
		FullName:   fmt.Sprintf("Seat Lock %d", stamp),
		Hobbies:    "food",
		Allergies:  "",
		GuestCount: 1,
		Phone:      "+37410000000",
		Email:      fmt.Sprintf("seat-lock-%d@example.com", stamp),
	}
	usersRepo := &usersRepo{db: landingDB, telegramDB: telegramDB}
	miniRepo := &telegramMiniAppRepo{telegramDB: telegramDB, landingDB: landingDB}

	var dinnerID int64
	if err := landingDB.QueryRow(`
		INSERT INTO landing_dinners (
			description, places, already_registered, location, dinner_date,
			silver_seats, gold_seats, vip_seats,
			silver_price, gold_price, vip_price, expired
		)
		VALUES ($1, 1, 0, $2, now() + interval '7 day', 1, NULL, NULL, 10000, NULL, NULL, false)
		RETURNING id
	`, fmt.Sprintf("Seat Lock Dinner %d", stamp), "Hidden").Scan(&dinnerID); err != nil {
		t.Fatalf("insert landing dinner: %v", err)
	}
	defer func() {
		_, _ = landingDB.Exec(`DELETE FROM users_landing WHERE email = $1`, landingUser.Email)
		_, _ = telegramDB.Exec(`DELETE FROM registered_users WHERE package_info_id IN (SELECT id FROM package_info WHERE user_id = $1)`, int64(800000000000+stamp%1000000))
		_, _ = telegramDB.Exec(`DELETE FROM package_info WHERE user_id = $1`, int64(800000000000+stamp%1000000))
		_, _ = telegramDB.Exec(`DELETE FROM users WHERE id = $1`, int64(800000000000+stamp%1000000))
		_, _ = telegramDB.Exec(`DELETE FROM dinners WHERE id = $1`, dinnerID)
		_, _ = landingDB.Exec(`DELETE FROM landing_dinners WHERE id = $1`, dinnerID)
	}()

	if _, err := telegramDB.Exec(`
		INSERT INTO dinners (
			id, description, places, already_registered, location, dinner_date,
			silver_seats, gold_seats, vip_seats,
			silver_price, gold_price, vip_price, expired
		)
		VALUES ($1, $2, 1, 0, $3, now() + interval '7 day', 1, NULL, NULL, 10000, NULL, NULL, false)
	`, dinnerID, fmt.Sprintf("Seat Lock Dinner %d", stamp), "Hidden"); err != nil {
		t.Fatalf("insert telegram dinner: %v", err)
	}

	landingUserID, err := usersRepo.Insert(landingUser)
	if err != nil {
		t.Fatalf("insert landing user: %v", err)
	}

	telegramUserID := int64(800000000000 + stamp%1000000)
	if err := miniRepo.EnsureUser(TelegramMiniIdentity{
		UserID:    telegramUserID,
		FirstName: "Seat",
		LastName:  "Lock",
		Language:  "english",
	}); err != nil {
		t.Fatalf("ensure telegram user: %v", err)
	}
	if _, err := telegramDB.Exec(`
		UPDATE users
		SET phone = '+37410000001',
			terms_accepted = true,
			legal_version = '2026-06-05',
			accepted_at = now()
		WHERE id = $1
	`, telegramUserID); err != nil {
		t.Fatalf("prepare telegram user: %v", err)
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(2)
	results := make(chan error, 2)

	go func() {
		defer wg.Done()
		<-start
		results <- usersRepo.UpdateSelection(landingUserID, dinnerID, "silver")
	}()

	go func() {
		defer wg.Done()
		<-start
		_, err := miniRepo.CreateApplication(TelegramMiniAppApplicationInput{
			UserID:        telegramUserID,
			DinnerID:      dinnerID,
			GuestCount:    1,
			GuestPackages: []string{"silver"},
			Phone:         "+37410000001",
			Language:      "english",
		})
		results <- err
	}()

	close(start)
	wg.Wait()
	close(results)

	var succeeded int
	var soldOut int
	for err := range results {
		switch {
		case err == nil:
			succeeded++
		case err == ErrDinnerSoldOut:
			soldOut++
		default:
			t.Fatalf("unexpected concurrent booking error: %v", err)
		}
	}
	if succeeded != 1 || soldOut != 1 {
		t.Fatalf("expected one success and one sold-out error, got success=%d soldOut=%d", succeeded, soldOut)
	}

	landingSeats, err := countLandingDinnerSeats(landingDB, []int64{dinnerID})
	if err != nil {
		t.Fatalf("count landing seats: %v", err)
	}
	telegramSeats, err := countTelegramDinnerSeats(telegramDB, []int64{dinnerID})
	if err != nil {
		t.Fatalf("count telegram seats: %v", err)
	}
	if total := landingSeats[dinnerID] + telegramSeats[dinnerID]; total != 1 {
		t.Fatalf("expected exactly 1 occupied seat after race, got %d", total)
	}
}
