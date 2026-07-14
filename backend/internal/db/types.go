package db

import (
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("package", "db")

type Connections struct {
	Users          UsersDB
	AdminUsers     AdminUsersDB
	AdminBookings  AdminBookingsDB
	AdminCampaigns AdminCampaignsDB
	AdminAudit     AdminAuditDB
	ActivityEvents ActivityEventsDB
	Dinners        DinnersDB
	LandingStats   LandingStatsDB
	TelegramStats  TelegramStatsDB
	CustomMenu     CustomMenuDB
	TelegramMini   TelegramMiniAppDB
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
	PaidBookingsCount   int64               `json:"paidBookingsCount"`
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
	ActiveBookings    int       `json:"activeBookings"`
	Location          string    `json:"location" db:"location"`
	DinnerDate        time.Time `json:"dinnerDate" db:"dinner_date"`
	SilverSeats       *int      `json:"silverSeats" db:"silver_seats"`
	GoldSeats         *int      `json:"goldSeats" db:"gold_seats"`
	VIPSeats          *int      `json:"vipSeats" db:"vip_seats"`
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
	SilverSeats *int
	GoldSeats   *int
	VIPSeats    *int
	SilverPrice *float64
	GoldPrice   *float64
	VIPPrice    *float64
	Expired     bool
}

type DinnerMirrorReconciliationReport struct {
	DryRun                 bool     `json:"dryRun"`
	InsertedMirrors        []int64  `json:"insertedMirrors"`
	UpdatedMirrors         []int64  `json:"updatedMirrors"`
	AlreadyConsistent      []int64  `json:"alreadyConsistent"`
	MissingAuthoritative   []int64  `json:"missingAuthoritative"`
	DeletedOrphanMirrors   []int64  `json:"deletedOrphanMirrors"`
	BlockedOrphanMirrors   []int64  `json:"blockedOrphanMirrors"`
	OccupancyRepaired      []int64  `json:"occupancyRepaired"`
	OccupancyMismatches    []int64  `json:"occupancyMismatches"`
	FailedOperations       []string `json:"failedOperations"`
	PendingJobsProcessed   int      `json:"pendingJobsProcessed"`
	PendingJobsRemaining   int      `json:"pendingJobsRemaining"`
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
	AdminStatus     string    `json:"adminStatus"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type LandingUsersSummary struct {
	Total     int64 `json:"total"`
	Completed int64 `json:"completed"`
	Open      int64 `json:"open"`
}

type TelegramUserRecord struct {
	ID                    int64      `json:"id"`
	Username              string     `json:"username"`
	Name                  string     `json:"name"`
	Surname               string     `json:"surname"`
	Phone                 string     `json:"phone"`
	Language              string     `json:"language"`
	TermsAccepted         bool       `json:"termsAccepted"`
	LegalVersion          string     `json:"legalVersion"`
	AcceptedLanguage      string     `json:"acceptedLanguage"`
	AcceptedAt            *time.Time `json:"acceptedAt,omitempty"`
	TotalPayments         float64    `json:"totalPayments"`
	AttendanceCount       int        `json:"attendanceCount"`
	FriendsInvited        int        `json:"friendsInvited"`
	ReferralCode          string     `json:"referralCode"`
	ReferralUsedCode      string     `json:"referralUsedCode"`
	Points                int        `json:"points"`
	Discount              int        `json:"discount"`
	OrdersCount           int64      `json:"ordersCount"`
	PaidBookingsCount     int64      `json:"paidBookingsCount"`
	NoShowCount           int64      `json:"noShowCount"`
	BlockedActive         bool       `json:"blockedActive"`
	LastRegisteredAt      *time.Time `json:"lastRegisteredAt,omitempty"`
	LastApplicationStatus string     `json:"lastApplicationStatus"`
	LastTablePreference   string     `json:"lastTablePreference"`
	CreatedAt             time.Time  `json:"createdAt"`
	UpdatedAt             time.Time  `json:"updatedAt"`
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
	UpdateLandingUserStatus(userID string, selectionStatus *string, adminStatus *string) (LandingUserRecord, error)
	ListTelegramUsers(params UserListParams) ([]TelegramUserRecord, error)
	TelegramUsersSummary() (TelegramUsersSummary, error)
	ListEngagementUsers(params EngagementUsersListParams) (EngagementUsersPage, error)
	GetEngagementUserProfile(source string, userID string) (EngagementUserProfile, error)
	ListEngagementUserEvents(source string, userID string, params EngagementUserEventsListParams) (EngagementUserEventsPage, error)
	AddUserTag(source, userKey, tag, createdBy string) error
	RemoveUserTag(source, userKey, tag string) error
	GetUserTags(source, userKey string) ([]EngagementUserTag, error)
	AddUserNote(source, userKey, noteText, createdBy string) (EngagementUserNote, error)
	DeleteUserNote(source, userKey string, noteID int64) error
	GetUserNotes(source, userKey string) ([]EngagementUserNote, error)
	GetSmartSegments() ([]SmartSegmentResult, error)
	GetAdminRecommendations() ([]AdminRecommendation, error)
	Close() error
}

type TelegramApplicationRecord struct {
	PackageInfoID       int64      `json:"packageInfoId"`
	PublicCode          string     `json:"publicCode"`
	UserID              int64      `json:"userId"`
	Username            string     `json:"username"`
	Name                string     `json:"name"`
	Surname             string     `json:"surname"`
	Phone               string     `json:"phone"`
	Language            string     `json:"language"`
	DinnerID            int64      `json:"dinnerId"`
	DinnerTitle         string     `json:"dinnerTitle"`
	DinnerDate          *time.Time `json:"dinnerDate,omitempty"`
	PackageCode         string     `json:"packageCode"`
	PackageLabel        string     `json:"packageLabel"`
	StoredMenu          string     `json:"storedMenu"`
	GuestCount          int        `json:"guestCount"`
	Price               float64    `json:"price"`
	Status              string     `json:"status"`
	AdminNote           string     `json:"adminNote"`
	TablePreference     string     `json:"tablePreference"`
	TermsAccepted       bool       `json:"termsAccepted"`
	LegalVersion        string     `json:"legalVersion"`
	ReferralCode        string     `json:"referralCode"`
	ReferralUsedCode    string     `json:"referralUsedCode"`
	Points              int        `json:"points"`
	Discount            int        `json:"discount"`
	Source              string     `json:"source"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`
	LastStatusChangedAt *time.Time `json:"lastStatusChangedAt,omitempty"`
}

type TelegramApplicationsSummary struct {
	Total                 int64 `json:"total"`
	PendingApplication    int64 `json:"pendingApplication"`
	Approved              int64 `json:"approved"`
	WaitingPayment        int64 `json:"waitingPayment"`
	Paid                  int64 `json:"paid"`
	Cancelled             int64 `json:"cancelled"`
	Rejected              int64 `json:"rejected"`
	NoShow                int64 `json:"noShow"`
	VIPApplicationsCount  int64 `json:"vipApplicationsCount"`
	GoldApplicationsCount int64 `json:"goldApplicationsCount"`
	TotalGuestCount       int64 `json:"totalGuestCount"`
	ReferralSourcedCount  int64 `json:"referralSourcedCount"`
}

type AdminBookingsDB interface {
	ListTelegramApplications(params UserListParams) ([]TelegramApplicationRecord, error)
	TelegramApplicationsSummary() (TelegramApplicationsSummary, error)
	GetTelegramApplication(packageInfoID int64) (TelegramApplicationRecord, error)
	UpdateTelegramApplication(packageInfoID int64, status string, note string, expectedUpdatedAt time.Time) (TelegramApplicationRecord, TelegramApplicationRecord, error)
	DispatchTelegramApplicationNotifications(packageInfoID int64, deliver func(TelegramBookingStatusNotification) error) error
	Close() error
}

type AdminAuditLogRecord struct {
	ID            int64     `json:"id"`
	AdminUsername string    `json:"adminUsername"`
	ActionType    string    `json:"actionType"`
	EntityType    string    `json:"entityType"`
	EntityID      string    `json:"entityId"`
	PreviousValue string    `json:"previousValue"`
	NewValue      string    `json:"newValue"`
	Reason        string    `json:"reason"`
	CreatedAt     time.Time `json:"createdAt"`
}

type AdminAuditLogEntry struct {
	AdminUsername string
	ActionType    string
	EntityType    string
	EntityID      string
	PreviousValue string
	NewValue      string
	Reason        string
}

type AdminAuditLogListParams struct {
	Limit         int
	Offset        int
	Search        string
	EntityType    string
	ActionType    string
	AdminUsername string
	ReasonState   string
}

type AdminAuditDB interface {
	InsertAdminAuditLog(entry AdminAuditLogEntry) error
	ListAdminAuditLogs(params AdminAuditLogListParams) ([]AdminAuditLogRecord, error)
	Close() error
}

type UserActivityEventInsert struct {
	Source             string
	EventName          string
	EventKey           string
	UserKey            string
	SessionKey         string
	EntityType         string
	EntityID           string
	PagePath           string
	Referrer           string
	UTMSource          string
	UTMMedium          string
	UTMCampaign        string
	UTMContent         string
	UTMTerm            string
	TelegramStartParam string
	Metadata           string
	Context            string
	OccurredAt         time.Time
}

type ActivityEventsDB interface {
	InsertUserActivityEvents(events []UserActivityEventInsert) (int64, error)
	GetEngagementAnalytics(params EngagementAnalyticsParams) (EngagementAnalytics, error)
	Close() error
}

type SmartSegmentUser struct {
	ID     string  `json:"id"`
	Source string  `json:"source"`
	Name   string  `json:"name"`
	Value  float64 `json:"value"`
}

type SmartSegmentResult struct {
	Key         string             `json:"key"`
	Label       string             `json:"label"`
	Description string             `json:"description"`
	Count       int64              `json:"count"`
	Users       []SmartSegmentUser `json:"users"`
}

type AdminRecommendation struct {
	Priority string `json:"priority"` // "high", "medium", "low"
	Type     string `json:"type"`     // "retention", "engagement", "growth", "revenue"
	Title    string `json:"title"`
	Message  string `json:"message"`
	Action   string `json:"action"`
	Count    int64  `json:"count"`
}

type EngagementUsersListParams struct {
	Source string
	Search string
	Limit  int
	Offset int
}

type EngagementUsersPage struct {
	Users  []EngagementUserListItem `json:"users"`
	Total  int64                    `json:"total"`
	Source string                   `json:"source"`
}

type EngagementUserEventsListParams struct {
	Limit  int
	Offset int
	Search string
}

type EngagementUserEventsPage struct {
	Events []EngagementUserActivityTimelineEvent `json:"events"`
	Total  int64                                 `json:"total"`
	Limit  int                                   `json:"limit"`
	Offset int                                   `json:"offset"`
	Search string                                `json:"search"`
}

type EngagementUserListItem struct {
	ID              string     `json:"id"`
	Source          string     `json:"source"`
	Name            string     `json:"name"`
	Username        string     `json:"username"`
	Phone           string     `json:"phone"`
	Status          string     `json:"status"`
	Applications    int64      `json:"applications"`
	PaidBookings    int64      `json:"paidBookings"`
	Payments        float64    `json:"payments"`
	Referrals       int64      `json:"referrals"`
	Points          int64      `json:"points"`
	AttendanceCount int64      `json:"attendanceCount"`
	LastActivityAt  *time.Time `json:"lastActivityAt,omitempty"`
	CreatedAt       *time.Time `json:"createdAt,omitempty"`
	EngagementScore int        `json:"engagementScore"`
	HealthScore     int        `json:"healthScore"`
}

type EngagementUserOverview struct {
	ID               string     `json:"id"`
	Source           string     `json:"source"`
	Name             string     `json:"name"`
	Username         string     `json:"username"`
	Phone            string     `json:"phone"`
	Status           string     `json:"status"`
	Applications     int64      `json:"applications"`
	PaidBookings     int64      `json:"paidBookings"`
	Payments         float64    `json:"payments"`
	Referrals        int64      `json:"referrals"`
	Points           int64      `json:"points"`
	AttendanceCount  int64      `json:"attendanceCount"`
	LastActivityAt   *time.Time `json:"lastActivityAt,omitempty"`
	FirstSeenAt      *time.Time `json:"firstSeenAt,omitempty"`
	CreatedAt        *time.Time `json:"createdAt,omitempty"`
	TermsAccepted    bool       `json:"termsAccepted"`
	Language         string     `json:"language"`
	LegalVersion     string     `json:"legalVersion"`
	EngagementScore  int        `json:"engagementScore"`
	HealthScore      int        `json:"healthScore"`
	LoyaltyScore     int        `json:"loyaltyScore"`
	ReferralScore    int        `json:"referralScore"`
	EngagementLabel  string     `json:"engagementLabel"`
	EngagementReason string     `json:"engagementReason"`
}

type EngagementUserActivityTimelineEvent struct {
	Key         string `json:"key"`
	OccurredAt  string `json:"occurredAt"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Tone        string `json:"tone"`
}

type EngagementUserBehavioralAnalytics struct {
	TotalEvents       int64   `json:"totalEvents"`
	ActiveDays        int64   `json:"activeDays"`
	DinnerViews       int64   `json:"dinnerViews"`
	PackageSelections int64   `json:"packageSelections"`
	ButtonClicks      int64   `json:"buttonClicks"`
	ErrorEvents       int64   `json:"errorEvents"`
	ApplicationStarts int64   `json:"applicationStarts"`
	ApplicationsSent  int64   `json:"applicationsSent"`
	FirstSeenAt       string  `json:"firstSeenAt"`
	LastSeenAt        string  `json:"lastSeenAt"`
	PeakHour          string  `json:"peakHour"`
	PeakHourEvents    int64   `json:"peakHourEvents"`
	TopDinner         string  `json:"topDinner"`
	TopPackage        string  `json:"topPackage"`
	ConversionStage   string  `json:"conversionStage"`
	CompletionRate    float64 `json:"completionRate"`
}

type EngagementUserReferralAnalytics struct {
	ReferralCode      string `json:"referralCode"`
	UsedReferralCode  string `json:"usedReferralCode"`
	InvitedUsers      int64  `json:"invitedUsers"`
	ReferralEvents    int64  `json:"referralEvents"`
	ReferralClicks    int64  `json:"referralClicks"`
	ReferralSuccesses int64  `json:"referralSuccesses"`
	Tracked           bool   `json:"tracked"`
}

type EngagementUserRevenueAnalytics struct {
	TotalPayments     float64 `json:"totalPayments"`
	PaidBookings      int64   `json:"paidBookings"`
	AverageBooking    float64 `json:"averageBooking"`
	CancelledBookings int64   `json:"cancelledBookings"`
	LatestPaymentAt   string  `json:"latestPaymentAt"`
	Tracked           bool    `json:"tracked"`
}

type EngagementUserAttendanceAnalytics struct {
	AttendanceCount   int64  `json:"attendanceCount"`
	NoShowCount       int64  `json:"noShowCount"`
	LastAttendance    string `json:"lastAttendance"`
	AttendanceQuality string `json:"attendanceQuality"`
	Tracked           bool   `json:"tracked"`
}

type EngagementUserJourneyItem struct {
	Key         string  `json:"key"`
	Title       string  `json:"title"`
	Subtitle    string  `json:"subtitle"`
	Status      string  `json:"status"`
	Amount      float64 `json:"amount"`
	OccurredAt  string  `json:"occurredAt"`
	Description string  `json:"description"`
}

type EngagementUserTag struct {
	Tag       string `json:"tag"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}

type EngagementUserNote struct {
	ID        int64  `json:"id"`
	NoteText  string `json:"noteText"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}

type EngagementUserDinnerInterest struct {
	DinnerID   string `json:"dinnerId"`
	DinnerName string `json:"dinnerName"`
	ViewCount  int64  `json:"viewCount"`
	Applied    bool   `json:"applied"`
	LastViewAt string `json:"lastViewAt"`
}

type EngagementUserCampaignResponse struct {
	CampaignID    int64  `json:"campaignId"`
	CampaignTitle string `json:"campaignTitle"`
	MessageType   string `json:"messageType"`
	Question      string `json:"question"`
	ChoiceIndex   int    `json:"choiceIndex"`
	ChoiceLabel   string `json:"choiceLabel"`
	Correct       bool   `json:"correct"`
	OccurredAt    string `json:"occurredAt"`
}

type EngagementUserProfile struct {
	Overview          EngagementUserOverview                `json:"overview"`
	Timeline          []EngagementUserActivityTimelineEvent `json:"timeline"`
	Behavioral        EngagementUserBehavioralAnalytics     `json:"behavioral"`
	Referral          EngagementUserReferralAnalytics       `json:"referral"`
	Revenue           EngagementUserRevenueAnalytics        `json:"revenue"`
	Attendance        EngagementUserAttendanceAnalytics     `json:"attendance"`
	Journey           []EngagementUserJourneyItem           `json:"journey"`
	EventsPage        EngagementUserEventsPage              `json:"eventsPage"`
	Tags              []EngagementUserTag                   `json:"tags"`
	Notes             []EngagementUserNote                  `json:"notes"`
	LoyaltyScore      int                                   `json:"loyaltyScore"`
	ReferralScore     int                                   `json:"referralScore"`
	DinnerInterest    []EngagementUserDinnerInterest        `json:"dinnerInterest"`
	CampaignResponses []EngagementUserCampaignResponse      `json:"campaignResponses"`
}

type EngagementAnalyticsParams struct {
	StartDate time.Time
	EndDate   time.Time
	Source    string
	DinnerID  int64
	Package   string
}

type EngagementSummary struct {
	ActiveUsers    int64 `json:"activeUsers"`
	PassiveUsers   int64 `json:"passiveUsers"`
	NewUsers       int64 `json:"newUsers"`
	ReturningUsers int64 `json:"returningUsers"`
	TotalEvents    int64 `json:"totalEvents"`
	DinnerViews    int64 `json:"dinnerViews"`
	PackageEvents  int64 `json:"packageEvents"`
	ButtonClicks   int64 `json:"buttonClicks"`
}

type EngagementConversionSummary struct {
	OverallAvailable       bool    `json:"overallAvailable"`
	OverallRate            float64 `json:"overallRate"`
	OverallSubmittedUsers  int64   `json:"overallSubmittedUsers"`
	OverallPaidUsers       int64   `json:"overallPaidUsers"`
	OverallApprovedUsers   int64   `json:"overallApprovedUsers"`
	OverallAttendedUsers   int64   `json:"overallAttendedUsers"`
	TelegramSubmittedUsers int64   `json:"telegramSubmittedUsers"`
	TelegramApprovedUsers  int64   `json:"telegramApprovedUsers"`
	TelegramPaidUsers      int64   `json:"telegramPaidUsers"`
	TelegramAttendedUsers  int64   `json:"telegramAttendedUsers"`
	TelegramRate           float64 `json:"telegramRate"`
	LandingViewedUsers     int64   `json:"landingViewedUsers"`
	LandingSelectedUsers   int64   `json:"landingSelectedUsers"`
	LandingSubmittedUsers  int64   `json:"landingSubmittedUsers"`
	LandingApprovedUsers   int64   `json:"landingApprovedUsers"`
	LandingRate            float64 `json:"landingRate"`
	LandingConversionBase  string  `json:"landingConversionBase"`
	LandingPaymentTracked  bool    `json:"landingPaymentTracked"`
	DisplayLabel           string  `json:"displayLabel"`
	DisplayRate            float64 `json:"displayRate"`
}

type EngagementSeriesPoint struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value int64  `json:"value"`
}

