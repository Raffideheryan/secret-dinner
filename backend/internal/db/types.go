package db

import (
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "db")

type Connections struct {
	Users         UsersDB
	AdminUsers    AdminUsersDB
	Dinners       DinnersDB
	LandingStats  LandingStatsDB
	TelegramStats TelegramStatsDB
}

type PackageBreakdown struct {
	Silver     int64 `json:"silver"`
	Gold       int64 `json:"gold"`
	VIP        int64 `json:"vip"`
	Custom     int64 `json:"custom"`
	Unselected int64 `json:"unselected"`
}

type DailyCountPoint struct {
	Day   string `json:"day"`
	Count int64  `json:"count"`
}

type HourlyCountPoint struct {
	Hour  string `json:"hour"`
	Count int64  `json:"count"`
}

type DailyRevenuePoint struct {
	Day     string  `json:"day"`
	Orders  int64   `json:"orders"`
	Revenue float64 `json:"revenue"`
}

type LabelCountPoint struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type LabelValuePoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type DinnerFlowStat struct {
	DinnerID      int64   `json:"dinnerId"`
	Description   string  `json:"description"`
	Registrations int64   `json:"registrations"`
	Capacity      int64   `json:"capacity"`
	FillPercent   float64 `json:"fillPercent"`
}

type LandingDashboardStats struct {
	TotalUsers          int64              `json:"totalUsers"`
	CompletedSelections int64              `json:"completedSelections"`
	PendingSelections   int64              `json:"pendingSelections"`
	SelectedDinners     int64              `json:"selectedDinners"`
	TotalGuests         int64              `json:"totalGuests"`
	AvgGuestsPerUser    float64            `json:"avgGuestsPerUser"`
	AvgSelectionHours   float64            `json:"avgSelectionHours"`
	SelectionP50Hours   float64            `json:"selectionP50Hours"`
	SelectionP90Hours   float64            `json:"selectionP90Hours"`
	ConversionPercent   float64            `json:"conversionPercent"`
	Recent24h           int64              `json:"recent24h"`
	RecentSelections24h int64              `json:"recentSelections24h"`
	ActiveDinners       int64              `json:"activeDinners"`
	PotentialRevenue    float64            `json:"potentialRevenue"`
	LatestApplicationAt *time.Time         `json:"latestApplicationAt"`
	PackageBreakdown    PackageBreakdown   `json:"packageBreakdown"`
	DailySubmissions    []DailyCountPoint  `json:"dailySubmissions"`
	DailySelections     []DailyCountPoint  `json:"dailySelections"`
	HourlySubmissions   []HourlyCountPoint `json:"hourlySubmissions"`
	WeekdaySubmissions  []LabelCountPoint  `json:"weekdaySubmissions"`
	WeekdaySelections   []LabelCountPoint  `json:"weekdaySelections"`
	GuestDistribution   []LabelCountPoint  `json:"guestDistribution"`
	SelectionLagBuckets []LabelCountPoint  `json:"selectionLagBuckets"`
	TopEmailDomains     []LabelCountPoint  `json:"topEmailDomains"`
	TopDinners          []DinnerFlowStat   `json:"topDinners"`
}

type TelegramDashboardStats struct {
	TotalUsers          int64               `json:"totalUsers"`
	AcceptedTermsUsers  int64               `json:"acceptedTermsUsers"`
	UsersWithPhone      int64               `json:"usersWithPhone"`
	UsersWithPayments   int64               `json:"usersWithPayments"`
	TotalDinners        int64               `json:"totalDinners"`
	ActiveDinners       int64               `json:"activeDinners"`
	RegistrationsTotal  int64               `json:"registrationsTotal"`
	ReferralsTotal      int64               `json:"referralsTotal"`
	BlockedActive       int64               `json:"blockedActive"`
	RevenueTotal        float64             `json:"revenueTotal"`
	TermsAcceptancePct  float64             `json:"termsAcceptancePct"`
	PhoneCoveragePct    float64             `json:"phoneCoveragePct"`
	ReferralCoveragePct float64             `json:"referralCoveragePct"`
	BlockedRatePct      float64             `json:"blockedRatePct"`
	Revenue24h          float64             `json:"revenue24h"`
	Orders24h           int64               `json:"orders24h"`
	AvgOrderValue       float64             `json:"avgOrderValue"`
	NextDinnerDate      *time.Time          `json:"nextDinnerDate"`
	LastDinnerDate      *time.Time          `json:"lastDinnerDate"`
	PackageBreakdown    PackageBreakdown    `json:"packageBreakdown"`
	DailyOrders         []DailyRevenuePoint `json:"dailyOrders"`
	DailyNewUsers       []DailyCountPoint   `json:"dailyNewUsers"`
	RegistrationsByHour []HourlyCountPoint  `json:"registrationsByHour"`
	OrdersByWeekday     []LabelCountPoint   `json:"ordersByWeekday"`
	RevenueByPackage    []LabelValuePoint   `json:"revenueByPackage"`
	DinnerFillBands     []LabelCountPoint   `json:"dinnerFillBands"`
	TopDinners          []DinnerFlowStat    `json:"topDinners"`
}

