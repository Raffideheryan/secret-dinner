package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

func (r *adminUsersRepo) ListEngagementUsers(params EngagementUsersListParams) (EngagementUsersPage, error) {
	source := normalizeEngagementUserSource(params.Source, r.telegramDB != nil)
	switch source {
	case "landing":
		return r.listLandingEngagementUsers(params)
	default:
		return r.listTelegramEngagementUsers(params)
	}
}

func (r *adminUsersRepo) ListEngagementUserEvents(source string, userID string, params EngagementUserEventsListParams) (EngagementUserEventsPage, error) {
	source = normalizeEngagementUserSource(source, r.telegramDB != nil)
	limit := normalizeLimit(params.Limit, 20)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)

	items, total, err := r.loadEngagementTimelinePage(source, strings.TrimSpace(userID), limit, offset, search)
	if err != nil {
		return EngagementUserEventsPage{}, err
	}
	return EngagementUserEventsPage{
		Events:  items,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		Search:  search,
	}, nil
}

func (r *adminUsersRepo) GetEngagementUserProfile(source string, userID string) (EngagementUserProfile, error) {
	switch normalizeEngagementUserSource(source, r.telegramDB != nil) {
	case "landing":
		return r.getLandingEngagementUserProfile(strings.TrimSpace(userID))
	default:
		return r.getTelegramEngagementUserProfile(strings.TrimSpace(userID))
	}
}

type engagementActivityAggregate struct {
	FirstSeenAt       *time.Time
	LastSeenAt        *time.Time
	TotalEvents       int64
	ActiveDays        int64
	DinnerViews       int64
	PackageSelections int64
	ButtonClicks      int64
	ErrorEvents       int64
	ApplicationStarts int64
	ApplicationsSent  int64
	ReferralEvents    int64
	ReferralClicks    int64
	ReferralSuccesses int64
}

type engagementScoreSummary struct {
	EngagementScore  int
	HealthScore      int
	LoyaltyScore     int
	ReferralScore    int
	EngagementLabel  string
	EngagementReason string
}

func normalizeEngagementUserSource(source string, telegramEnabled bool) string {
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "landing":
		return "landing"
	case "telegram":
		return "telegram"
	default:
		if telegramEnabled {
			return "telegram"
		}
		return "landing"
	}
}

func (r *adminUsersRepo) listLandingEngagementUsers(params EngagementUsersListParams) (EngagementUsersPage, error) {
	if r.landingDB == nil {
		return EngagementUsersPage{Users: []EngagementUserListItem{}, Source: "landing"}, nil
	}

	limit := normalizeLimit(params.Limit, 30)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 1)
	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf("(full_name ILIKE %s OR COALESCE(email, '') ILIKE %s OR COALESCE(phone, '') ILIKE %s)", placeholder, placeholder, placeholder))
	}

	whereSQL := ""
	if len(conditions) > 0 {
		whereSQL = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM users_landing" + whereSQL
	var total int64
	if err := r.landingDB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return EngagementUsersPage{}, err
	}

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, limit, offset)
	query := `
		SELECT
			id::text,
			COALESCE(full_name, ''),
			COALESCE(phone, ''),
			COALESCE(admin_status, 'new'),
			created_at,
			updated_at
		FROM users_landing
	` + whereSQL + fmt.Sprintf(`
		ORDER BY updated_at DESC, created_at DESC
		LIMIT $%d OFFSET $%d
	`, len(queryArgs)-1, len(queryArgs))

	rows, err := r.landingDB.Query(query, queryArgs...)
	if err != nil {
		return EngagementUsersPage{}, err
	}
	defer rows.Close()

	items := make([]EngagementUserListItem, 0, limit)
	userKeys := make([]string, 0, limit)
	for rows.Next() {
		var item EngagementUserListItem
		var createdAt time.Time
		var updatedAt time.Time
		if err := rows.Scan(&item.ID, &item.Name, &item.Phone, &item.Status, &createdAt, &updatedAt); err != nil {
			return EngagementUsersPage{}, err
		}
		item.Source = "landing"
		item.Applications = 1
		item.Username = ""
		item.CreatedAt = &createdAt
		item.LastActivityAt = &updatedAt
		userKeys = append(userKeys, item.ID)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return EngagementUsersPage{}, err
	}

	aggregates, err := r.loadActivityAggregates("landing", userKeys)
	if err != nil {
		return EngagementUsersPage{}, err
	}
	for index := range items {
		aggregate := aggregates[items[index].ID]
		items[index].LastActivityAt = coalesceTimePtr(aggregate.LastSeenAt, items[index].LastActivityAt, items[index].CreatedAt)
		scores := buildEngagementScores(aggregate, items[index].Applications, items[index].PaidBookings, items[index].Payments, items[index].Referrals, items[index].AttendanceCount, false, false, false)
		items[index].EngagementScore = scores.EngagementScore
		items[index].HealthScore = scores.HealthScore
	}

	return EngagementUsersPage{
		Users:  items,
		Total:  total,
		Source: "landing",
	}, nil
}