type EngagementTrendPoint struct {
	Key            string  `json:"key"`
	Label          string  `json:"label"`
	Events         int64   `json:"events"`
	ActiveUsers    int64   `json:"activeUsers"`
	ReturningUsers int64   `json:"returningUsers"`
	Applications   int64   `json:"applications"`
	PaidUsers      int64   `json:"paidUsers"`
	ConversionRate float64 `json:"conversionRate"`
}

type EngagementSourcePerformance struct {
	Key            string  `json:"key"`
	Label          string  `json:"label"`
	Users          int64   `json:"users"`
	Applications   int64   `json:"applications"`
	PaidUsers      int64   `json:"paidUsers"`
	ConversionRate float64 `json:"conversionRate"`
	ConversionBase string  `json:"conversionBase"`
}

type EngagementDinnerPerformance struct {
	Key            string  `json:"key"`
	Label          string  `json:"label"`
	Views          int64   `json:"views"`
	Applications   int64   `json:"applications"`
	ConversionRate float64 `json:"conversionRate"`
}

type EngagementButtonPerformance struct {
	Key                  string  `json:"key"`
	Label                string  `json:"label"`
	Clicks               int64   `json:"clicks"`
	UniqueUsers          int64   `json:"uniqueUsers"`
	ApplicantOverlap     int64   `json:"applicantOverlap"`
	ApplicantOverlapRate float64 `json:"applicantOverlapRate"`
	ConversionRate       float64 `json:"conversionRate,omitempty"`
}

