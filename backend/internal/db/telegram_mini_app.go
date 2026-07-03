package db

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	MiniAppPackageStatusPendingApplication = "pending_application"
	MiniAppPackageStatusContacted          = "contacted"
	MiniAppPackageStatusApproved           = "approved"
	MiniAppPackageStatusWaitingPayment     = "waiting_payment"
	MiniAppPackageStatusPaid               = "paid"
	MiniAppPackageStatusCancelled          = "cancelled"
	MiniAppPackageStatusRejected           = "rejected"
	miniAppCustomMenuMinimumAMD            = 18000
	miniAppCurrentLegalVersion             = "2026-06-05"
	miniAppMaxGuestCount                   = 12
	miniAppMaxProfileFieldLen              = 512
	miniAppMaxPhoneLen                     = 32
	miniAppApplicationCancelCutoff         = 60 * time.Hour
)

var ErrMiniAppActiveApplicationExists = errors.New("active application already exists for this dinner")
var ErrMiniAppLegalConsentRequired = errors.New("current legal consent is required before applying")
var ErrMiniAppApplicationUnavailable = errors.New("application not found")
var ErrMiniAppApplicationCancelBlocked = errors.New("application can no longer be cancelled")

type TelegramMiniAppDB interface {
	Close() error
	EnsureUser(identity TelegramMiniIdentity) error
	GetUserProfile(userID int64) (TelegramMiniAppUser, error)
	UpdateUserProfile(userID int64, input TelegramMiniProfileUpdate) (TelegramMiniAppUser, error)
	GetNextDinner() (*TelegramMiniAppDinner, error)
	ListApplicationsByUser(userID int64) ([]TelegramMiniAppApplication, error)
	CreateApplication(input TelegramMiniAppApplicationInput) (TelegramMiniAppApplication, error)
	CancelApplication(userID int64, packageInfoID int64) (TelegramMiniAppApplication, error)
	GetGameProgress(userID int64) (GameProgress, error)
	SaveGameProgress(userID int64, input GameProgressUpdate) (GameProgress, error)
	ConvertGamePoints(userID int64, gamePointsToSpend int) (GameProgress, error)
	ClaimLevelReward(userID int64, level, score int) (LevelRewardResult, error)
	GetGameLeaderboard(limit int) ([]GameLeaderboardEntry, error)
}

type GameLevelProgress struct {
	Level     int    `json:"level"`
	BestStars int    `json:"bestStars"`
	BestScore int    `json:"bestScore"`
	Completed bool   `json:"completed"`
	UpdatedAt string `json:"updatedAt"`
}

type GameRewardHistoryEntry struct {
	Level         int    `json:"level"`
	Stars         int    `json:"stars"`
	PointsAwarded int    `json:"pointsAwarded"`
	CreatedAt     string `json:"createdAt"`
}

type GameProgress struct {
	GamePoints     int                      `json:"gamePoints"`
	GameHighScore  int                      `json:"gameHighScore"`
	ConvertToday   int                      `json:"convertToday"`
	ConvertDate    string                   `json:"convertDate"` // "YYYY-MM-DD" or ""
	RealPoints     int                      `json:"realPoints"`  // user.points — Discount Points
	CurrentLevel   int                      `json:"currentLevel"`
	LastPlayedAt   string                   `json:"lastPlayedAt"` // RFC3339 or ""
	Levels         []GameLevelProgress      `json:"levels"`
	RewardHistory  []GameRewardHistoryEntry `json:"rewardHistory"`
}

type GameProgressUpdate struct {
	GamePoints    *int
	GameHighScore *int
	CurrentLevel  *int
}

// LevelRewardResult reports the outcome of a server-authoritative reward claim.
type LevelRewardResult struct {
	Stars    int          `json:"stars"`     // stars earned this session (0–3)
	BestStars int         `json:"bestStars"` // best stars ever on this level
	Awarded  int          `json:"awarded"`   // Game Points granted this claim (>= 0)
	Progress GameProgress `json:"progress"`
}

type GameLeaderboardEntry struct {
	UserID    int64  `json:"userId"`
	Name      string `json:"name"`
	HighScore int    `json:"highScore"`
}

var ErrGameConvertInvalid   = errors.New("invalid conversion amount")
var ErrGameConvertDailyLimit = errors.New("daily conversion limit exceeded")
var ErrGameConvertNotEnough = errors.New("not enough game points")
var ErrGameLevelInvalid     = errors.New("invalid level")
var ErrGameScoreInvalid     = errors.New("invalid score")

// gameLevelTargets mirrors the client TARGET_SCORES so the server can compute
// star ratings authoritatively (never trusting a client-sent star count).
var gameLevelTargets = []int{5000, 7500, 11000, 15000, 20000, 26000, 33000, 41000, 50000, 60000}

const gameMaxLevel = 10

// gameTargetForLevel returns the target score for a 1-based level.
func gameTargetForLevel(level int) (int, bool) {
	if level < 1 || level > len(gameLevelTargets) {
		return 0, false
	}
	return gameLevelTargets[level-1], true
}

// gameStarsForScore applies the star thresholds: 1★ ≥ target, 2★ ≥ target×1.35,
// 3★ ≥ target×1.75.
func gameStarsForScore(score, target int) int {
	if target <= 0 || score < target {
		return 0
	}
	switch {
	case score >= (target*175)/100:
		return 3
	case score >= (target*135)/100:
		return 2
	default:
		return 1
	}
}

// gameRewardForStars is the cumulative Game-Point reward for a star count.
func gameRewardForStars(stars int) int {
	switch stars {
	case 3:
		return 35
	case 2:
		return 20
	case 1:
		return 10
	default:
		return 0
	}
}

type TelegramMiniIdentity struct {
	UserID    int64
	Username  string
	FirstName string
	LastName  string
	Language  string
}

type TelegramMiniProfileUpdate struct {
	Phone     string
	Language  string
	Hobbies   string
	Allergies string
}

type TelegramMiniAppUser struct {
	ID               int64   `json:"id"`
	Username         string  `json:"username"`
	Name             string  `json:"name"`
	Surname          string  `json:"surname"`
	Phone            string  `json:"phone"`
	Language         string  `json:"language"`
	Hobbies          string  `json:"hobbies"`
	Allergies        string  `json:"allergies"`
	Points           int     `json:"points"`
	Discount         int     `json:"discount"`
	AttendanceCount  int     `json:"attendanceCount"`
	FriendsInvited   int     `json:"friendsInvited"`
	ReferralCode     string  `json:"referralCode"`
	ReferralUsedCode string  `json:"referralUsedCode"`
	TotalPayments    float64 `json:"totalPayments"`
	TermsAccepted    bool    `json:"termsAccepted"`
}

type TelegramMiniAppAvailability struct {
	OverallRemaining int  `json:"overallRemaining"`
	SilverRemaining  int  `json:"silverRemaining"`
	GoldRemaining    int  `json:"goldRemaining"`
	VIPRemaining     int  `json:"vipRemaining"`
	SilverLimited    bool `json:"silverLimited"`
	GoldLimited      bool `json:"goldLimited"`
	VIPLimited       bool `json:"vipLimited"`
}

type TelegramMiniAppDinner struct {
	ID                int64                       `json:"id"`
	Description       string                      `json:"description"`
	Places            int                         `json:"places"`
	AlreadyRegistered int                         `json:"alreadyRegistered"`
	DinnerDate        time.Time                   `json:"dinnerDate"`
	SilverSeats       int                         `json:"silverSeats"`
	GoldSeats         int                         `json:"goldSeats"`
	VIPSeats          int                         `json:"vipSeats"`
	SilverPrice       float64                     `json:"silverPrice"`
	GoldPrice         float64                     `json:"goldPrice"`
	VIPPrice          float64                     `json:"vipPrice"`
	Availability      TelegramMiniAppAvailability `json:"availability"`
}

type TelegramMiniAppApplication struct {
	PackageInfoID   int64     `json:"packageInfoId"`
	PublicCode      string    `json:"publicCode"`
	DinnerID        int64     `json:"dinnerId"`
	DinnerName      string    `json:"dinnerName"`
	DinnerDate      time.Time `json:"dinnerDate"`
	Menu            string    `json:"menu"`
	PackageType     string    `json:"packageType"`
	GuestCount      int       `json:"guestCount"`
	Price           float64   `json:"price"`
	Status          string    `json:"status"`
	TablePreference string    `json:"tablePreference"`
	AdminNote       string    `json:"adminNote"`
	CreatedAt       time.Time `json:"createdAt"`
}