func (r *adminUsersRepo) listTelegramEngagementUsers(params EngagementUsersListParams) (EngagementUsersPage, error) {
	if r.telegramDB == nil {
		return EngagementUsersPage{Users: []EngagementUserListItem{}, Source: "telegram"}, nil
	}

	limit := normalizeLimit(params.Limit, 30)
	offset := normalizeOffset(params.Offset)
	search := strings.TrimSpace(params.Search)

	args := make([]any, 0, 4)
	conditions := make([]string, 0, 1)
	if search != "" {
		args = append(args, "%"+search+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf("(COALESCE(u.username, '') ILIKE %s OR COALESCE(u.name, '') ILIKE %s OR COALESCE(u.surname, '') ILIKE %s OR COALESCE(u.phone, '') ILIKE %s)", placeholder, placeholder, placeholder, placeholder))
	}

	whereSQL := ""
	if len(conditions) > 0 {
		whereSQL = " WHERE " + strings.Join(conditions, " AND ")
	}

	countQuery := "SELECT COUNT(*) FROM users u" + whereSQL
	var total int64
	if err := r.telegramDB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return EngagementUsersPage{}, err
	}

	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, limit, offset)
	query := `
		SELECT
			u.id::text,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.total_payments, 0)::float8,
			COALESCE(u.friends_invited, 0),
			COALESCE(u.points, 0),
			u.created_at,
			u.updated_at,
			(
				SELECT COUNT(*)
				FROM registered_users ru
				WHERE ru.user_id = u.id
			) AS applications,
			COALESCE((
				SELECT pi.status
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
				ORDER BY pi.updated_at DESC, pi.id DESC
				LIMIT 1
			), '') AS current_status,
			COALESCE((
				SELECT COUNT(*)
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
					AND pi.status IN ('paid', 'no_show')
			), 0) AS paid_bookings,
			COALESCE((
				SELECT MAX(ru.created_at)
				FROM registered_users ru
				WHERE ru.user_id = u.id
			), u.updated_at) AS last_booking_at,
			COALESCE(u.attendance_count, 0),
			EXISTS (
				SELECT 1
				FROM blocked_users bu
				WHERE bu.user_id = u.id
					AND (bu.unblock_date IS NULL OR bu.unblock_date > now())
			) AS blocked_active
		FROM users u
	` + whereSQL + fmt.Sprintf(`
		ORDER BY u.updated_at DESC, u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, len(queryArgs)-1, len(queryArgs))

	rows, err := r.telegramDB.Query(query, queryArgs...)
	if err != nil {
		return EngagementUsersPage{}, err
	}
	defer rows.Close()

	items := make([]EngagementUserListItem, 0, limit)
	userKeys := make([]string, 0, limit)
	for rows.Next() {
		var item EngagementUserListItem
		var username string
		var name string
		var surname string
		var createdAt time.Time
		var updatedAt time.Time
		var paidBookings int64
		var lastBookingAt sql.NullTime
		var attendanceCount int64
		var blockedActive bool
		if err := rows.Scan(
			&item.ID,
			&username,
			&name,
			&surname,
			&item.Phone,
			&item.Payments,
			&item.Referrals,
			&item.Points,
			&createdAt,
			&updatedAt,
			&item.Applications,
			&item.Status,
			&paidBookings,
			&lastBookingAt,
			&attendanceCount,
			&blockedActive,
		); err != nil {
			return EngagementUsersPage{}, err
		}
		item.Source = "telegram"
		item.Username = username
		item.Name = strings.TrimSpace(strings.Join([]string{name, surname}, " "))
		if item.Name == "" {
			item.Name = username
		}
		if item.Name == "" {
			item.Name = "Telegram user"
		}
		item.CreatedAt = &createdAt
		item.PaidBookings = paidBookings
		item.AttendanceCount = attendanceCount
		lastActivity := updatedAt
		if lastBookingAt.Valid && lastBookingAt.Time.After(lastActivity) {
			lastActivity = lastBookingAt.Time
		}
		item.LastActivityAt = &lastActivity
		if blockedActive {
			item.Status = "blocked"
		}
		userKeys = append(userKeys, item.ID)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return EngagementUsersPage{}, err
	}

	aggregates, err := r.loadActivityAggregates("telegram", userKeys)
	if err != nil {
		return EngagementUsersPage{}, err
	}
	for index := range items {
		aggregate := aggregates[items[index].ID]
		items[index].LastActivityAt = coalesceTimePtr(aggregate.LastSeenAt, items[index].LastActivityAt, items[index].CreatedAt)
		scores := buildEngagementScores(aggregate, items[index].Applications, items[index].PaidBookings, items[index].Payments, items[index].Referrals, items[index].AttendanceCount, true, true, true)
		items[index].EngagementScore = scores.EngagementScore
		items[index].HealthScore = scores.HealthScore
	}

	return EngagementUsersPage{
		Users:  items,
		Total:  total,
		Source: "telegram",
	}, nil
}

func (r *adminUsersRepo) getLandingEngagementUserProfile(userID string) (EngagementUserProfile, error) {
	if r.landingDB == nil {
		return EngagementUserProfile{}, sql.ErrConnDone
	}
	if userID == "" {
		return EngagementUserProfile{}, sql.ErrNoRows
	}

	var (
		fullName        string
		phone           string
		email           string
		hobbies         string
		allergies       string
		selectionStatus string
		adminStatus     string
		chosenPackage   sql.NullString
		dinnerTitle     sql.NullString
		guestCount      int64
		createdAt       time.Time
		updatedAt       time.Time
	)
	err := r.landingDB.QueryRow(`
		SELECT
			COALESCE(ul.full_name, ''),
			COALESCE(ul.phone, ''),
			COALESCE(ul.email, ''),
			COALESCE(ul.hobbies, ''),
			COALESCE(ul.allergies, ''),
			COALESCE(ul.selection_status, 'open'),
			COALESCE(ul.admin_status, 'new'),
			ul.chosen_package,
			ld.description,
			COALESCE(ul.guest_count, 0),
			ul.created_at,
			ul.updated_at
		FROM users_landing ul
		LEFT JOIN landing_dinners ld ON ld.id = ul.dinner_id
		WHERE ul.id::text = $1
	`, userID).Scan(
		&fullName,
		&phone,
		&email,
		&hobbies,
		&allergies,
		&selectionStatus,
		&adminStatus,
		&chosenPackage,
		&dinnerTitle,
		&guestCount,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return EngagementUserProfile{}, err
	}

	aggregate, err := r.loadSingleActivityAggregate("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	timeline, err := r.loadEngagementTimeline("landing", userID, 250)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	eventsPage, err := r.ListEngagementUserEvents("landing", userID, EngagementUserEventsListParams{Limit: 20, Offset: 0})
	if err != nil {
		return EngagementUserProfile{}, err
	}
	topDinner, err := r.loadUserTopDinner("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	topPackage, err := r.loadUserTopPackage("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	peakHour, peakHourEvents, err := r.loadUserPeakHour("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}

	scores := buildEngagementScores(aggregate, 1, 0, 0, 0, 0, false, false, false)
	lastActivity := coalesceTimePtr(aggregate.LastSeenAt, &updatedAt, &createdAt)
	firstSeen := coalesceTimePtr(aggregate.FirstSeenAt, &createdAt)

	overview := EngagementUserOverview{
		ID:               userID,
		Source:           "landing",
		Name:             fullName,
		Phone:            phone,
		Status:           adminStatus,
		Applications:     1,
		PaidBookings:     0,
		Payments:         0,
		Referrals:        0,
		Points:           0,
		AttendanceCount:  0,
		LastActivityAt:   lastActivity,
		FirstSeenAt:      firstSeen,
		CreatedAt:        &createdAt,
		EngagementScore:  scores.EngagementScore,
		HealthScore:      scores.HealthScore,
		LoyaltyScore:     scores.LoyaltyScore,
		ReferralScore:    scores.ReferralScore,
		EngagementLabel:  scores.EngagementLabel,
		EngagementReason: scores.EngagementReason,
	}

	tags, err := r.GetUserTags("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	notes, err := r.GetUserNotes("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	dinnerInterest, err := r.loadUserDinnerInterest("landing", userID)
	if err != nil {
		return EngagementUserProfile{}, err
	}

	return EngagementUserProfile{
		Overview: overview,
		Timeline: timeline,
		Behavioral: EngagementUserBehavioralAnalytics{
			TotalEvents:       aggregate.TotalEvents,
			ActiveDays:        aggregate.ActiveDays,
			DinnerViews:       aggregate.DinnerViews,
			PackageSelections: aggregate.PackageSelections,
			ButtonClicks:      aggregate.ButtonClicks,
			ErrorEvents:       aggregate.ErrorEvents,
			ApplicationStarts: aggregate.ApplicationStarts,
			ApplicationsSent:  aggregate.ApplicationsSent,
			FirstSeenAt:       formatTimeRFC3339(firstSeen),
			LastSeenAt:        formatTimeRFC3339(lastActivity),
			PeakHour:          peakHour,
			PeakHourEvents:    peakHourEvents,
			TopDinner:         topDinner,
			TopPackage:        topPackage,
			ConversionStage:   landingConversionStage(selectionStatus, adminStatus, chosenPackage.Valid),
			CompletionRate:    landingCompletionRate(selectionStatus, chosenPackage.Valid),
		},
		Referral: EngagementUserReferralAnalytics{
			Tracked: aggregate.ReferralEvents > 0 || aggregate.ReferralClicks > 0 || aggregate.ReferralSuccesses > 0,
		},
		Revenue: EngagementUserRevenueAnalytics{
			Tracked: false,
		},
		Attendance: EngagementUserAttendanceAnalytics{
			AttendanceQuality: "Not tracked",
			Tracked:           false,
		},
		Journey: []EngagementUserJourneyItem{
			{
				Key:         "landing-application",
				Title:       coalesceString(dinnerTitle.String, "Landing application"),
				Subtitle:    fmt.Sprintf("Package %s · %d guests", coalesceString(chosenPackage.String, "unselected"), guestCount),
				Status:      adminStatus,
				Amount:      0,
				OccurredAt:  formatTimeRFC3339(&updatedAt),
				Description: fmt.Sprintf("Selection %s · Email %s · Hobbies %s · Allergies %s", selectionStatus, coalesceString(email, "—"), coalesceString(hobbies, "—"), coalesceString(allergies, "—")),
			},
		},
		EventsPage:         eventsPage,
		Tags:              tags,
		Notes:             notes,
		LoyaltyScore:      scores.LoyaltyScore,
		ReferralScore:     scores.ReferralScore,
		DinnerInterest:    dinnerInterest,
		CampaignResponses: []EngagementUserCampaignResponse{},
	}, nil
}

func (r *adminUsersRepo) getTelegramEngagementUserProfile(userID string) (EngagementUserProfile, error) {
	if r.telegramDB == nil {
		return EngagementUserProfile{}, sql.ErrConnDone
	}
	if userID == "" {
		return EngagementUserProfile{}, sql.ErrNoRows
	}

	var (
		id                string
		username          string
		name              string
		surname           string
		phone             string
		language          string
		termsAccepted     bool
		legalVersion      string
		totalPayments     float64
		attendanceCount   int64
		referrals         int64
		referralCode      string
		usedReferralCode  string
		points            int64
		createdAt         time.Time
		updatedAt         time.Time
		applications      int64
		paidBookings      int64
		cancelledBookings int64
		lastStatus        string
		lastPaidAt        sql.NullTime
		lastBookingAt     sql.NullTime
	)
	err := r.telegramDB.QueryRow(`
		SELECT
			u.id::text,
			COALESCE(u.username, ''),
			COALESCE(u.name, ''),
			COALESCE(u.surname, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.language::text, ''),
			COALESCE(u.terms_accepted, false),
			COALESCE(u.legal_version, ''),
			COALESCE(u.total_payments, 0)::float8,
			COALESCE(u.attendance_count, 0),
			COALESCE(u.friends_invited, 0),
			COALESCE(u.referral_code, ''),
			COALESCE(ruv.referal_code, ''),
			COALESCE(u.points, 0),
			u.created_at,
			u.updated_at,
			COALESCE((
				SELECT COUNT(*)
				FROM registered_users ru
				WHERE ru.user_id = u.id
			), 0),
			COALESCE((
				SELECT COUNT(*)
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
					AND pi.status IN ('paid', 'no_show')
			), 0),
			COALESCE((
				SELECT COUNT(*)
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
					AND pi.status = 'cancelled'
			), 0),
			COALESCE((
				SELECT pi.status
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
				ORDER BY pi.updated_at DESC, pi.id DESC
				LIMIT 1
			), ''),
			(
				SELECT MAX(pi.updated_at)
				FROM registered_users ru
				JOIN package_info pi ON pi.id = ru.package_info_id
				WHERE ru.user_id = u.id
					AND pi.status = 'paid'
			),
			(
				SELECT MAX(ru.created_at)
				FROM registered_users ru
				WHERE ru.user_id = u.id
			)
		FROM users u
		LEFT JOIN referals ruv ON ruv.user_id = u.id
		WHERE u.id::text = $1
	`, userID).Scan(
		&id,
		&username,
		&name,
		&surname,
		&phone,
		&language,
		&termsAccepted,
		&legalVersion,
		&totalPayments,
		&attendanceCount,
		&referrals,
		&referralCode,
		&usedReferralCode,
		&points,
		&createdAt,
		&updatedAt,
		&applications,
		&paidBookings,
		&cancelledBookings,
		&lastStatus,
		&lastPaidAt,
		&lastBookingAt,
	)
	if err != nil {
		return EngagementUserProfile{}, err
	}

	aggregate, err := r.loadSingleActivityAggregate("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	timeline, err := r.loadEngagementTimeline("telegram", id, 250)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	eventsPage, err := r.ListEngagementUserEvents("telegram", id, EngagementUserEventsListParams{Limit: 20, Offset: 0})
	if err != nil {
		return EngagementUserProfile{}, err
	}
	topDinner, err := r.loadUserTopDinner("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	topPackage, err := r.loadUserTopPackage("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	peakHour, peakHourEvents, err := r.loadUserPeakHour("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	journey, noShowCount, err := r.loadTelegramJourney(id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	tags, err := r.GetUserTags("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	notes, err := r.GetUserNotes("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	dinnerInterest, err := r.loadUserDinnerInterest("telegram", id)
	if err != nil {
		return EngagementUserProfile{}, err
	}
	var telegramUID int64
	if n, parseErr := strconv.ParseInt(id, 10, 64); parseErr == nil {
		telegramUID = n
	}
	campaignResponses, err := r.loadUserCampaignResponses(telegramUID)
	if err != nil {
		return EngagementUserProfile{}, err
	}

	scores := buildEngagementScores(aggregate, applications, paidBookings, totalPayments, referrals, attendanceCount, true, true, true)
	fullName := strings.TrimSpace(strings.Join([]string{name, surname}, " "))
	if fullName == "" {
		fullName = username
	}
	if fullName == "" {
		fullName = "Telegram user"
	}
	lastActivity := coalesceTimePtr(aggregate.LastSeenAt, nullTimePtr(lastBookingAt), &updatedAt, &createdAt)
	firstSeen := coalesceTimePtr(aggregate.FirstSeenAt, &createdAt)

	overview := EngagementUserOverview{
		ID:               id,
		Source:           "telegram",
		Name:             fullName,
		Username:         username,
		Phone:            phone,
		Status:           lastStatus,
		Applications:     applications,
		PaidBookings:     paidBookings,
		Payments:         totalPayments,
		Referrals:        referrals,
		Points:           points,
		AttendanceCount:  attendanceCount,
		LastActivityAt:   lastActivity,
		FirstSeenAt:      firstSeen,
		CreatedAt:        &createdAt,
		TermsAccepted:    termsAccepted,
		Language:         language,
		LegalVersion:     legalVersion,
		EngagementScore:  scores.EngagementScore,
		HealthScore:      scores.HealthScore,
		LoyaltyScore:     scores.LoyaltyScore,
		ReferralScore:    scores.ReferralScore,
		EngagementLabel:  scores.EngagementLabel,
		EngagementReason: scores.EngagementReason,
	}

	return EngagementUserProfile{
		Overview: overview,
		Timeline: timeline,
		Behavioral: EngagementUserBehavioralAnalytics{
			TotalEvents:       aggregate.TotalEvents,
			ActiveDays:        aggregate.ActiveDays,
			DinnerViews:       aggregate.DinnerViews,
			PackageSelections: aggregate.PackageSelections,
			ButtonClicks:      aggregate.ButtonClicks,
			ErrorEvents:       aggregate.ErrorEvents,
			ApplicationStarts: aggregate.ApplicationStarts,
			ApplicationsSent:  aggregate.ApplicationsSent,
			FirstSeenAt:       formatTimeRFC3339(firstSeen),
			LastSeenAt:        formatTimeRFC3339(lastActivity),
			PeakHour:          peakHour,
			PeakHourEvents:    peakHourEvents,
			TopDinner:         topDinner,
			TopPackage:        topPackage,
			ConversionStage:   telegramConversionStage(lastStatus, paidBookings, applications),
			CompletionRate:    ratioPercent(paidBookings, applications),
		},
		Referral: EngagementUserReferralAnalytics{
			ReferralCode:      referralCode,
			UsedReferralCode:  usedReferralCode,
			InvitedUsers:      referrals,
			ReferralEvents:    aggregate.ReferralEvents,
			ReferralClicks:    aggregate.ReferralClicks,
			ReferralSuccesses: aggregate.ReferralSuccesses,
			Tracked:           true,
		},
		Revenue: EngagementUserRevenueAnalytics{
			TotalPayments:     totalPayments,
			PaidBookings:      paidBookings,
			AverageBooking:    averageFloat(totalPayments, paidBookings),
			CancelledBookings: cancelledBookings,
			LatestPaymentAt:   formatTimeRFC3339(nullTimePtr(lastPaidAt)),
			Tracked:           true,
		},
		Attendance: EngagementUserAttendanceAnalytics{
			AttendanceCount:   attendanceCount,
			NoShowCount:       noShowCount,
			LastAttendance:    lastAttendanceLabel(lastStatus),
			AttendanceQuality: attendanceQualityLabel(attendanceCount, noShowCount),
			Tracked:           true,
		},
		Journey:           journey,
		EventsPage:        eventsPage,
		Tags:              tags,
		Notes:             notes,
		LoyaltyScore:      scores.LoyaltyScore,
		ReferralScore:     scores.ReferralScore,
		DinnerInterest:    dinnerInterest,
		CampaignResponses: campaignResponses,
	}, nil
}

func (r *adminUsersRepo) loadActivityAggregates(source string, userKeys []string) (map[string]engagementActivityAggregate, error) {
	result := make(map[string]engagementActivityAggregate, len(userKeys))
	if r.activityDB == nil || len(userKeys) == 0 {
		return result, nil
	}

	inClause, args := buildTextInClause(userKeys, 2)
	query := fmt.Sprintf(`
		SELECT
			user_key,
			MIN(occurred_at),
			MAX(occurred_at),
			COUNT(*) AS total_events,
			COUNT(DISTINCT (occurred_at AT TIME ZONE 'Asia/Yerevan')::date) AS active_days,
			COUNT(*) FILTER (WHERE event_name IN ('viewed_dinner', 'landing_dinner_viewed', 'opened_tickets')) AS dinner_views,
			COUNT(*) FILTER (WHERE event_name IN ('selected_package', 'landing_package_clicked', 'landing_package_selected')) AS package_selections,
			COUNT(*) FILTER (WHERE event_name LIKE '%%clicked%%' OR event_name IN ('clicked_apply', 'telegram_button_clicked')) AS button_clicks,
			COUNT(*) FILTER (WHERE event_name LIKE '%%error%%') AS error_events,
			COUNT(*) FILTER (WHERE event_name IN ('started_bot', 'clicked_apply', 'landing_form_started', 'join_form_started')) AS application_starts,
			COUNT(*) FILTER (WHERE event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved', 'landing_form_submitted')) AS applications_sent,
			COUNT(*) FILTER (WHERE event_name LIKE '%%referral%%') AS referral_events,
			COUNT(*) FILTER (WHERE event_name IN ('clicked_referral_link', 'telegram_referral_clicked')) AS referral_clicks,
			COUNT(*) FILTER (WHERE event_name IN ('referral_completed', 'telegram_referral_success')) AS referral_successes
		FROM user_activity_events
		WHERE source = $1
			AND user_key IN (%s)
		GROUP BY user_key
	`, inClause)

	rows, err := r.activityDB.Query(query, append([]any{source}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			userKey string
			first   sql.NullTime
			last    sql.NullTime
			item    engagementActivityAggregate
		)
		if err := rows.Scan(
			&userKey,
			&first,
			&last,
			&item.TotalEvents,
			&item.ActiveDays,
			&item.DinnerViews,
			&item.PackageSelections,
			&item.ButtonClicks,
			&item.ErrorEvents,
			&item.ApplicationStarts,
			&item.ApplicationsSent,
			&item.ReferralEvents,
			&item.ReferralClicks,
			&item.ReferralSuccesses,
		); err != nil {
			return nil, err
		}
		item.FirstSeenAt = nullTimePtr(first)
		item.LastSeenAt = nullTimePtr(last)
		result[userKey] = item
	}
	return result, rows.Err()
}

func (r *adminUsersRepo) loadSingleActivityAggregate(source string, userKey string) (engagementActivityAggregate, error) {
	items, err := r.loadActivityAggregates(source, []string{userKey})
	if err != nil {
		return engagementActivityAggregate{}, err
	}
	return items[userKey], nil
}

func (r *adminUsersRepo) loadUserPeakHour(source string, userKey string) (string, int64, error) {
	if r.activityDB == nil {
		return "", 0, nil
	}
	var hour string
	var count int64
	err := r.activityDB.QueryRow(`
		SELECT
			TO_CHAR(occurred_at AT TIME ZONE 'Asia/Yerevan', 'HH24') || ':00' AS hour_label,
			COUNT(*) AS total
		FROM user_activity_events
		WHERE source = $1
			AND user_key = $2
		GROUP BY hour_label
		ORDER BY total DESC, hour_label ASC
		LIMIT 1
	`, source, userKey).Scan(&hour, &count)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, nil
	}
	return hour, count, err
}

func (r *adminUsersRepo) loadUserTopDinner(source string, userKey string) (string, error) {
	if r.activityDB == nil {
		return "", nil
	}
	var label string
	err := r.activityDB.QueryRow(`
		SELECT
			COALESCE(NULLIF(MAX(ld.description), ''), 'Dinner #' || events.entity_id) AS label
		FROM user_activity_events events
		LEFT JOIN landing_dinners ld
			ON events.entity_type = 'dinner'
			AND NULLIF(events.entity_id, '') IS NOT NULL
			AND ld.id = CAST(events.entity_id AS BIGINT)
		WHERE events.source = $1
			AND events.user_key = $2
			AND events.event_name IN ('viewed_dinner', 'landing_dinner_viewed')
			AND events.entity_type = 'dinner'
			AND NULLIF(events.entity_id, '') IS NOT NULL
		GROUP BY events.entity_id
		ORDER BY COUNT(*) DESC, label ASC
		LIMIT 1
	`, source, userKey).Scan(&label)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return label, err
}

func (r *adminUsersRepo) loadUserTopPackage(source string, userKey string) (string, error) {
	if r.activityDB == nil {
		return "", nil
	}
	var label string
	err := r.activityDB.QueryRow(`
		SELECT INITCAP(LOWER(NULLIF(BTRIM(COALESCE(metadata->>'package', '')), '')))
		FROM user_activity_events
		WHERE source = $1
			AND user_key = $2
			AND NULLIF(BTRIM(COALESCE(metadata->>'package', '')), '') IS NOT NULL
		GROUP BY LOWER(NULLIF(BTRIM(COALESCE(metadata->>'package', '')), ''))
		ORDER BY COUNT(*) DESC, 1 ASC
		LIMIT 1
	`, source, userKey).Scan(&label)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return label, err
}

func (r *adminUsersRepo) loadEngagementTimeline(source string, userKey string, limit int) ([]EngagementUserActivityTimelineEvent, error) {
	if r.activityDB == nil {
		return []EngagementUserActivityTimelineEvent{}, nil
	}
	rows, err := r.activityDB.Query(`
		SELECT
			id,
			event_name,
			occurred_at,
			COALESCE(entity_type, ''),
			COALESCE(entity_id, ''),
			COALESCE(page_path, ''),
			COALESCE(metadata::text, '{}')
		FROM user_activity_events
		WHERE source = $1
			AND user_key = $2
		ORDER BY occurred_at DESC, id DESC
		LIMIT $3
	`, source, userKey, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]EngagementUserActivityTimelineEvent, 0, limit)
	for rows.Next() {
		var (
			id         int64
			eventName  string
			occurredAt time.Time
			entityType string
			entityID   string
			pagePath   string
			metadata   string
		)
		if err := rows.Scan(&id, &eventName, &occurredAt, &entityType, &entityID, &pagePath, &metadata); err != nil {
			return nil, err
		}
		title, description, tone := formatEngagementTimelineEvent(eventName, entityType, entityID, pagePath, metadata)
		items = append(items, EngagementUserActivityTimelineEvent{
			Key:         fmt.Sprintf("%s-%d", source, id),
			OccurredAt:  occurredAt.UTC().Format(time.RFC3339),
			Title:       title,
			Description: description,
			Tone:        tone,
		})
	}
	return items, rows.Err()
}

func (r *adminUsersRepo) loadEngagementTimelinePage(source string, userKey string, limit int, offset int, search string) ([]EngagementUserActivityTimelineEvent, int64, error) {
	if r.activityDB == nil {
		return []EngagementUserActivityTimelineEvent{}, 0, nil
	}

	conditions := []string{"source = $1", "user_key = $2"}
	args := []any{source, userKey}
	if trimmed := strings.TrimSpace(search); trimmed != "" {
		args = append(args, "%"+trimmed+"%")
		placeholder := fmt.Sprintf("$%d", len(args))
		conditions = append(conditions, fmt.Sprintf(`(
			event_name ILIKE %s OR
			COALESCE(entity_type, '') ILIKE %s OR
			COALESCE(entity_id, '') ILIKE %s OR
			COALESCE(page_path, '') ILIKE %s OR
			COALESCE(metadata::text, '{}') ILIKE %s
		)`, placeholder, placeholder, placeholder, placeholder, placeholder))
	}
	whereSQL := strings.Join(conditions, " AND ")

	countQuery := "SELECT COUNT(*) FROM user_activity_events WHERE " + whereSQL
	var total int64
	if err := r.activityDB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.activityDB.Query(`
		SELECT
			id,
			event_name,
			occurred_at,
			COALESCE(entity_type, ''),
			COALESCE(entity_id, ''),
			COALESCE(page_path, ''),
			COALESCE(metadata::text, '{}')
		FROM user_activity_events
		WHERE `+whereSQL+`
		ORDER BY occurred_at DESC, id DESC
		LIMIT $`+fmt.Sprintf("%d", len(args)-1)+` OFFSET $`+fmt.Sprintf("%d", len(args))+`
	`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]EngagementUserActivityTimelineEvent, 0, limit)
	for rows.Next() {
		var (
			id         int64
			eventName  string
			occurredAt time.Time
			entityType string
			entityID   string
			pagePath   string
			metadata   string
		)
		if err := rows.Scan(&id, &eventName, &occurredAt, &entityType, &entityID, &pagePath, &metadata); err != nil {
			return nil, 0, err
		}
		title, description, tone := formatEngagementTimelineEvent(eventName, entityType, entityID, pagePath, metadata)
		items = append(items, EngagementUserActivityTimelineEvent{
			Key:         fmt.Sprintf("%s-%d", source, id),
			OccurredAt:  occurredAt.UTC().Format(time.RFC3339),
			Title:       title,
			Description: description,
			Tone:        tone,
		})
	}
	return items, total, rows.Err()
}

func (r *adminUsersRepo) loadTelegramJourney(userID string) ([]EngagementUserJourneyItem, int64, error) {
	if r.telegramDB == nil {
		return []EngagementUserJourneyItem{}, 0, nil
	}
	rows, err := r.telegramDB.Query(`
		SELECT
			pi.id,
			COALESCE(pi.public_code, ''),
			COALESCE(d.description, ''),
			COALESCE(pi.menu, ''),
			COALESCE(pi.status, ''),
			COALESCE(pi.price, 0)::float8,
			ru.created_at,
			pi.updated_at
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		JOIN dinners d ON d.id = ru.dinner_id
		WHERE ru.user_id::text = $1
		ORDER BY ru.created_at DESC, pi.id DESC
		LIMIT 8
	`, userID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]EngagementUserJourneyItem, 0, 8)
	var noShowCount int64
	for rows.Next() {
		var (
			id         int64
			publicCode string
			dinner     string
			menu       string
			status     string
			amount     float64
			createdAt  time.Time
			updatedAt  time.Time
		)
		if err := rows.Scan(&id, &publicCode, &dinner, &menu, &status, &amount, &createdAt, &updatedAt); err != nil {
			return nil, 0, err
		}
		packageCode, packageLabel, guestCount := deriveApplicationPackageMeta(menu)
		if strings.EqualFold(status, "no_show") {
			noShowCount++
		}
		items = append(items, EngagementUserJourneyItem{
			Key:         fmt.Sprintf("telegram-journey-%d", id),
			Title:       coalesceString(publicCode, dinner),
			Subtitle:    fmt.Sprintf("%s · %d guests", coalesceString(packageLabel, packageCode), guestCount),
			Status:      status,
			Amount:      amount,
			OccurredAt:  updatedAt.UTC().Format(time.RFC3339),
			Description: fmt.Sprintf("%s booked on %s", coalesceString(dinner, "Dinner"), createdAt.UTC().Format("2006-01-02 15:04")),
		})
	}
	return items, noShowCount, rows.Err()
}

func buildTextInClause(values []string, startIndex int) (string, []any) {
	placeholders := make([]string, 0, len(values))
	args := make([]any, 0, len(values))
	for index, value := range values {
		placeholders = append(placeholders, fmt.Sprintf("$%d", startIndex+index))
		args = append(args, value)
	}
	return strings.Join(placeholders, ", "), args
}

func formatEngagementTimelineEvent(eventName string, entityType string, entityID string, pagePath string, metadataText string) (string, string, string) {
	metadata := map[string]any{}
	_ = json.Unmarshal([]byte(metadataText), &metadata)
	title := humanizeEngagementLabel(eventName)
	descriptionParts := make([]string, 0, 4)
	if entityType != "" && entityID != "" {
		descriptionParts = append(descriptionParts, fmt.Sprintf("%s %s", humanizeEngagementLabel(entityType), entityID))
	}
	if packageValue, ok := metadata["package"].(string); ok && strings.TrimSpace(packageValue) != "" {
		descriptionParts = append(descriptionParts, fmt.Sprintf("Package %s", humanizeEngagementLabel(packageValue)))
	}
	if pagePath != "" {
		descriptionParts = append(descriptionParts, pagePath)
	}
	if len(descriptionParts) == 0 {
		descriptionParts = append(descriptionParts, "Tracked user activity")
	}
	tone := "default"
	if strings.Contains(eventName, "error") {
		tone = "danger"
	} else if strings.Contains(eventName, "submitted") || strings.Contains(eventName, "paid") || strings.Contains(eventName, "accepted") {
		tone = "emerald"
	} else if strings.Contains(eventName, "clicked") || strings.Contains(eventName, "selected") {
		tone = "gold"
	}
	return title, strings.Join(descriptionParts, " · "), tone
}

func scoreEngagementUser(aggregate engagementActivityAggregate, applications int64, paidBookings int64, payments float64, referrals int64, attendance int64) (int, string, string) {
	score := 0
	score += clampInt(int(aggregate.TotalEvents*2), 0, 30)
	score += clampInt(int(aggregate.ActiveDays*3), 0, 18)
	score += clampInt(int(applications*8), 0, 16)
	score += clampInt(int(paidBookings*10), 0, 20)
	score += clampInt(int(referrals*4), 0, 8)
	score += clampInt(int(attendance*4), 0, 8)
	if payments > 0 {
		score += 10
	}
	if score > 100 {
		score = 100
	}
	switch {
	case score >= 75:
		return score, "High intent", "Frequent activity, meaningful journey progress, and commercial value."
	case score >= 45:
		return score, "Warm", "Some repeat engagement with signs of journey progression."
	case score >= 20:
		return score, "Watching", "Light engagement exists, but the relationship is still early."
	default:
		return score, "Cold", "Very limited activity or incomplete journey data."
	}
}

func buildEngagementScores(
	aggregate engagementActivityAggregate,
	applications int64,
	paidBookings int64,
	payments float64,
	referrals int64,
	attendance int64,
	revenueTracked bool,
	attendanceTracked bool,
	referralTracked bool,
) engagementScoreSummary {
	engagementScore, engagementLabel, engagementReason := scoreEngagementUser(aggregate, applications, paidBookings, payments, referrals, attendance)
	loyaltyScore := scoreLoyaltyUser(0, paidBookings, attendance, aggregate.TotalEvents, aggregate.ActiveDays)
	referralScore := 0
	if referralTracked {
		referralScore = scoreReferralUser(referrals, aggregate.ReferralEvents, aggregate.ReferralClicks, aggregate.ReferralSuccesses)
	}
	attendanceScore := 0
	if attendanceTracked {
		attendanceScore = clampInt(int(attendance*20), 0, 100)
	}
	revenueScore := 0
	if revenueTracked && payments > 0 {
		revenueScore = clampInt(int((payments/250000.0)*100), 0, 100)
	}

	parts := []int{engagementScore, loyaltyScore}
	if referralTracked {
		parts = append(parts, referralScore)
	}
	if attendanceTracked {
		parts = append(parts, attendanceScore)
	}
	if revenueTracked {
		parts = append(parts, revenueScore)
	}
	total := 0
	for _, value := range parts {
		total += value
	}
	healthScore := 0
	if len(parts) > 0 {
		healthScore = clampInt(total/len(parts), 0, 100)
	}

	return engagementScoreSummary{
		EngagementScore:  engagementScore,
		HealthScore:      healthScore,
		LoyaltyScore:     loyaltyScore,
		ReferralScore:    referralScore,
		EngagementLabel:  engagementLabel,
		EngagementReason: engagementReason,
	}
}

func landingConversionStage(selectionStatus string, adminStatus string, packageChosen bool) string {
	switch {
	case strings.EqualFold(adminStatus, "approved") && strings.EqualFold(selectionStatus, "completed"):
		return "Approved selection"
	case strings.EqualFold(adminStatus, "contacted"):
		return "Contacted"
	case packageChosen || strings.EqualFold(selectionStatus, "completed"):
		return "Package selected"
	default:
		return "Application captured"
	}
}

func landingCompletionRate(selectionStatus string, packageChosen bool) float64 {
	if packageChosen || strings.EqualFold(selectionStatus, "completed") {
		return 100
	}
	return 45
}

func telegramConversionStage(status string, paidBookings int64, applications int64) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "paid", "no_show":
		return "Paid booking"
	case "waiting_payment":
		return "Waiting payment"
	case "approved":
		return "Approved"
	case "contacted":
		return "Contacted"
	case "pending_application":
		return "Pending review"
	case "cancelled":
		return "Cancelled"
	case "rejected":
		return "Rejected"
	}
	if paidBookings > 0 {
		return "Paid booking"
	}
	if applications > 0 {
		return "Application created"
	}
	return "New user"
}

func lastAttendanceLabel(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "no_show":
		return "No-show"
	case "paid":
		return "Awaiting attendance"
	default:
		return humanizeEngagementLabel(status)
	}
}

func attendanceQualityLabel(attendanceCount int64, noShowCount int64) string {
	if noShowCount > 0 {
		return "Needs follow-up"
	}
	if attendanceCount > 0 {
		return "Reliable attendee"
	}
	return "No attendance history yet"
}

func ratioPercent(numerator int64, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return (float64(numerator) / float64(denominator)) * 100
}

func averageFloat(total float64, count int64) float64 {
	if count <= 0 {
		return 0
	}
	return total / float64(count)
}

func coalesceTimePtr(values ...*time.Time) *time.Time {
	for _, value := range values {
		if value != nil && !value.IsZero() {
			copyValue := value.UTC()
			return &copyValue
		}
	}
	return nil
}

func nullTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	copyValue := value.Time.UTC()
	return &copyValue
}

func formatTimeRFC3339(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func coalesceString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