type EngagementHourlyPoint struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Events      int64  `json:"events"`
	ActiveUsers int64  `json:"activeUsers"`
}

type EngagementFunnelStep struct {
	Key      string  `json:"key"`
	Label    string  `json:"label"`
	Users    int64   `json:"users"`
	Percent  float64 `json:"percent"`
	DropOff  float64 `json:"dropOff"`
	DropText string  `json:"dropText"`
}

type EngagementFunnelDebugStep struct {
	Key            string   `json:"key"`
	Label          string   `json:"label"`
	RawUsers       int64    `json:"rawUsers"`
	OrderedUsers   int64    `json:"orderedUsers"`
	InferredUsers  int64    `json:"inferredUsers"`
	ExcludedUsers  int64    `json:"excludedUsers"`
	InferredActors []string `json:"inferredActors,omitempty"`
	ExcludedActors []string `json:"excludedActors,omitempty"`
}

type EngagementAnalyticsDebug struct {
	RawStageCounts      []EngagementFunnelDebugStep `json:"rawStageCounts"`
	OrderedStageCounts  []EngagementFunnelDebugStep `json:"orderedStageCounts"`
	ExcludedUsers       []string                    `json:"excludedUsers"`
	InferredStages      []string                    `json:"inferredStages"`
	DataQualityWarnings []string                    `json:"dataQualityWarnings"`
	MeaningfulEvents    []string                    `json:"meaningfulEvents"`
	Checks              []EngagementDebugCheck      `json:"checks"`
}