type TelegramMiniAppApplicationInput struct {
	UserID          int64
	DinnerID        int64
	GuestCount      int
	GuestPackages   []string
	TablePreference string
	Hobbies         string
	Allergies       string
	Phone           string
	Language        string
	CustomMenuIDs   []int64
	AcceptLegalTerms bool
}

type telegramMiniAppRepo struct {
	telegramDB *sql.DB
	landingDB  *sql.DB
}

type miniAppQueryer interface {
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
}

func NewTelegramMiniAppDB(telegramDB, landingDB *sql.DB) TelegramMiniAppDB {
	return &telegramMiniAppRepo{
		telegramDB: telegramDB,
		landingDB:  landingDB,
	}
}

func (r *telegramMiniAppRepo) Close() error {
	return nil
}

func (r *telegramMiniAppRepo) EnsureUser(identity TelegramMiniIdentity) error {
	if identity.UserID <= 0 {
		return errors.New("invalid telegram user id")
	}
	referralCode := generateMiniAppReferralCode()
	username := nullTrimString(identity.Username)
	firstName := strings.TrimSpace(identity.FirstName)
	lastName := strings.TrimSpace(identity.LastName)
	language := normalizeMiniAppLanguage(identity.Language)

	const query = `
		INSERT INTO users (id, username, name, surname, referral_code, language, language_selected)
		VALUES ($1, $2, $3, $4, $5, $6, false)
		ON CONFLICT (id) DO UPDATE
		SET username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
			name = CASE
				WHEN NULLIF(BTRIM(EXCLUDED.name), '') IS NULL THEN users.name
				ELSE EXCLUDED.name
			END,
			surname = CASE
				WHEN NULLIF(BTRIM(EXCLUDED.surname), '') IS NULL THEN users.surname
				ELSE EXCLUDED.surname
			END,
			language = CASE
				WHEN NULLIF(BTRIM(EXCLUDED.language::text), '') IS NULL THEN users.language
				ELSE EXCLUDED.language
			END,
			updated_at = now()
	`
	_, err := r.telegramDB.Exec(query, identity.UserID, username, firstName, lastName, referralCode, language)
	return err
}

func (r *telegramMiniAppRepo) GetUserProfile(userID int64) (TelegramMiniAppUser, error) {
	const query = `
		SELECT
			id,
			COALESCE(username, ''),
			COALESCE(name, ''),
			COALESCE(surname, ''),
			COALESCE(phone, ''),
			COALESCE(language, 'english'),
			COALESCE(hobbies, ''),
			COALESCE(allergies, ''),
			COALESCE(points, 0),
			COALESCE(discount, 0),
			COALESCE(attendance_count, 0),
			COALESCE(friends_invited, 0),
			COALESCE(referral_code, ''),
			COALESCE((
				SELECT referal_code
				FROM referals
				WHERE user_id = users.id
				LIMIT 1
			), ''),
			COALESCE(total_payments, 0),
			COALESCE(terms_accepted, false)
		FROM users
		WHERE id = $1
	`
	var user TelegramMiniAppUser
	err := r.telegramDB.QueryRow(query, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Name,
		&user.Surname,
		&user.Phone,
		&user.Language,
		&user.Hobbies,
		&user.Allergies,
		&user.Points,
		&user.Discount,
		&user.AttendanceCount,
		&user.FriendsInvited,
		&user.ReferralCode,
		&user.ReferralUsedCode,
		&user.TotalPayments,
		&user.TermsAccepted,
	)
	return user, err
}

func (r *telegramMiniAppRepo) UpdateUserProfile(userID int64, input TelegramMiniProfileUpdate) (TelegramMiniAppUser, error) {
	input.Phone = strings.TrimSpace(input.Phone)
	input.Hobbies = strings.TrimSpace(input.Hobbies)
	input.Allergies = strings.TrimSpace(input.Allergies)
	if input.Phone != "" && len(input.Phone) > miniAppMaxPhoneLen {
		return TelegramMiniAppUser{}, fmt.Errorf("phone must be %d characters or fewer", miniAppMaxPhoneLen)
	}
	if len(input.Hobbies) > miniAppMaxProfileFieldLen {
		return TelegramMiniAppUser{}, fmt.Errorf("hobbies must be %d characters or fewer", miniAppMaxProfileFieldLen)
	}
	if len(input.Allergies) > miniAppMaxProfileFieldLen {
		return TelegramMiniAppUser{}, fmt.Errorf("allergies must be %d characters or fewer", miniAppMaxProfileFieldLen)
	}
	const query = `
		UPDATE users
		SET phone = NULLIF(BTRIM($2), ''),
			language = CASE
				WHEN NULLIF(BTRIM($3), '') IS NULL THEN language
				ELSE $3::user_language
			END,
			hobbies = NULLIF(BTRIM($4), ''),
			allergies = NULLIF(BTRIM($5), ''),
			updated_at = now()
		WHERE id = $1
	`
	if _, err := r.telegramDB.Exec(
		query,
		userID,
		input.Phone,
		normalizeMiniAppLanguage(input.Language),
		input.Hobbies,
		input.Allergies,
	); err != nil {
		return TelegramMiniAppUser{}, err
	}
	return r.GetUserProfile(userID)
}