type Users struct {
	FullName   string `json:"fullName" db:"full_name"`
	Hobbies    string `json:"hobbies" db:"hobbies"`
	Allergies  string `json:"allergies" db:"allergies"`
	GuestCount int    `json:"guestCount" db:"guest_count"`
	Phone      string `json:"phone" db:"phone"`
	Email      string `json:"email" db:"email"`
}

type Dinners struct {
	ID                int64     `json:"id" db:"id"`
	Description       string    `json:"description" db:"description"`
	Places            int       `json:"places" db:"places"`
	AlreadyRegistered int       `json:"alreadyRegistered" db:"already_registered"`
	Location          string    `json:"location" db:"location"`
	DinnerDate        time.Time `json:"dinnerDate" db:"dinner_date"`
	SilverPrice       *float64  `json:"silverPrice" db:"silver_price"`
	GoldPrice         *float64  `json:"goldPrice" db:"gold_price"`
	VIPPrice          *float64  `json:"vipPrice" db:"vip_price"`
	Expired           bool      `json:"expired" db:"expired"`
	CreatedAt         time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
}

type DinnerMutation struct {
	Description string
	Places      int
	Location    string
	DinnerDate  time.Time
	SilverPrice *float64
	GoldPrice   *float64
	VIPPrice    *float64
	Expired     bool
}

type UserListParams struct {
	Search string
	Status string
	Limit  int
	Offset int
}

type LandingUserRecord struct {
	ID              string    `json:"id"`
	FullName        string    `json:"fullName"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	GuestCount      int       `json:"guestCount"`
	Hobbies         string    `json:"hobbies"`
	Allergies       string    `json:"allergies"`
	DinnerID        *int64    `json:"dinnerId,omitempty"`
	DinnerTitle     string    `json:"dinnerTitle"`
	ChosenPackage   *string   `json:"chosenPackage,omitempty"`
	SelectionStatus string    `json:"selectionStatus"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type LandingUsersSummary struct {
	Total     int64 `json:"total"`
	Completed int64 `json:"completed"`
	Open      int64 `json:"open"`
}

type TelegramUserRecord struct {
	ID               int64      `json:"id"`
	Username         string     `json:"username"`
	Name             string     `json:"name"`
	Surname          string     `json:"surname"`
	Phone            string     `json:"phone"`
	Language         string     `json:"language"`
	TermsAccepted    bool       `json:"termsAccepted"`
	TotalPayments    float64    `json:"totalPayments"`
	AttendanceCount  int        `json:"attendanceCount"`
	FriendsInvited   int        `json:"friendsInvited"`
	OrdersCount      int64      `json:"ordersCount"`
	BlockedActive    bool       `json:"blockedActive"`
	LastRegisteredAt *time.Time `json:"lastRegisteredAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type TelegramUsersSummary struct {
	Total         int64 `json:"total"`
	TermsAccepted int64 `json:"termsAccepted"`
	PayingUsers   int64 `json:"payingUsers"`
	BlockedActive int64 `json:"blockedActive"`
}

type AdminUsersDB interface {
	ListLandingUsers(params UserListParams) ([]LandingUserRecord, error)
	LandingUsersSummary() (LandingUsersSummary, error)
	UpdateLandingUserStatus(userID string, status string) error
	ListTelegramUsers(params UserListParams) ([]TelegramUserRecord, error)
	TelegramUsersSummary() (TelegramUsersSummary, error)
	Close() error
}