type EngagementDebugCheck struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Status      string `json:"status"`
	Severity    string `json:"severity"`
	MetricValue string `json:"metricValue"`
	Details     string `json:"details"`
}

type EngagementFilterOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type EngagementFilterOptions struct {
	Dinners  []EngagementFilterOption `json:"dinners"`
	Packages []EngagementFilterOption `json:"packages"`
}

type EngagementAnalytics struct {
	Summary             EngagementSummary             `json:"summary"`
	Conversions         EngagementConversionSummary   `json:"conversions"`
	Timeline            []EngagementTrendPoint        `json:"timeline"`
	SourceBreakdown     []EngagementSeriesPoint       `json:"sourceBreakdown"`
	SourcePerformance   []EngagementSourcePerformance `json:"sourcePerformance"`
	DinnerViews         []EngagementSeriesPoint       `json:"dinnerViews"`
	DinnerPerformance   []EngagementDinnerPerformance `json:"dinnerPerformance"`
	PackageSelections   []EngagementSeriesPoint       `json:"packageSelections"`
	ButtonClicks        []EngagementSeriesPoint       `json:"buttonClicks"`
	ButtonPerformance   []EngagementButtonPerformance `json:"buttonPerformance"`
	PeakHours           []EngagementSeriesPoint       `json:"peakHours"`
	HourlyActivity      []EngagementHourlyPoint       `json:"hourlyActivity"`
	Funnel              []EngagementFunnelStep        `json:"funnel"`
	DataQualityWarnings []string                      `json:"dataQualityWarnings"`
	Debug               EngagementAnalyticsDebug      `json:"debug"`
	FilterOptions       EngagementFilterOptions       `json:"filterOptions"`
}