func (r *telegramMiniAppRepo) GetNextDinner() (*TelegramMiniAppDinner, error) {
	const query = `
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price
		FROM dinners
		WHERE dinner_date >= CURRENT_DATE
		  AND expired = false
		ORDER BY dinner_date ASC, id ASC
		LIMIT 1
	`
	var dinner TelegramMiniAppDinner
	var ignoredLocation string
	var silverSeats, goldSeats, vipSeats sql.NullInt64
	var silverPrice, goldPrice, vipPrice sql.NullFloat64
	err := r.telegramDB.QueryRow(query).Scan(
		&dinner.ID,
		&dinner.Description,
		&dinner.Places,
		&dinner.AlreadyRegistered,
		&ignoredLocation,
		&dinner.DinnerDate,
		&silverSeats,
		&goldSeats,
		&vipSeats,
		&silverPrice,
		&goldPrice,
		&vipPrice,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if silverSeats.Valid {
		dinner.SilverSeats = int(silverSeats.Int64)
	}
	if goldSeats.Valid {
		dinner.GoldSeats = int(goldSeats.Int64)
	}
	if vipSeats.Valid {
		dinner.VIPSeats = int(vipSeats.Int64)
	}
	if silverPrice.Valid {
		dinner.SilverPrice = silverPrice.Float64
	}
	if goldPrice.Valid {
		dinner.GoldPrice = goldPrice.Float64
	}
	if vipPrice.Valid {
		dinner.VIPPrice = vipPrice.Float64
	}

	availability, err := r.getDinnerAvailability(dinner.ID, dinner.Places, dinner.SilverSeats, dinner.GoldSeats, dinner.VIPSeats)
	if err != nil {
		return nil, err
	}
	dinner.AlreadyRegistered = dinner.Places - availability.OverallRemaining
	if dinner.AlreadyRegistered < 0 {
		dinner.AlreadyRegistered = 0
	}
	dinner.Availability = availability
	return &dinner, nil
}

func (r *telegramMiniAppRepo) ListApplicationsByUser(userID int64) ([]TelegramMiniAppApplication, error) {
	const query = `
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			ru.dinner_id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0),
			COALESCE(pi.status, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(pi.admin_note, ''),
			ru.created_at
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		LEFT JOIN dinners d ON d.id = ru.dinner_id
		WHERE ru.user_id = $1
		ORDER BY ru.created_at DESC, pi.id DESC
	`
	rows, err := r.telegramDB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TelegramMiniAppApplication
	for rows.Next() {
		var item TelegramMiniAppApplication
		var dinnerDate sql.NullTime
		if err := rows.Scan(
			&item.PackageInfoID,
			&item.PublicCode,
			&item.DinnerID,
			&item.DinnerName,
			&dinnerDate,
			&item.Menu,
			&item.Price,
			&item.Status,
			&item.TablePreference,
			&item.AdminNote,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if dinnerDate.Valid {
			item.DinnerDate = dinnerDate.Time
		}
		item.GuestCount = countMiniAppSeatsFromMenu(item.Menu)
		item.PackageType = deriveMiniAppPrimaryPackage(item.Menu)
		if code, err := r.ensureApplicationPublicCode(item.PackageInfoID); err == nil {
			item.PublicCode = code
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *telegramMiniAppRepo) CreateApplication(input TelegramMiniAppApplicationInput) (TelegramMiniAppApplication, error) {
	input = normalizeMiniAppApplicationInput(input)
	if err := validateMiniAppApplicationInput(input); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	tx, err := r.telegramDB.BeginTx(context.Background(), nil)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()
	peerTx, err := beginDinnerSeatLockTx(r.landingDB, input.DinnerID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if peerTx != nil {
		defer func() {
			_ = peerTx.Rollback()
		}()
	}

	if err := updateMiniAppUserProfileTx(tx, input.UserID, TelegramMiniProfileUpdate{
		Phone:     input.Phone,
		Language:  input.Language,
		Hobbies:   input.Hobbies,
		Allergies: input.Allergies,
	}); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	if input.AcceptLegalTerms {
		if err := acceptCurrentLegalConsentTx(tx, input.UserID); err != nil {
			return TelegramMiniAppApplication{}, err
		}
	}

	hasConsent, err := r.hasCurrentLegalConsentTx(tx, input.UserID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if !hasConsent {
		return TelegramMiniAppApplication{}, ErrMiniAppLegalConsentRequired
	}

	// Every final seat write path uses the same dinner-scoped advisory lock
	// before re-checking combined Landing + Telegram occupancy.
	if err := lockDinnerSeatCapacityTx(tx, input.DinnerID); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	// Keep the row lock as a local guard for dinner edits inside the Telegram DB.
	dinner, err := r.getDinnerByIDForUpdate(tx, input.DinnerID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}

	exists, err := r.hasActiveApplicationForDinnerWithQuerier(tx, input.UserID, input.DinnerID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if exists {
		return TelegramMiniAppApplication{}, ErrMiniAppActiveApplicationExists
	}

	menu, packageType, price, err := r.prepareMiniAppReservation(tx, *dinner, input)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}

	pkgID, publicCode, err := r.saveApplicationTx(tx, input.UserID, dinner.ID, packageType, menu, price, input.TablePreference)
	if err != nil {
		if strings.Contains(err.Error(), "active application") {
			return TelegramMiniAppApplication{}, ErrMiniAppActiveApplicationExists
		}
		return TelegramMiniAppApplication{}, err
	}

	if err := r.syncDinnerRegistrationsTx(tx, dinner.ID); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	if err := tx.Commit(); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	if peerTx != nil {
		if err := r.syncLandingDinnerRegistrationsTx(peerTx, dinner.ID); err != nil {
			return TelegramMiniAppApplication{}, err
		}
		if err := peerTx.Commit(); err != nil {
			return TelegramMiniAppApplication{}, err
		}
	} else {
		if err := r.syncLandingDinnerRegistrations(dinner.ID); err != nil {
			return TelegramMiniAppApplication{}, err
		}
	}

	app, err := r.getApplicationByID(pkgID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	app.PublicCode = publicCode
	return app, nil
}

func normalizeMiniAppApplicationInput(input TelegramMiniAppApplicationInput) TelegramMiniAppApplicationInput {
	input.Phone = strings.TrimSpace(input.Phone)
	input.Hobbies = strings.TrimSpace(input.Hobbies)
	input.Allergies = strings.TrimSpace(input.Allergies)
	input.Language = normalizeMiniAppLanguage(input.Language)
	input.TablePreference = normalizeMiniAppTablePreference(input.TablePreference)
	for idx, pkg := range input.GuestPackages {
		input.GuestPackages[idx] = strings.ToLower(strings.TrimSpace(pkg))
	}
	return input
}

func validateMiniAppApplicationInput(input TelegramMiniAppApplicationInput) error {
	if input.UserID <= 0 {
		return errors.New("invalid user")
	}
	if input.DinnerID <= 0 {
		return errors.New("invalid dinner")
	}
	if input.Phone == "" {
		return errors.New("phone is required before applying")
	}
	if len(input.Phone) > miniAppMaxPhoneLen {
		return fmt.Errorf("phone must be %d characters or fewer", miniAppMaxPhoneLen)
	}
	if len(input.Hobbies) > miniAppMaxProfileFieldLen {
		return fmt.Errorf("hobbies must be %d characters or fewer", miniAppMaxProfileFieldLen)
	}
	if len(input.Allergies) > miniAppMaxProfileFieldLen {
		return fmt.Errorf("allergies must be %d characters or fewer", miniAppMaxProfileFieldLen)
	}
	if input.TablePreference != "" && input.TablePreference != "shared" && input.TablePreference != "private" {
		return errors.New("invalid table preference")
	}
	if len(input.CustomMenuIDs) > 0 {
		if input.GuestCount > 1 {
			return errors.New("custom menu is available only for one guest per application")
		}
		seen := make(map[int64]struct{}, len(input.CustomMenuIDs))
		for _, id := range input.CustomMenuIDs {
			if id <= 0 {
				return errors.New("custom menu item id is invalid")
			}
			if _, exists := seen[id]; exists {
				return errors.New("duplicate custom menu items are not allowed")
			}
			seen[id] = struct{}{}
		}
		return nil
	}
	if input.GuestCount <= 0 {
		return errors.New("guest count must be at least 1")
	}
	if input.GuestCount > miniAppMaxGuestCount {
		return fmt.Errorf("guest count must be %d or fewer", miniAppMaxGuestCount)
	}
	if len(input.GuestPackages) != input.GuestCount {
		return errors.New("one package must be selected for each guest")
	}
	for _, pkg := range input.GuestPackages {
		if pkg != "silver" && pkg != "gold" && pkg != "vip" {
			return fmt.Errorf("package %s is invalid", pkg)
		}
	}
	return nil
}

func updateMiniAppUserProfileTx(tx *sql.Tx, userID int64, input TelegramMiniProfileUpdate) error {
	const query = `
		UPDATE users
		SET phone = NULLIF(BTRIM($2), ''),
			language = CASE
				WHEN NULLIF(BTRIM($3), '') IS NULL THEN language
				ELSE $3::user_language
			END,
			hobbies = NULLIF(BTRIM($4), ''),
			allergies = NULLIF(BTRIM($5), ''),
			updated_at = now()
		WHERE id = $1
	`
	_, err := tx.Exec(
		query,
		userID,
		strings.TrimSpace(input.Phone),
		normalizeMiniAppLanguage(input.Language),
		strings.TrimSpace(input.Hobbies),
		strings.TrimSpace(input.Allergies),
	)
	return err
}

func (r *telegramMiniAppRepo) hasCurrentLegalConsentTx(tx *sql.Tx, userID int64) (bool, error) {
	const query = `
		SELECT
			COALESCE(terms_accepted, false),
			COALESCE(legal_version, '')
		FROM users
		WHERE id = $1
	`
	var accepted bool
	var version string
	if err := tx.QueryRow(query, userID).Scan(&accepted, &version); err != nil {
		return false, err
	}
	return accepted && strings.TrimSpace(version) >= miniAppCurrentLegalVersion, nil
}

func acceptCurrentLegalConsentTx(tx *sql.Tx, userID int64) error {
	const query = `
		UPDATE users
		SET terms_accepted = true,
			legal_version = $2,
			accepted_at = COALESCE(accepted_at, now()),
			updated_at = now()
		WHERE id = $1
	`
	_, err := tx.Exec(query, userID, miniAppCurrentLegalVersion)
	return err
}

func (r *telegramMiniAppRepo) prepareMiniAppReservation(tx *sql.Tx, dinner TelegramMiniAppDinner, input TelegramMiniAppApplicationInput) (string, string, float64, error) {
	if !dinner.DinnerDate.IsZero() && dinner.DinnerDate.Before(time.Now().Add(-1*time.Minute)) {
		return "", "", 0, errors.New("this dinner is no longer accepting applications")
	}
	if len(input.CustomMenuIDs) > 0 {
		menu, price, err := r.buildCustomMenuSelectionWithQuerier(tx, input.CustomMenuIDs, input.Language)
		if err != nil {
			return "", "", 0, err
		}
		if price < miniAppCustomMenuMinimumAMD {
			return "", "", 0, fmt.Errorf("custom menu minimum is %.0f AMD", float64(miniAppCustomMenuMinimumAMD))
		}
		return menu, "custom_menu", price, nil
	}

	availability, err := r.getDinnerAvailabilityWithQuerier(tx, dinner.ID, dinner.Places, dinner.SilverSeats, dinner.GoldSeats, dinner.VIPSeats)
	if err != nil {
		return "", "", 0, err
	}
	if availability.OverallRemaining < input.GuestCount {
		return "", "", 0, ErrDinnerSoldOut
	}

	selectedCounts := map[string]int{"silver": 0, "gold": 0, "vip": 0}
	price := 0.0
	for _, pkg := range input.GuestPackages {
		guestPrice, ok := miniAppPackagePriceFor(dinner, pkg)
		if !ok {
			return "", "", 0, fmt.Errorf("package %s is not offered for this dinner", pkg)
		}
		if !miniAppPackageHasRoom(pkg, availability, selectedCounts) {
			return "", "", 0, ErrDinnerSoldOut
		}
		selectedCounts[pkg]++
		price += guestPrice
	}

	if input.GuestCount == 1 {
		pkg := input.GuestPackages[0]
		return pkg, pkg, price, nil
	}

	packageType := derivePrimaryPackageFromGuests(input.GuestPackages)
	parts := make([]string, 0, len(input.GuestPackages))
	for idx, pkg := range input.GuestPackages {
		parts = append(parts, fmt.Sprintf("guest_%d:%s", idx+1, pkg))
	}
	return strings.Join(parts, ", "), packageType, price, nil
}

func (r *telegramMiniAppRepo) getDinnerByID(id int64) (*TelegramMiniAppDinner, error) {
	return r.getDinnerByIDWithQuerier(r.telegramDB, id, false)
}

func (r *telegramMiniAppRepo) getDinnerByIDForUpdate(tx *sql.Tx, id int64) (*TelegramMiniAppDinner, error) {
	return r.getDinnerByIDWithQuerier(tx, id, true)
}

func (r *telegramMiniAppRepo) getDinnerByIDWithQuerier(q miniAppQueryer, id int64, forUpdate bool) (*TelegramMiniAppDinner, error) {
	const query = `
		SELECT
			id,
			description,
			places,
			already_registered,
			location,
			dinner_date,
			silver_seats,
			gold_seats,
			vip_seats,
			silver_price,
			gold_price,
			vip_price
		FROM dinners
		WHERE id = $1
		  AND expired = false
	`
	suffix := ""
	if forUpdate {
		suffix = " FOR UPDATE"
	}
	var dinner TelegramMiniAppDinner
	var ignoredLocation string
	var silverSeats, goldSeats, vipSeats sql.NullInt64
	var silverPrice, goldPrice, vipPrice sql.NullFloat64
	err := q.QueryRow(query+suffix, id).Scan(
		&dinner.ID,
		&dinner.Description,
		&dinner.Places,
		&dinner.AlreadyRegistered,
		&ignoredLocation,
		&dinner.DinnerDate,
		&silverSeats,
		&goldSeats,
		&vipSeats,
		&silverPrice,
		&goldPrice,
		&vipPrice,
	)
	if err != nil {
		return nil, err
	}
	if silverSeats.Valid {
		dinner.SilverSeats = int(silverSeats.Int64)
	}
	if goldSeats.Valid {
		dinner.GoldSeats = int(goldSeats.Int64)
	}
	if vipSeats.Valid {
		dinner.VIPSeats = int(vipSeats.Int64)
	}
	if silverPrice.Valid {
		dinner.SilverPrice = silverPrice.Float64
	}
	if goldPrice.Valid {
		dinner.GoldPrice = goldPrice.Float64
	}
	if vipPrice.Valid {
		dinner.VIPPrice = vipPrice.Float64
	}
	return &dinner, nil
}

func (r *telegramMiniAppRepo) getDinnerAvailability(dinnerID int64, places, silverSeats, goldSeats, vipSeats int) (TelegramMiniAppAvailability, error) {
	return r.getDinnerAvailabilityWithQuerier(r.telegramDB, dinnerID, places, silverSeats, goldSeats, vipSeats)
}

func (r *telegramMiniAppRepo) getDinnerAvailabilityWithQuerier(q miniAppQueryer, dinnerID int64, places, silverSeats, goldSeats, vipSeats int) (TelegramMiniAppAvailability, error) {
	telegramOccupiedSeats, err := r.countTelegramOccupiedSeatsWithQuerier(q, dinnerID)
	if err != nil {
		return TelegramMiniAppAvailability{}, err
	}
	landingOccupiedSeats, err := r.countLandingOccupiedSeats(dinnerID)
	if err != nil {
		return TelegramMiniAppAvailability{}, err
	}
	telegramCounts, err := r.countTelegramPackageSeatsWithQuerier(q, dinnerID)
	if err != nil {
		return TelegramMiniAppAvailability{}, err
	}
	landingCounts, err := r.countLandingPackageSeats(dinnerID)
	if err != nil {
		return TelegramMiniAppAvailability{}, err
	}

	availability := TelegramMiniAppAvailability{
		OverallRemaining: places - telegramOccupiedSeats - landingOccupiedSeats,
		SilverRemaining:  silverSeats,
		GoldRemaining:    goldSeats,
		VIPRemaining:     vipSeats,
		SilverLimited:    silverSeats > 0,
		GoldLimited:      goldSeats > 0,
		VIPLimited:       vipSeats > 0,
	}
	if availability.OverallRemaining < 0 {
		availability.OverallRemaining = 0
	}
	if availability.SilverLimited {
		availability.SilverRemaining -= telegramCounts["silver"] + landingCounts["silver"]
		if availability.SilverRemaining < 0 {
			availability.SilverRemaining = 0
		}
	}
	if availability.GoldLimited {
		availability.GoldRemaining -= telegramCounts["gold"] + landingCounts["gold"]
		if availability.GoldRemaining < 0 {
			availability.GoldRemaining = 0
		}
	}
	if availability.VIPLimited {
		availability.VIPRemaining -= telegramCounts["vip"] + landingCounts["vip"]
		if availability.VIPRemaining < 0 {
			availability.VIPRemaining = 0
		}
	}
	return availability, nil
}

func (r *telegramMiniAppRepo) countTelegramOccupiedSeats(dinnerID int64) (int, error) {
	return r.countTelegramOccupiedSeatsWithQuerier(r.telegramDB, dinnerID)
}

func (r *telegramMiniAppRepo) countTelegramOccupiedSeatsWithQuerier(q miniAppQueryer, dinnerID int64) (int, error) {
	rows, err := q.Query(`
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
		var status string
		var menu string
		if err := rows.Scan(&status, &menu); err != nil {
			return 0, err
		}
		if !miniAppStatusCountsTowardCapacity(status) {
			continue
		}
		total += countMiniAppSeatsFromMenu(menu)
	}
	return total, rows.Err()
}

func (r *telegramMiniAppRepo) countLandingOccupiedSeats(dinnerID int64) (int, error) {
	if r.landingDB == nil {
		return 0, nil
	}
	var occupied sql.NullInt64
	err := r.landingDB.QueryRow(`
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

func (r *telegramMiniAppRepo) countLandingOccupiedSeatsTx(tx *sql.Tx, dinnerID int64) (int, error) {
	if tx == nil {
		return 0, nil
	}
	var occupied sql.NullInt64
	err := tx.QueryRow(`
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

func (r *telegramMiniAppRepo) countTelegramPackageSeats(dinnerID int64) (map[string]int, error) {
	return r.countTelegramPackageSeatsWithQuerier(r.telegramDB, dinnerID)
}

func (r *telegramMiniAppRepo) countTelegramPackageSeatsWithQuerier(q miniAppQueryer, dinnerID int64) (map[string]int, error) {
	counts := map[string]int{"silver": 0, "gold": 0, "vip": 0}
	rows, err := q.Query(`
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
		var status string
		var menu string
		if err := rows.Scan(&status, &menu); err != nil {
			return nil, err
		}
		if !miniAppStatusCountsTowardCapacity(status) {
			continue
		}
		addMiniAppPackageSeatCounts(counts, menu)
	}
	return counts, rows.Err()
}

func (r *telegramMiniAppRepo) countLandingPackageSeats(dinnerID int64) (map[string]int, error) {
	counts := map[string]int{"silver": 0, "gold": 0, "vip": 0}
	if r.landingDB == nil {
		return counts, nil
	}
	rows, err := r.landingDB.Query(`
		SELECT COALESCE(chosen_package, ''), COALESCE(guest_count, 0)
		FROM users_landing
		WHERE dinner_id = $1
		  AND chosen_package IS NOT NULL
		  AND guest_count > 0
		  AND COALESCE(selection_status, 'open') = 'completed'
		  AND COALESCE(admin_status, 'new') <> 'rejected'
	`, dinnerID)
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
		key := strings.ToLower(strings.TrimSpace(pkg))
		if key == "silver" || key == "gold" || key == "vip" {
			counts[key] += guests
		}
	}
	return counts, rows.Err()
}

func (r *telegramMiniAppRepo) hasActiveApplicationForDinner(userID, dinnerID int64) (bool, error) {
	return r.hasActiveApplicationForDinnerWithQuerier(r.telegramDB, userID, dinnerID)
}

func (r *telegramMiniAppRepo) hasActiveApplicationForDinnerWithQuerier(q miniAppQueryer, userID, dinnerID int64) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM package_info
			WHERE user_id = $1
			  AND dinner_id = $2
			  AND status IN ($3, $4, $5, $6, $7)
		)
	`
	var exists bool
	err := q.QueryRow(
		query,
		userID,
		dinnerID,
		MiniAppPackageStatusPendingApplication,
		MiniAppPackageStatusContacted,
		MiniAppPackageStatusApproved,
		MiniAppPackageStatusWaitingPayment,
		MiniAppPackageStatusPaid,
	).Scan(&exists)
	return exists, err
}

func (r *telegramMiniAppRepo) saveApplication(userID, dinnerID int64, packageType, menu string, price float64, tablePreference string) (int64, string, error) {
	return r.saveApplicationTx(r.telegramDB, userID, dinnerID, packageType, menu, price, tablePreference)
}

func (r *telegramMiniAppRepo) saveApplicationTx(q miniAppQueryer, userID, dinnerID int64, packageType, menu string, price float64, tablePreference string) (int64, string, error) {
	theme, err := r.lookupDinnerThemeWithQuerier(q, dinnerID)
	if err != nil {
		return 0, "", err
	}

	const query = `
		INSERT INTO package_info (user_id, dinner_id, menu, price, table_preference, status, public_code)
		VALUES ($1, $2, BTRIM($3), $4, BTRIM($5), $6, $7)
		RETURNING id
	`
	for attempts := 0; attempts < 12; attempts++ {
		publicCode, codeErr := generateMiniAppPublicCode(packageType, theme)
		if codeErr != nil {
			return 0, "", codeErr
		}
		var id int64
		if err := q.QueryRow(query, userID, dinnerID, menu, price, tablePreference, MiniAppPackageStatusPendingApplication, publicCode).Scan(&id); err != nil {
			if strings.Contains(err.Error(), "package_info_user_dinner_active_unique") {
				return 0, "", ErrMiniAppActiveApplicationExists
			}
			if isMiniAppPublicCodeCollisionError(err) {
				continue
			}
			return 0, "", err
		}
		if _, err := q.Exec(`
			INSERT INTO registered_users (user_id, dinner_id, package_info_id)
			VALUES ($1, $2, $3)
		`, userID, dinnerID, id); err != nil {
			return 0, "", err
		}
		return id, publicCode, nil
	}
	return 0, "", errors.New("failed to generate a unique secret key")
}

func (r *telegramMiniAppRepo) syncDinnerRegistrations(dinnerID int64) error {
	if err := r.syncDinnerRegistrationsTx(r.telegramDB, dinnerID); err != nil {
		return err
	}
	return r.syncLandingDinnerRegistrations(dinnerID)
}

func (r *telegramMiniAppRepo) syncDinnerRegistrationsTx(q miniAppQueryer, dinnerID int64) error {
	seats, err := r.countTelegramOccupiedSeatsWithQuerier(q, dinnerID)
	if err != nil {
		return err
	}
	landingSeats, err := r.countLandingOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	total := seats + landingSeats
	if _, err := q.Exec(`UPDATE dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
		return err
	}
	return nil
}

func (r *telegramMiniAppRepo) syncLandingDinnerRegistrations(dinnerID int64) error {
	if r.landingDB == nil {
		return nil
	}
	seats, err := r.countTelegramOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	landingSeats, err := r.countLandingOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	total := seats + landingSeats
	if _, err := r.landingDB.Exec(`UPDATE landing_dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
		return err
	}
	return nil
}

func (r *telegramMiniAppRepo) syncLandingDinnerRegistrationsTx(tx *sql.Tx, dinnerID int64) error {
	if tx == nil {
		return nil
	}
	seats, err := r.countTelegramOccupiedSeats(dinnerID)
	if err != nil {
		return err
	}
	landingSeats, err := r.countLandingOccupiedSeatsTx(tx, dinnerID)
	if err != nil {
		return err
	}
	total := seats + landingSeats
	if _, err := tx.Exec(`UPDATE landing_dinners SET already_registered = $2, updated_at = now() WHERE id = $1`, dinnerID, total); err != nil {
		return err
	}
	return nil
}

func (r *telegramMiniAppRepo) getApplicationByID(packageInfoID int64) (TelegramMiniAppApplication, error) {
	const query = `
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			ru.dinner_id,
			COALESCE(d.description, ''),
			d.dinner_date,
			COALESCE(pi.menu, ''),
			COALESCE(pi.price, 0),
			COALESCE(pi.status, ''),
			COALESCE(pi.table_preference, ''),
			COALESCE(pi.admin_note, ''),
			ru.created_at
		FROM package_info pi
		JOIN registered_users ru ON ru.package_info_id = pi.id
		LEFT JOIN dinners d ON d.id = ru.dinner_id
		WHERE pi.id = $1
		LIMIT 1
	`
	var item TelegramMiniAppApplication
	var dinnerDate sql.NullTime
	err := r.telegramDB.QueryRow(query, packageInfoID).Scan(
		&item.PackageInfoID,
		&item.PublicCode,
		&item.DinnerID,
		&item.DinnerName,
		&dinnerDate,
		&item.Menu,
		&item.Price,
		&item.Status,
		&item.TablePreference,
		&item.AdminNote,
		&item.CreatedAt,
	)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if dinnerDate.Valid {
		item.DinnerDate = dinnerDate.Time
	}
	item.GuestCount = countMiniAppSeatsFromMenu(item.Menu)
	item.PackageType = deriveMiniAppPrimaryPackage(item.Menu)
	return item, nil
}

func canMiniAppUserCancelApplication(item TelegramMiniAppApplication, now time.Time) bool {
	switch strings.ToLower(strings.TrimSpace(item.Status)) {
	case MiniAppPackageStatusPendingApplication, MiniAppPackageStatusContacted, MiniAppPackageStatusWaitingPayment:
	default:
		return false
	}
	if item.DinnerDate.IsZero() {
		return false
	}
	return item.DinnerDate.After(now.Add(miniAppApplicationCancelCutoff))
}

func (r *telegramMiniAppRepo) CancelApplication(userID int64, packageInfoID int64) (TelegramMiniAppApplication, error) {
	current, err := r.getApplicationByID(packageInfoID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TelegramMiniAppApplication{}, ErrMiniAppApplicationUnavailable
		}
		return TelegramMiniAppApplication{}, err
	}
	if current.PackageInfoID == 0 || current.DinnerID == 0 {
		return TelegramMiniAppApplication{}, ErrMiniAppApplicationUnavailable
	}

	var ownerID int64
	if err := r.telegramDB.QueryRow(`SELECT user_id FROM package_info WHERE id = $1`, packageInfoID).Scan(&ownerID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TelegramMiniAppApplication{}, ErrMiniAppApplicationUnavailable
		}
		return TelegramMiniAppApplication{}, err
	}
	if ownerID != userID {
		return TelegramMiniAppApplication{}, ErrMiniAppApplicationUnavailable
	}
	if !canMiniAppUserCancelApplication(current, time.Now()) {
		return TelegramMiniAppApplication{}, ErrMiniAppApplicationCancelBlocked
	}

	tx, err := r.telegramDB.BeginTx(context.Background(), nil)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	peerTx, err := beginDinnerSeatLockTx(r.landingDB, current.DinnerID)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if peerTx != nil {
		defer func() {
			_ = peerTx.Rollback()
		}()
	}

	if err := lockDinnerSeatCapacityTx(tx, current.DinnerID); err != nil {
		return TelegramMiniAppApplication{}, err
	}

	result, err := tx.Exec(`UPDATE package_info SET status = $2, updated_at = now() WHERE id = $1`, packageInfoID, MiniAppPackageStatusCancelled)
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if rowsAffected == 0 {
		return TelegramMiniAppApplication{}, ErrMiniAppApplicationUnavailable
	}

	if err := r.syncLandingDinnerRegistrationsTx(peerTx, current.DinnerID); err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if err := tx.Commit(); err != nil {
		return TelegramMiniAppApplication{}, err
	}
	if peerTx != nil {
		if err := peerTx.Commit(); err != nil {
			return TelegramMiniAppApplication{}, err
		}
	}

	return r.getApplicationByID(packageInfoID)
}

func (r *telegramMiniAppRepo) ensureApplicationPublicCode(packageInfoID int64) (string, error) {
	const loadQuery = `
		SELECT pi.public_code, pi.menu, COALESCE(d.description, '')
		FROM package_info pi
		LEFT JOIN dinners d ON d.id = pi.dinner_id
		WHERE pi.id = $1
	`
	var code, menu, dinnerDescription string
	if err := r.telegramDB.QueryRow(loadQuery, packageInfoID).Scan(&code, &menu, &dinnerDescription); err != nil {
		return "", err
	}
	if !isMiniAppLegacyPublicCode(code) {
		return code, nil
	}
	packageType := deriveMiniAppPrimaryPackage(menu)
	theme := inferMiniAppDinnerTheme(dinnerDescription)
	const updateQuery = `
		UPDATE package_info
		SET public_code = $2,
		    updated_at = now()
		WHERE id = $1
		RETURNING public_code
	`
	for attempts := 0; attempts < 12; attempts++ {
		nextCode, err := generateMiniAppPublicCode(packageType, theme)
		if err != nil {
			return "", err
		}
		if err := r.telegramDB.QueryRow(updateQuery, packageInfoID, nextCode).Scan(&code); err != nil {
			if isMiniAppPublicCodeCollisionError(err) {
				continue
			}
			return "", err
		}
		return code, nil
	}
	return "", errors.New("failed to refresh secret key")
}

func (r *telegramMiniAppRepo) lookupDinnerTheme(dinnerID int64) (*string, error) {
	return r.lookupDinnerThemeWithQuerier(r.telegramDB, dinnerID)
}

func (r *telegramMiniAppRepo) lookupDinnerThemeWithQuerier(q miniAppQueryer, dinnerID int64) (*string, error) {
	var description string
	if err := q.QueryRow(`SELECT COALESCE(description, '') FROM dinners WHERE id = $1`, dinnerID).Scan(&description); err != nil {
		return nil, err
	}
	return inferMiniAppDinnerTheme(description), nil
}

func (r *telegramMiniAppRepo) buildCustomMenuSelection(itemIDs []int64, language string) (string, float64, error) {
	return r.buildCustomMenuSelectionWithQuerier(r.telegramDB, itemIDs, language)
}

func (r *telegramMiniAppRepo) buildCustomMenuSelectionWithQuerier(q miniAppQueryer, itemIDs []int64, language string) (string, float64, error) {
	if len(itemIDs) == 0 {
		return "", 0, errors.New("custom menu items are required")
	}
	type menuItem struct {
		NameArm string
		NameRus string
		NameEng string
		Price   float64
	}
	var names []string
	total := 0.0
	for _, id := range itemIDs {
		var item menuItem
		err := q.QueryRow(`
			SELECT COALESCE(name_arm, ''), COALESCE(name_rus, ''), COALESCE(name_eng, ''), COALESCE(price, 0)
			FROM custom_menu
			WHERE id = $1
		`, id).Scan(&item.NameArm, &item.NameRus, &item.NameEng, &item.Price)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return "", 0, fmt.Errorf("custom menu item %d not found", id)
			}
			return "", 0, err
		}
		total += item.Price
		names = append(names, pickMiniAppDishName(language, item.NameEng, item.NameArm, item.NameRus))
	}
	return strings.Join(names, ", "), total, nil
}

func pickMiniAppDishName(language, eng, arm, rus string) string {
	switch normalizeMiniAppLanguage(language) {
	case "armenian":
		if strings.TrimSpace(arm) != "" {
			return strings.TrimSpace(arm)
		}
	case "russian":
		if strings.TrimSpace(rus) != "" {
			return strings.TrimSpace(rus)
		}
	}
	return strings.TrimSpace(eng)
}

func normalizeMiniAppLanguage(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "armenian", "russian", "english":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "english"
	}
}

func normalizeMiniAppTablePreference(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "shared", "private":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func nullTrimString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func miniAppPackagePriceFor(dinner TelegramMiniAppDinner, pkg string) (float64, bool) {
	switch strings.ToLower(strings.TrimSpace(pkg)) {
	case "silver":
		return dinner.SilverPrice, dinner.SilverPrice > 0
	case "gold":
		return dinner.GoldPrice, dinner.GoldPrice > 0
	case "vip":
		return dinner.VIPPrice, dinner.VIPPrice > 0
	default:
		return 0, false
	}
}

func miniAppPackageHasRoom(pkg string, availability TelegramMiniAppAvailability, selectedCounts map[string]int) bool {
	if availability.OverallRemaining <= 0 {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(pkg)) {
	case "silver":
		if !availability.SilverLimited {
			return true
		}
		return availability.SilverRemaining-selectedCounts["silver"] > 0
	case "gold":
		if !availability.GoldLimited {
			return true
		}
		return availability.GoldRemaining-selectedCounts["gold"] > 0
	case "vip":
		if !availability.VIPLimited {
			return true
		}
		return availability.VIPRemaining-selectedCounts["vip"] > 0
	default:
		return false
	}
}

func miniAppStatusCountsTowardCapacity(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case MiniAppPackageStatusPendingApplication,
		MiniAppPackageStatusContacted,
		MiniAppPackageStatusApproved,
		MiniAppPackageStatusWaitingPayment,
		MiniAppPackageStatusPaid:
		return true
	default:
		return false
	}
}

func countMiniAppSeatsFromMenu(menu string) int {
	normalized := strings.ToLower(strings.TrimSpace(menu))
	switch normalized {
	case "", "silver", "gold", "vip", "custom_menu":
		return 1
	}
	if strings.HasPrefix(normalized, "guest_") {
		count := 0
		for _, part := range strings.Split(normalized, ",") {
			entry := strings.TrimSpace(part)
			if strings.Contains(entry, ":silver") || strings.Contains(entry, ":gold") || strings.Contains(entry, ":vip") {
				count++
			}
		}
		if count > 0 {
			return count
		}
	}
	return 1
}

func addMiniAppPackageSeatCounts(counts map[string]int, menu string) {
	normalized := strings.ToLower(strings.TrimSpace(menu))
	switch normalized {
	case "silver", "gold", "vip":
		counts[normalized]++
		return
	}
	if strings.HasPrefix(normalized, "guest_") {
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
}

func derivePrimaryPackageFromGuests(packages []string) string {
	bestRank := 0
	bestPackage := "silver"
	rank := func(value string) int {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "silver":
			return 1
		case "gold":
			return 2
		case "vip":
			return 3
		default:
			return 0
		}
	}
	for _, pkg := range packages {
		if current := rank(pkg); current > bestRank {
			bestRank = current
			bestPackage = strings.ToLower(strings.TrimSpace(pkg))
		}
	}
	return bestPackage
}

func deriveMiniAppPrimaryPackage(menu string) string {
	normalized := strings.ToLower(strings.TrimSpace(menu))
	switch normalized {
	case "silver", "gold", "vip", "custom_menu":
		return normalized
	}
	if strings.HasPrefix(normalized, "guest_") {
		best := "silver"
		bestRank := 0
		for _, part := range strings.Split(normalized, ",") {
			entry := strings.TrimSpace(part)
			switch {
			case strings.Contains(entry, ":vip"):
				if bestRank < 3 {
					best = "vip"
					bestRank = 3
				}
			case strings.Contains(entry, ":gold"):
				if bestRank < 2 {
					best = "gold"
					bestRank = 2
				}
			case strings.Contains(entry, ":silver"):
				if bestRank < 1 {
					best = "silver"
					bestRank = 1
				}
			}
		}
		return best
	}
	return "custom_menu"
}

var miniAppLegacyPublicCodePattern = "SD-"

func isMiniAppLegacyPublicCode(code string) bool {
	return strings.HasPrefix(strings.TrimSpace(code), miniAppLegacyPublicCodePattern)
}

func isMiniAppPublicCodeCollisionError(err error) bool {
	if err == nil {
		return false
	}
	value := strings.ToLower(err.Error())
	return strings.Contains(value, "public_code") && strings.Contains(value, "duplicate")
}

var (
	miniAppThemePools = map[string][]string{
		"italian":    {"TUSCANY", "FLORENCE", "VENICE", "CAPRI", "AMALFI"},
		"wine":       {"MERLOT", "BAROLO", "CHIANTI", "RESERVE", "CUVEE"},
		"mystery":    {"ENIGMA", "PHANTOM", "SHADOW", "SECRET", "ECLIPSE"},
		"business":   {"FOUNDER", "VENTURE", "SUMMIT", "VISION", "CATALYST"},
		"couples":    {"ROMANCE", "AMOUR", "HARMONY", "EMBRACE", "FOREVER"},
		"masquerade": {"MASK", "VELVET", "NOIR", "OPERA", "REVELRY"},
	}
	miniAppPackagePools = map[string][]string{
		"silver": {"AURORA", "VELVET", "MIRAGE", "EMBER", "HORIZON"},
		"gold":   {"PRESTIGE", "LEGACY", "SIGNATURE", "PINNACLE", "APEX"},
		"vip":    {"IMPERIAL", "CROWN", "ROYAL", "DYNASTY", "SUPREME"},
	}
	miniAppFallbackPool = []string{"SECRET", "ECLIPSE", "AURORA", "LEGACY", "IMPERIAL"}
	miniAppAlphabet     = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

func generateMiniAppPublicCode(packageType string, theme *string) (string, error) {
	word, err := selectMiniAppCodeWord(packageType, theme)
	if err != nil {
		return "", err
	}
	suffix, err := randomMiniAppSuffix(4)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", word, suffix), nil
}

func selectMiniAppCodeWord(packageType string, theme *string) (string, error) {
	if themeKey := normalizeMiniAppThemeKey(theme); themeKey != "" {
		return randomMiniAppPoolEntry(miniAppThemePools[themeKey])
	}
	switch strings.ToLower(strings.TrimSpace(packageType)) {
	case "silver":
		return randomMiniAppPoolEntry(miniAppPackagePools["silver"])
	case "gold":
		return randomMiniAppPoolEntry(miniAppPackagePools["gold"])
	case "vip":
		return randomMiniAppPoolEntry(miniAppPackagePools["vip"])
	case "custom_menu":
		return randomMiniAppPoolEntry(miniAppFallbackPool)
	default:
		return "", fmt.Errorf("unknown package type: %s", packageType)
	}
}

func inferMiniAppDinnerTheme(description string) *string {
	value := strings.TrimSpace(description)
	if value == "" {
		return nil
	}
	if key := normalizeMiniAppThemeKey(&value); key != "" {
		theme := key
		return &theme
	}
	return nil
}

func normalizeMiniAppThemeKey(theme *string) string {
	if theme == nil {
		return ""
	}
	value := strings.ToLower(strings.TrimSpace(*theme))
	switch {
	case strings.Contains(value, "ital"):
		return "italian"
	case strings.Contains(value, "wine"), strings.Contains(value, "sommel"), strings.Contains(value, "cabernet"):
		return "wine"
	case strings.Contains(value, "myst"), strings.Contains(value, "secret"), strings.Contains(value, "shadow"):
		return "mystery"
	case strings.Contains(value, "business"), strings.Contains(value, "startup"), strings.Contains(value, "founder"), strings.Contains(value, "invest"):
		return "business"
	case strings.Contains(value, "couple"), strings.Contains(value, "romance"), strings.Contains(value, "love"), strings.Contains(value, "amour"):
		return "couples"
	case strings.Contains(value, "masquer"), strings.Contains(value, "mask"), strings.Contains(value, "venet"), strings.Contains(value, "opera"):
		return "masquerade"
	default:
		return ""
	}
}

func randomMiniAppPoolEntry(pool []string) (string, error) {
	if len(pool) == 0 {
		return "", errors.New("empty public code pool")
	}
	idx, err := cryptoMiniAppRandomInt(len(pool))
	if err != nil {
		return "", err
	}
	return pool[idx], nil
}

func randomMiniAppSuffix(length int) (string, error) {
	var builder strings.Builder
	builder.Grow(length)
	for i := 0; i < length; i++ {
		idx, err := cryptoMiniAppRandomInt(len(miniAppAlphabet))
		if err != nil {
			return "", err
		}
		builder.WriteByte(miniAppAlphabet[idx])
	}
	return builder.String(), nil
}

func cryptoMiniAppRandomInt(max int) (int, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}

func generateMiniAppReferralCode() string {
	id := uuid.New()
	return strings.ReplaceAll(id.String(), "-", "")[:10]
}

func buildTelegramInitDataSecret(botToken string) []byte {
	mac := hmac.New(sha256.New, []byte("WebAppData"))
	mac.Write([]byte(botToken))
	return mac.Sum(nil)
}

func signTelegramInitData(secret []byte, dataCheckString string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(dataCheckString))
	return hex.EncodeToString(mac.Sum(nil))
}

// ── Game progress ─────────────────────────────────────────────────────────────

func (r *telegramMiniAppRepo) GetGameProgress(userID int64) (GameProgress, error) {
	return r.getGameProgressWithQuerier(r.telegramDB, userID)
}

func (r *telegramMiniAppRepo) getGameProgressWithQuerier(q miniAppQueryer, userID int64) (GameProgress, error) {
	const query = `
		SELECT
			COALESCE(game_points, 0),
			COALESCE(game_high_score, 0),
			COALESCE(game_convert_today, 0),
			COALESCE(game_convert_date::text, ''),
			COALESCE(points, 0),
			COALESCE(game_current_level, 1),
			COALESCE(game_last_played_at::text, '')
		FROM users WHERE id = $1
	`
	var gp GameProgress
	if err := q.QueryRow(query, userID).Scan(
		&gp.GamePoints,
		&gp.GameHighScore,
		&gp.ConvertToday,
		&gp.ConvertDate,
		&gp.RealPoints,
		&gp.CurrentLevel,
		&gp.LastPlayedAt,
	); err != nil {
		return GameProgress{}, err
	}

	levels, err := r.loadLevelProgress(q, userID)
	if err != nil {
		return GameProgress{}, err
	}
	gp.Levels = levels

	history, err := r.loadRewardHistory(q, userID)
	if err != nil {
		return GameProgress{}, err
	}
	gp.RewardHistory = history

	return gp, nil
}

func (r *telegramMiniAppRepo) loadLevelProgress(q miniAppQueryer, userID int64) ([]GameLevelProgress, error) {
	rows, err := q.Query(`
		SELECT level, best_stars, best_score, completed, COALESCE(updated_at::text, '')
		FROM game_level_progress
		WHERE user_id = $1
		ORDER BY level ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	levels := make([]GameLevelProgress, 0)
	for rows.Next() {
		var lp GameLevelProgress
		if err := rows.Scan(&lp.Level, &lp.BestStars, &lp.BestScore, &lp.Completed, &lp.UpdatedAt); err != nil {
			return nil, err
		}
		levels = append(levels, lp)
	}
	return levels, rows.Err()
}

func (r *telegramMiniAppRepo) loadRewardHistory(q miniAppQueryer, userID int64) ([]GameRewardHistoryEntry, error) {
	rows, err := q.Query(`
		SELECT level, stars, points_awarded, COALESCE(created_at::text, '')
		FROM game_reward_history
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	history := make([]GameRewardHistoryEntry, 0)
	for rows.Next() {
		var e GameRewardHistoryEntry
		if err := rows.Scan(&e.Level, &e.Stars, &e.PointsAwarded, &e.CreatedAt); err != nil {
			return nil, err
		}
		history = append(history, e)
	}
	return history, rows.Err()
}

func (r *telegramMiniAppRepo) SaveGameProgress(userID int64, input GameProgressUpdate) (GameProgress, error) {
	// Clamp current level to the valid range if provided.
	if input.CurrentLevel != nil {
		lvl := *input.CurrentLevel
		if lvl < 1 {
			lvl = 1
		}
		if lvl > gameMaxLevel {
			lvl = gameMaxLevel
		}
		input.CurrentLevel = &lvl
	}
	const query = `
		UPDATE users SET
			game_points        = COALESCE($2, game_points),
			game_high_score    = GREATEST(COALESCE($3, game_high_score), COALESCE(game_high_score, 0)),
			game_current_level = GREATEST(COALESCE($4, game_current_level), COALESCE(game_current_level, 1)),
			game_last_played_at = now(),
			updated_at         = now()
		WHERE id = $1
	`
	_, err := r.telegramDB.Exec(query, userID, input.GamePoints, input.GameHighScore, input.CurrentLevel)
	if err != nil {
		return GameProgress{}, err
	}
	return r.GetGameProgress(userID)
}

// ClaimLevelReward is server-authoritative: the client sends only {level, score}
// and the server derives the star rating, computes the *incremental* Game-Point
// reward over the user's previous best for that level, caps it, and records the
// result. Replaying a level never re-awards points already earned; improving the
// star rating awards only the difference.
func (r *telegramMiniAppRepo) ClaimLevelReward(userID int64, level, score int) (LevelRewardResult, error) {
	target, ok := gameTargetForLevel(level)
	if !ok {
		return LevelRewardResult{}, ErrGameLevelInvalid
	}
	if score < 0 {
		return LevelRewardResult{}, ErrGameScoreInvalid
	}

	newStars := gameStarsForScore(score, target)

	tx, err := r.telegramDB.Begin()
	if err != nil {
		return LevelRewardResult{}, err
	}
	defer func() { _ = tx.Rollback() }()

	// Lock the per-level row (or note its absence) to serialise concurrent claims.
	var prevStars, prevScore int
	var hasRow bool
	err = tx.QueryRow(`
		SELECT best_stars, best_score FROM game_level_progress
		WHERE user_id = $1 AND level = $2 FOR UPDATE
	`, userID, level).Scan(&prevStars, &prevScore)
	switch {
	case err == nil:
		hasRow = true
	case errors.Is(err, sql.ErrNoRows):
		hasRow = false
	default:
		return LevelRewardResult{}, err
	}

	bestStars := prevStars
	if newStars > bestStars {
		bestStars = newStars
	}
	bestScore := prevScore
	if score > bestScore {
		bestScore = score
	}

	// Incremental reward: only the difference between the new and previously
	// earned star tiers, and never negative.
	awarded := gameRewardForStars(newStars) - gameRewardForStars(prevStars)
	if awarded < 0 {
		awarded = 0
	}

	// Upsert the per-level best.
	if hasRow {
		if _, err := tx.Exec(`
			UPDATE game_level_progress
			SET best_stars = $3, best_score = $4, completed = true, updated_at = now()
			WHERE user_id = $1 AND level = $2
		`, userID, level, bestStars, bestScore); err != nil {
			return LevelRewardResult{}, err
		}
	} else {
		if _, err := tx.Exec(`
			INSERT INTO game_level_progress (user_id, level, best_stars, best_score, completed, updated_at)
			VALUES ($1, $2, $3, $4, true, now())
		`, userID, level, bestStars, bestScore); err != nil {
			return LevelRewardResult{}, err
		}
	}

	// Credit the incremental reward + advance current level + record history.
	if awarded > 0 {
		if _, err := tx.Exec(`
			UPDATE users
			SET game_points = COALESCE(game_points, 0) + $2,
				game_last_played_at = now(),
				updated_at = now()
			WHERE id = $1
		`, userID, awarded); err != nil {
			return LevelRewardResult{}, err
		}
		if _, err := tx.Exec(`
			INSERT INTO game_reward_history (user_id, level, stars, points_awarded)
			VALUES ($1, $2, $3, $4)
		`, userID, level, newStars, awarded); err != nil {
			return LevelRewardResult{}, err
		}
	}

	// Advance the furthest-unlocked level when the player wins (stars >= 1).
	if newStars >= 1 && level < gameMaxLevel {
		if _, err := tx.Exec(`
			UPDATE users
			SET game_current_level = GREATEST(COALESCE(game_current_level, 1), $2),
				updated_at = now()
			WHERE id = $1
		`, userID, level+1); err != nil {
			return LevelRewardResult{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return LevelRewardResult{}, err
	}

	progress, err := r.GetGameProgress(userID)
	if err != nil {
		return LevelRewardResult{}, err
	}
	return LevelRewardResult{
		Stars:     newStars,
		BestStars: bestStars,
		Awarded:   awarded,
		Progress:  progress,
	}, nil
}

func (r *telegramMiniAppRepo) GetGameLeaderboard(limit int) ([]GameLeaderboardEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			id,
			BTRIM(COALESCE(name, '') || ' ' || COALESCE(surname, '')),
			COALESCE(username, ''),
			COALESCE(game_high_score, 0)
		FROM users
		WHERE COALESCE(game_high_score, 0) > 0
		ORDER BY game_high_score DESC, id ASC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]GameLeaderboardEntry, 0, limit)
	for rows.Next() {
		var e GameLeaderboardEntry
		var fullName, username string
		if err := rows.Scan(&e.UserID, &fullName, &username, &e.HighScore); err != nil {
			return nil, err
		}
		name := strings.TrimSpace(fullName)
		if name == "" {
			name = strings.TrimSpace(username)
		}
		if name == "" {
			name = "Player"
		}
		e.Name = name
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

const gameConvertPointsPerReal = 200
const gameConvertDailyLimit    = 1000

func (r *telegramMiniAppRepo) ConvertGamePoints(userID int64, gamePointsToSpend int) (GameProgress, error) {
	if gamePointsToSpend <= 0 || gamePointsToSpend%gameConvertPointsPerReal != 0 {
		return GameProgress{}, ErrGameConvertInvalid
	}
	realPointsGained := gamePointsToSpend / gameConvertPointsPerReal

	tx, err := r.telegramDB.Begin()
	if err != nil {
		return GameProgress{}, err
	}
	defer func() { _ = tx.Rollback() }()

	// Lock and read current state.
	const lockQuery = `
		SELECT
			COALESCE(game_points, 0),
			COALESCE(game_convert_today, 0),
			COALESCE(game_convert_date::text, '')
		FROM users WHERE id = $1 FOR UPDATE
	`
	var currentPoints, convertedToday int
	var convertDate string
	if err := tx.QueryRow(lockQuery, userID).Scan(&currentPoints, &convertedToday, &convertDate); err != nil {
		return GameProgress{}, err
	}

	// Reset daily counter if the stored date is not today.
	today := time.Now().UTC().Format("2006-01-02")
	if convertDate != today {
		convertedToday = 0
	}

	if convertedToday+gamePointsToSpend > gameConvertDailyLimit {
		return GameProgress{}, ErrGameConvertDailyLimit
	}
	if currentPoints < gamePointsToSpend {
		return GameProgress{}, ErrGameConvertNotEnough
	}

	const updateQuery = `
		UPDATE users SET
			game_points         = game_points - $2,
			points              = COALESCE(points, 0) + $3,
			game_convert_today  = $4,
			game_convert_date   = $5::date,
			updated_at          = now()
		WHERE id = $1
	`
	_, err = tx.Exec(updateQuery, userID, gamePointsToSpend, realPointsGained, convertedToday+gamePointsToSpend, today)
	if err != nil {
		return GameProgress{}, err
	}
	if err := tx.Commit(); err != nil {
		return GameProgress{}, err
	}
	return r.GetGameProgress(userID)
}