type EngagementCampaignListParams struct {
	Limit  int
	Offset int
	Search string
	Status string
}

type EngagementCampaignAudienceConfig struct {
	AudienceType   string   `json:"audienceType"`
	DinnerIDs      []int64  `json:"dinnerIds,omitempty"`
	Packages       []string `json:"packages,omitempty"`
	SelectedUsers  []string `json:"selectedUsers,omitempty"`
	Language       string   `json:"language,omitempty"`
	Search         string   `json:"search,omitempty"`
	TermsAccepted  *bool    `json:"termsAccepted,omitempty"`
	IncludeBlocked bool     `json:"includeBlocked,omitempty"`
}

type EngagementCampaignButton struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Kind     string `json:"kind"`
	URL      string `json:"url,omitempty"`
	Action   string `json:"action,omitempty"`
	DinnerID *int64 `json:"dinnerId,omitempty"`
}

type EngagementCampaignMedia struct {
	Kind     string `json:"kind"`
	Value    string `json:"value"`
	FileName string `json:"fileName,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

type EngagementCampaignPoll struct {
	Question           string   `json:"question"`
	Options            []string `json:"options"`
	AllowsMultiple     bool     `json:"allowsMultiple"`
	IsAnonymous        bool     `json:"isAnonymous"`
	CorrectOptionIndex *int     `json:"correctOptionIndex,omitempty"`
	Explanation        string   `json:"explanation,omitempty"`
}

type EngagementCampaignLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Title     string  `json:"title,omitempty"`
	Address   string  `json:"address,omitempty"`
}

type EngagementCampaignContact struct {
	PhoneNumber string `json:"phoneNumber"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName,omitempty"`
	VCard       string `json:"vcard,omitempty"`
}

type EngagementCampaignMessagePayload struct {
	Text      string                      `json:"text,omitempty"`
	Caption   string                      `json:"caption,omitempty"`
	ParseMode string                      `json:"parseMode,omitempty"`
	Media     *EngagementCampaignMedia    `json:"media,omitempty"`
	Buttons   []EngagementCampaignButton  `json:"buttons,omitempty"`
	Poll      *EngagementCampaignPoll     `json:"poll,omitempty"`
	Location  *EngagementCampaignLocation `json:"location,omitempty"`
	Contact   *EngagementCampaignContact  `json:"contact,omitempty"`
}

type EngagementCampaignComposerPayload struct {
	Title              string                           `json:"title"`
	Description        string                           `json:"description"`
	Status             string                           `json:"status"`
	MessageType        string                           `json:"messageType"`
	Audience           EngagementCampaignAudienceConfig `json:"audience"`
	Message            EngagementCampaignMessagePayload `json:"message"`
	ScheduledFor       *time.Time                       `json:"scheduledFor,omitempty"`
	RateLimitPerMinute int                              `json:"rateLimitPerMinute"`
	MaxRetries         int                              `json:"maxRetries"`
	ConfirmBulkSend    bool                             `json:"confirmBulkSend"`
}

type EngagementCampaignDeliveryMetrics struct {
	Total             int64   `json:"total"`
	Pending           int64   `json:"pending"`
	Sending           int64   `json:"sending"`
	Sent              int64   `json:"sent"`
	Failed            int64   `json:"failed"`
	Blocked           int64   `json:"blocked"`
	Skipped           int64   `json:"skipped"`
	Cancelled         int64   `json:"cancelled"`
	ClickedUsers      int64   `json:"clickedUsers"`
	ButtonClicks      int64   `json:"buttonClicks"`
	PollVotes         int64   `json:"pollVotes"`
	QuizCorrect       int64   `json:"quizCorrect"`
	ApplicationsAfter int64   `json:"applicationsAfter"`
	ApplicantsAfter   int64   `json:"applicantsAfter"`
	PaymentsAfter     int64   `json:"paymentsAfter"`
	RevenueAfter      float64 `json:"revenueAfter"`
}

type EngagementCampaignRecord struct {
	ID                 int64                             `json:"id"`
	Title              string                            `json:"title"`
	Description        string                            `json:"description"`
	Status             string                            `json:"status"`
	MessageType        string                            `json:"messageType"`
	Audience           EngagementCampaignAudienceConfig  `json:"audience"`
	Message            EngagementCampaignMessagePayload  `json:"message"`
	ScheduledFor       *time.Time                        `json:"scheduledFor,omitempty"`
	StartedAt          *time.Time                        `json:"startedAt,omitempty"`
	CompletedAt        *time.Time                        `json:"completedAt,omitempty"`
	CancelledAt        *time.Time                        `json:"cancelledAt,omitempty"`
	CreatedAt          time.Time                         `json:"createdAt"`
	UpdatedAt          time.Time                         `json:"updatedAt"`
	CreatedBy          string                            `json:"createdBy"`
	RateLimitPerMinute int                               `json:"rateLimitPerMinute"`
	MaxRetries         int                               `json:"maxRetries"`
	TargetUsers        int64                             `json:"targetUsers"`
	PreviewUsers       []EngagementCampaignAudienceUser  `json:"previewUsers"`
	Metrics            EngagementCampaignDeliveryMetrics `json:"metrics"`
}

type EngagementCampaignAudienceUser struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Phone    string `json:"phone"`
	Status   string `json:"status"`
}

type EngagementCampaignDeliveryLog struct {
	ID          int64     `json:"id"`
	CampaignID  int64     `json:"campaignId"`
	DeliveryID  int64     `json:"deliveryId"`
	UserID      string    `json:"userId"`
	Username    string    `json:"username"`
	EventType   string    `json:"eventType"`
	Status      string    `json:"status"`
	Message     string    `json:"message"`
	Metadata    string    `json:"metadata"`
	MessageType string    `json:"messageType"`
	Question    string    `json:"question"`
	ChoiceIndex *int      `json:"choiceIndex,omitempty"`
	ChoiceLabel string    `json:"choiceLabel"`
	Correct     *bool     `json:"correct,omitempty"`
	OccurredAt  time.Time `json:"occurredAt"`
	Attempt     int       `json:"attempt"`
	MessageID   int       `json:"messageId"`
	PollID      string    `json:"pollId"`
}

type EngagementCampaignOptions struct {
	Dinners  []EngagementFilterOption `json:"dinners"`
	Packages []EngagementFilterOption `json:"packages"`
}

type AdminCampaignsDB interface {
	ListEngagementCampaigns(params EngagementCampaignListParams) ([]EngagementCampaignRecord, int64, error)
	GetEngagementCampaign(id int64) (EngagementCampaignRecord, error)
	CreateEngagementCampaign(payload EngagementCampaignComposerPayload, adminUsername string) (EngagementCampaignRecord, error)
	UpdateEngagementCampaign(id int64, payload EngagementCampaignComposerPayload, adminUsername string) (EngagementCampaignRecord, error)
	ScheduleEngagementCampaign(id int64, when *time.Time, sendNow bool, adminUsername string) (EngagementCampaignRecord, error)
	CancelEngagementCampaign(id int64, adminUsername string) (EngagementCampaignRecord, error)
	QueueEngagementCampaignTest(id int64, userID string, adminUsername string) (EngagementCampaignRecord, error)
	ListEngagementCampaignLogs(id int64, limit int, offset int) ([]EngagementCampaignDeliveryLog, int64, error)
	GetEngagementCampaignOptions() (EngagementCampaignOptions, error)
	Close() error
}
