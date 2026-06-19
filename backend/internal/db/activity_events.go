package db

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lib/pq"
)

type activityEventsRepo struct {
	db *sql.DB
}

func NewActivityEventsDB(db *sql.DB) ActivityEventsDB {
	return &activityEventsRepo{db: db}
}

func (r *activityEventsRepo) Close() error {
	return r.db.Close()
}

func (r *activityEventsRepo) InsertUserActivityEvents(events []UserActivityEventInsert) (int64, error) {
	if len(events) == 0 {
		return 0, nil
	}

	args := make([]any, 0, len(events)*18)
	valueRows := make([]string, 0, len(events))
	for index, event := range events {
		base := index * 18
		valueRows = append(valueRows, fmt.Sprintf(
			"($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, CAST($%d AS JSONB), CAST($%d AS JSONB), $%d)",
			base+1,
			base+2,
			base+3,
			base+4,
			base+5,
			base+6,
			base+7,
			base+8,
			base+9,
			base+10,
			base+11,
			base+12,
			base+13,
			base+14,
			base+15,
			base+16,
			base+17,
			base+18,
		))
		args = append(args,
			event.Source,
			event.EventName,
			event.EventKey,
			event.UserKey,
			event.SessionKey,
			event.EntityType,
			event.EntityID,
			event.PagePath,
			event.Referrer,
			event.UTMSource,
			event.UTMMedium,
			event.UTMCampaign,
			event.UTMContent,
			event.UTMTerm,
			event.TelegramStartParam,
			event.Metadata,
			event.Context,
			event.OccurredAt,
		)
	}

	query := `
		INSERT INTO user_activity_events (
			source,
			event_name,
			event_key,
			user_key,
			session_key,
			entity_type,
			entity_id,
			page_path,
			referrer,
			utm_source,
			utm_medium,
			utm_campaign,
			utm_content,
			utm_term,
			telegram_start_param,
			metadata,
			context,
			occurred_at
		) VALUES ` + strings.Join(valueRows, ",") + `
		ON CONFLICT (source, event_key) WHERE NULLIF(BTRIM(event_key), '') IS NOT NULL DO NOTHING
	`

	result, err := r.db.Exec(query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to insert user activity events: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to read inserted activity rows: %w", err)
	}
	return rowsAffected, nil
}

func (r *activityEventsRepo) GetEngagementAnalytics(params EngagementAnalyticsParams) (EngagementAnalytics, error) {
	events, err := r.loadFilteredEngagementEvents(params)
	if err != nil {
		return EngagementAnalytics{}, err
	}
	actorFirstSeen, err := r.loadActorFirstSeen(params)
	if err != nil {
		return EngagementAnalytics{}, err
	}
	statusSnapshots, statusWarnings, err := r.loadStatusStageSnapshots(params)
	if err != nil {
		return EngagementAnalytics{}, err
	}
	analytics := buildEngagementAnalyticsFromDataset(events, actorFirstSeen, statusSnapshots, statusWarnings, params)
	filterOptions, err := r.queryEngagementFilterOptions(params)
	if err != nil {
		return EngagementAnalytics{}, err
	}
	analytics.FilterOptions = filterOptions
	return analytics, nil
}

type engagementEventRecord struct {
	Source     string
	EventName  string
	EventKey   string
	ActorKey   string
	EntityType string
	EntityID   string
	PagePath   string
	OccurredAt time.Time
	Metadata   map[string]any
	Context    map[string]any
}

type engagementStageSnapshot struct {
	ActorKey   string
	Source     string
	StageKey   string
	OccurredAt time.Time
	Explicit   bool
}

type engagementActorProgress struct {
	Source   string
	Stages   map[string]time.Time
	Inferred map[string]bool
}

type engagementFunnelBuildResult struct {
	Steps       []EngagementFunnelStep
	Conversions EngagementConversionSummary
	Debug       EngagementAnalyticsDebug
	StageTimes  map[string]map[string]time.Time
}

var engagementFunnelStageOrder = []struct {
	Key   string
	Label string
}{
	{Key: "viewed_dinner", Label: "Viewed Dinner"},
	{Key: "selected_package", Label: "Selected Package"},
	{Key: "started_application", Label: "Started Application"},
	{Key: "submitted_application", Label: "Submitted Application"},
	{Key: "approved", Label: "Approved"},
	{Key: "paid", Label: "Paid"},
	{Key: "attended", Label: "Attended"},
}

func (r *activityEventsRepo) loadFilteredEngagementEvents(params EngagementAnalyticsParams) ([]engagementEventRecord, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		SELECT
			source,
			event_name,
			event_key,
			user_key,
			session_key,
			entity_type,
			entity_id,
			page_path,
			metadata,
			context,
			occurred_at
		FROM user_activity_events
		WHERE %s
		ORDER BY occurred_at ASC, id ASC
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to load engagement events: %w", err)
	}
	defer rows.Close()

	deduped := make([]engagementEventRecord, 0, 256)
	seen := make(map[string]struct{})
	for rows.Next() {
		var (
			source      string
			eventName   string
			eventKey    string
			userKey     string
			sessionKey  string
			entityType  string
			entityID    string
			pagePath    string
			metadataRaw []byte
			contextRaw  []byte
			occurredAt  time.Time
		)
		if err := rows.Scan(
			&source,
			&eventName,
			&eventKey,
			&userKey,
			&sessionKey,
			&entityType,
			&entityID,
			&pagePath,
			&metadataRaw,
			&contextRaw,
			&occurredAt,
		); err != nil {
			return nil, err
		}

		metadata := decodeJSONMap(metadataRaw)
		context := decodeJSONMap(contextRaw)
		actorKey := BuildEngagementActorKey(source, userKey, sessionKey)
		if actorKey == "" {
			continue
		}

		resolvedKey := strings.TrimSpace(eventKey)
		if resolvedKey == "" {
			resolvedKey = BuildActivityEventKey(ActivityEventKeyInput{
				Source:     source,
				EventName:  eventName,
				UserKey:    userKey,
				SessionKey: sessionKey,
				EntityType: entityType,
				EntityID:   entityID,
				PagePath:   pagePath,
				OccurredAt: occurredAt,
				Metadata:   metadata,
				Context:    context,
			})
		}
		if resolvedKey != "" {
			scopeKey := source + "|" + resolvedKey
			if _, exists := seen[scopeKey]; exists {
				continue
			}
			seen[scopeKey] = struct{}{}
		}

		deduped = append(deduped, engagementEventRecord{
			Source:     source,
			EventName:  strings.ToLower(strings.TrimSpace(eventName)),
			EventKey:   resolvedKey,
			ActorKey:   actorKey,
			EntityType: strings.TrimSpace(entityType),
			EntityID:   strings.TrimSpace(entityID),
			PagePath:   strings.TrimSpace(pagePath),
			OccurredAt: occurredAt.UTC(),
			Metadata:   metadata,
			Context:    context,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return deduped, nil
}

func (r *activityEventsRepo) loadActorFirstSeen(params EngagementAnalyticsParams) (map[string]time.Time, error) {
	whereSQL, args := buildEngagementHistoryWhere(params)
	query := fmt.Sprintf(`
		SELECT
			source,
			user_key,
			session_key,
			MIN(occurred_at) AS first_seen
		FROM user_activity_events
		WHERE %s
		GROUP BY source, user_key, session_key
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to load engagement actor history: %w", err)
	}
	defer rows.Close()

	result := make(map[string]time.Time)
	for rows.Next() {
		var source, userKey, sessionKey string
		var firstSeen time.Time
		if err := rows.Scan(&source, &userKey, &sessionKey, &firstSeen); err != nil {
			return nil, err
		}
		result[BuildEngagementActorKey(source, userKey, sessionKey)] = firstSeen.UTC()
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) loadStatusStageSnapshots(params EngagementAnalyticsParams) ([]engagementStageSnapshot, []string, error) {
	snapshots := make([]engagementStageSnapshot, 0, 64)
	warnings := make([]string, 0, 4)

	telegramRows, err := r.db.Query(`
		SELECT
			u.id::text,
			ru.dinner_id::text,
			COALESCE(pi.menu, ''),
			COALESCE(pi.status, ''),
			pi.updated_at
		FROM registered_users ru
		JOIN package_info pi ON pi.id = ru.package_info_id
		JOIN users u ON u.id = ru.user_id
		WHERE pi.updated_at >= $1
			AND pi.updated_at < $2
	`, params.StartDate, params.EndDate)
	if err != nil {
		if isUndefinedRelationError(err) {
			warnings = append(warnings, "Telegram booking tables are unavailable in the analytics database, so approved and paid status enrichment is disabled for this environment.")
		} else {
			return nil, nil, fmt.Errorf("failed to load telegram status snapshots: %w", err)
		}
	} else {
		defer telegramRows.Close()

		for telegramRows.Next() {
			var userKey, dinnerID, menu, status string
			var updatedAt time.Time
			if err := telegramRows.Scan(&userKey, &dinnerID, &menu, &status, &updatedAt); err != nil {
				return nil, nil, err
			}
			if strings.ToLower(strings.TrimSpace(params.Source)) == "landing" {
				continue
			}
			if params.DinnerID > 0 && dinnerID != fmt.Sprintf("%d", params.DinnerID) {
				continue
			}
			packageCode, _, _ := deriveApplicationPackageMeta(menu)
			if pkg := strings.ToLower(strings.TrimSpace(params.Package)); pkg != "" && strings.ToLower(packageCode) != pkg {
				continue
			}

			actorKey := BuildEngagementActorKey("telegram", userKey, "")
			normalizedStatus := strings.ToLower(strings.TrimSpace(status))
			if normalizedStatus == "approved" || normalizedStatus == "waiting_payment" || normalizedStatus == "paid" || normalizedStatus == "no_show" {
				snapshots = append(snapshots, engagementStageSnapshot{
					ActorKey:   actorKey,
					Source:     "telegram",
					StageKey:   "approved",
					OccurredAt: updatedAt.UTC(),
					Explicit:   false,
				})
			}
			if normalizedStatus == "paid" || normalizedStatus == "no_show" {
				snapshots = append(snapshots, engagementStageSnapshot{
					ActorKey:   actorKey,
					Source:     "telegram",
					StageKey:   "paid",
					OccurredAt: updatedAt.UTC(),
					Explicit:   false,
				})
			}
		}
		if err := telegramRows.Err(); err != nil {
			return nil, nil, err
		}
	}

	landingRows, err := r.db.Query(`
		SELECT
			id::text,
			COALESCE(dinner_id::text, ''),
			COALESCE(chosen_package, ''),
			COALESCE(selection_status, 'open'),
			COALESCE(admin_status, 'new'),
			updated_at
		FROM users_landing
		WHERE updated_at >= $1
			AND updated_at < $2
	`, params.StartDate, params.EndDate)
	if err != nil {
		if isUndefinedRelationError(err) {
			warnings = append(warnings, "Landing booking tables are unavailable in the analytics database, so landing approval enrichment is disabled for this environment.")
		} else {
			return nil, nil, fmt.Errorf("failed to load landing status snapshots: %w", err)
		}
	} else {
		defer landingRows.Close()

		for landingRows.Next() {
			var userKey, dinnerID, chosenPackage, selectionStatus, adminStatus string
			var updatedAt time.Time
			if err := landingRows.Scan(&userKey, &dinnerID, &chosenPackage, &selectionStatus, &adminStatus, &updatedAt); err != nil {
				return nil, nil, err
			}
			if strings.ToLower(strings.TrimSpace(params.Source)) == "telegram" {
				continue
			}
			if params.DinnerID > 0 && dinnerID != fmt.Sprintf("%d", params.DinnerID) {
				continue
			}
			if pkg := strings.ToLower(strings.TrimSpace(params.Package)); pkg != "" && strings.ToLower(strings.TrimSpace(chosenPackage)) != pkg {
				continue
			}
			if strings.EqualFold(selectionStatus, "completed") && strings.EqualFold(adminStatus, "approved") {
				snapshots = append(snapshots, engagementStageSnapshot{
					ActorKey:   BuildEngagementActorKey("landing", userKey, ""),
					Source:     "landing",
					StageKey:   "approved",
					OccurredAt: updatedAt.UTC(),
					Explicit:   false,
				})
			}
		}
		if err := landingRows.Err(); err != nil {
			return nil, nil, err
		}
	}

	warnings = append(warnings,
		"Approved stage is inferred from current booking status because explicit approval events are not tracked yet.",
		"Landing payment tracking is unavailable; paid conversion is Telegram-only until Landing payment events exist.",
		"Attended stage is unavailable because attendance completion events are not tracked per booking.",
	)
	return snapshots, warnings, nil
}

func isUndefinedRelationError(err error) bool {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return false
	}
	return string(pqErr.Code) == "42P01"
}

func buildEngagementAnalyticsFromDataset(
	events []engagementEventRecord,
	actorFirstSeen map[string]time.Time,
	statusSnapshots []engagementStageSnapshot,
	statusWarnings []string,
	params EngagementAnalyticsParams,
) EngagementAnalytics {
	analytics := EngagementAnalytics{}
	warnings := make([]string, 0, 12)
	warnings = append(warnings, statusWarnings...)

	actorSources := make(map[string]string)
	actorHasMeaningful := make(map[string]bool)
	actorHasAny := make(map[string]bool)
	meaningfulActorsBySource := map[string]map[string]struct{}{
		"landing":  {},
		"telegram": {},
	}

	dayBuckets := make(map[string]*EngagementTrendPoint)
	dayMeaningfulActors := make(map[string]map[string]struct{})
	dayActors := make(map[string]map[string]struct{})
	hourBuckets := make(map[string]*EngagementHourlyPoint)
	hourMeaningfulActors := make(map[string]map[string]struct{})

	dinnerViewCounts := make(map[string]int64)
	dinnerViewActors := make(map[string]map[string]struct{})
	dinnerSubmitActors := make(map[string]map[string]struct{})
	dinnerLabels := make(map[string]string)
	packageActors := make(map[string]map[string]struct{})
	buttonClickCounts := make(map[string]int64)
	buttonClickUsers := make(map[string]map[string]struct{})
	buttonFirstClickAt := make(map[string]map[string]time.Time)
	buttonLabels := make(map[string]string)

	stageSnapshots := make([]engagementStageSnapshot, 0, len(events)+len(statusSnapshots))
	rawStageActors := make(map[string]map[string]struct{})

	for _, event := range events {
		actorHasAny[event.ActorKey] = true
		actorSources[event.ActorKey] = event.Source
		if IsMeaningfulEngagementEvent(event.EventName) {
			actorHasMeaningful[event.ActorKey] = true
			if _, ok := meaningfulActorsBySource[event.Source]; !ok {
				meaningfulActorsBySource[event.Source] = map[string]struct{}{}
			}
			meaningfulActorsBySource[event.Source][event.ActorKey] = struct{}{}
		}

		dayKey, dayLabel := formatYerevanDay(event.OccurredAt)
		if _, ok := dayBuckets[dayKey]; !ok {
			dayBuckets[dayKey] = &EngagementTrendPoint{Key: dayKey, Label: dayLabel}
			dayMeaningfulActors[dayKey] = map[string]struct{}{}
			dayActors[dayKey] = map[string]struct{}{}
		}
		dayBuckets[dayKey].Events++
		dayActors[dayKey][event.ActorKey] = struct{}{}
		if IsMeaningfulEngagementEvent(event.EventName) {
			dayMeaningfulActors[dayKey][event.ActorKey] = struct{}{}
		}

		hourKey, hourLabel := formatYerevanHour(event.OccurredAt)
		if _, ok := hourBuckets[hourKey]; !ok {
			hourBuckets[hourKey] = &EngagementHourlyPoint{Key: hourKey, Label: hourLabel}
			hourMeaningfulActors[hourKey] = map[string]struct{}{}
		}
		hourBuckets[hourKey].Events++
		if IsMeaningfulEngagementEvent(event.EventName) {
			hourMeaningfulActors[hourKey][event.ActorKey] = struct{}{}
		}

		stageKey := engagementStageKeyForEvent(event.EventName)
		if stageKey != "" {
			stageSnapshots = append(stageSnapshots, engagementStageSnapshot{
				ActorKey:   event.ActorKey,
				Source:     event.Source,
				StageKey:   stageKey,
				OccurredAt: event.OccurredAt,
				Explicit:   true,
			})
			addSetValue(rawStageActors, stageKey, event.ActorKey)
		}

		dinnerID := eventDinnerID(event)
		if dinnerID != "" {
			if label := strings.TrimSpace(stringMetadata(event.Metadata, "dinnerTitle")); label != "" {
				dinnerLabels[dinnerID] = label
			}
		}
		switch event.EventName {
		case "viewed_dinner", "landing_dinner_viewed":
			if dinnerID != "" {
				dinnerViewCounts[dinnerID]++
				addSetValue(dinnerViewActors, dinnerID, event.ActorKey)
			}
		case "submitted_application", "join_form_submitted", "landing_dinner_selection_saved", "landing_form_submitted":
			if dinnerID != "" {
				addSetValue(dinnerSubmitActors, dinnerID, event.ActorKey)
			}
		case "selected_package", "landing_package_selected":
			if pkg := strings.ToLower(strings.TrimSpace(stringMetadata(event.Metadata, "package"))); pkg != "" {
				addSetValue(packageActors, pkg, event.ActorKey)
			}
		}

		if isButtonEvent(event.EventName) {
			buttonKey := buttonEventKey(event)
			buttonClickCounts[buttonKey]++
			addSetValue(buttonClickUsers, buttonKey, event.ActorKey)
			if _, ok := buttonFirstClickAt[buttonKey]; !ok {
				buttonFirstClickAt[buttonKey] = make(map[string]time.Time)
			}
			if existing, ok := buttonFirstClickAt[buttonKey][event.ActorKey]; !ok || event.OccurredAt.Before(existing) {
				buttonFirstClickAt[buttonKey][event.ActorKey] = event.OccurredAt
			}
			buttonLabels[buttonKey] = businessFriendlyButtonLabel(buttonKey)
		}
	}

	for _, snapshot := range statusSnapshots {
		stageSnapshots = append(stageSnapshots, snapshot)
		addSetValue(rawStageActors, snapshot.StageKey, snapshot.ActorKey)
		if actorSources[snapshot.ActorKey] == "" {
			actorSources[snapshot.ActorKey] = snapshot.Source
		}
	}

	for actorKey := range actorHasAny {
		if actorHasMeaningful[actorKey] {
			analytics.Summary.ActiveUsers++
		} else {
			analytics.Summary.PassiveUsers++
		}
		analytics.Summary.TotalEvents += 0
		if firstSeen, ok := actorFirstSeen[actorKey]; ok {
			if !firstSeen.Before(params.StartDate) && firstSeen.Before(params.EndDate) {
				analytics.Summary.NewUsers++
			} else if firstSeen.Before(params.StartDate) {
				analytics.Summary.ReturningUsers++
			}
		}
	}
	analytics.Summary.TotalEvents = int64(len(events))

	funnelResult := buildOrderedEngagementFunnel(stageSnapshots, actorSources)
	warnings = append(warnings, funnelResult.Debug.DataQualityWarnings...)
	analytics.Funnel = funnelResult.Steps
	analytics.Conversions = funnelResult.Conversions
	analytics.Debug = funnelResult.Debug

	submittedStageTimes := funnelResult.StageTimes["submitted_application"]
	paidStageTimes := funnelResult.StageTimes["paid"]
	viewStageTimes := funnelResult.StageTimes["viewed_dinner"]
	selectedStageTimes := funnelResult.StageTimes["selected_package"]

	for dayKey, bucket := range dayBuckets {
		bucket.ActiveUsers = int64(len(dayMeaningfulActors[dayKey]))
		returningCount := int64(0)
		dayStart := startOfYerevanDay(dayKey)
		for actorKey := range dayActors[dayKey] {
			if firstSeen, ok := actorFirstSeen[actorKey]; ok && firstSeen.Before(dayStart) {
				returningCount++
			}
		}
		bucket.ReturningUsers = returningCount
	}
	for actorKey, occurredAt := range submittedStageTimes {
		dayKey, _ := formatYerevanDay(occurredAt)
		if bucket, ok := dayBuckets[dayKey]; ok {
			bucket.Applications++
		}
		source := actorSources[actorKey]
		if source == "telegram" {
			funnelResult.Conversions.TelegramSubmittedUsers += 0
		}
	}
	for actorKey, occurredAt := range paidStageTimes {
		dayKey, _ := formatYerevanDay(occurredAt)
		if bucket, ok := dayBuckets[dayKey]; ok && actorSources[actorKey] == "telegram" {
			bucket.PaidUsers++
		}
	}
	for _, bucket := range dayBuckets {
		if bucket.Applications > 0 {
			bucket.ConversionRate = roundPercent(bucket.PaidUsers, bucket.Applications)
		}
	}

	analytics.Timeline = orderedTimeline(dayBuckets)
	for hourKey, bucket := range hourBuckets {
		bucket.ActiveUsers = int64(len(hourMeaningfulActors[hourKey]))
	}
	analytics.HourlyActivity = orderedHourlyBuckets(hourBuckets)
	analytics.PeakHours = make([]EngagementSeriesPoint, 0, len(analytics.HourlyActivity))
	for _, item := range analytics.HourlyActivity {
		analytics.PeakHours = append(analytics.PeakHours, EngagementSeriesPoint{Key: item.Key, Label: item.Label, Value: item.Events})
	}

	analytics.SourcePerformance = buildSourcePerformance(actorSources, meaningfulActorsBySource, funnelResult, viewStageTimes, selectedStageTimes)
	analytics.SourceBreakdown = make([]EngagementSeriesPoint, 0, len(analytics.SourcePerformance))
	for _, item := range analytics.SourcePerformance {
		analytics.SourceBreakdown = append(analytics.SourceBreakdown, EngagementSeriesPoint{Key: item.Key, Label: item.Label, Value: item.Users})
	}

	analytics.DinnerViews = buildDinnerViewsSeries(dinnerViewCounts, dinnerLabels)
	analytics.DinnerPerformance = buildDinnerPerformance(dinnerViewActors, dinnerSubmitActors, dinnerViewCounts, dinnerLabels)
	analytics.PackageSelections = buildPackageSelections(packageActors)
	analytics.ButtonClicks = buildButtonClicksSeries(buttonClickCounts, buttonLabels)
	analytics.ButtonPerformance = buildButtonPerformance(buttonClickCounts, buttonClickUsers, buttonFirstClickAt, submittedStageTimes, buttonLabels)
	analytics.DataQualityWarnings = uniqueSortedStrings(warnings)
	analytics.Debug.DataQualityWarnings = analytics.DataQualityWarnings
	analytics.Debug.MeaningfulEvents = sortedMeaningfulEvents()
	analytics.Debug.Checks = buildEngagementDebugChecks(analytics, actorSources, events)
	return analytics
}

type engagementSeriesSpec struct {
	selectSQL string
}

func (r *activityEventsRepo) queryEngagementSummary(params EngagementAnalyticsParams) (EngagementSummary, error) {
	filteredWhere, filteredArgs := buildEngagementActivityWhere(params, true)
	historyWhere, historyArgs := buildEngagementHistoryWhere(params)
	args := append([]any{}, filteredArgs...)
	historyOffset := len(args)
	args = append(args, historyArgs...)
	args = append(args, params.StartDate, params.EndDate)
	startIdx := len(args) - 1
	endIdx := len(args)

	meaningfulList := sortedMeaningfulEvents()
	args = append(args, pq.Array(meaningfulList))
	meaningfulIdx := len(args)

	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				source,
				occurred_at,
				LOWER(event_name) AS event_name,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		actor_meaningful AS (
			SELECT DISTINCT actor_key
			FROM filtered
			WHERE event_name = ANY($%d)
		),
		actor_history AS (
			SELECT
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key,
				MIN(occurred_at) AS first_seen
			FROM user_activity_events
			WHERE %s
			GROUP BY actor_key
		),
		all_actors AS (
			SELECT DISTINCT actor_key FROM filtered
		)
		SELECT
			COUNT(*) FILTER (WHERE actor_meaningful.actor_key IS NOT NULL) AS active_users,
			COUNT(*) FILTER (WHERE actor_meaningful.actor_key IS NULL) AS passive_users,
			COUNT(*) FILTER (WHERE actor_history.first_seen >= $%d AND actor_history.first_seen < $%d) AS new_users,
			COUNT(*) FILTER (WHERE actor_history.first_seen < $%d) AS returning_users,
			COALESCE((SELECT COUNT(*) FROM filtered), 0) AS total_events
		FROM all_actors
		LEFT JOIN actor_meaningful ON actor_meaningful.actor_key = all_actors.actor_key
		JOIN actor_history ON actor_history.actor_key = all_actors.actor_key
	`, filteredWhere, meaningfulIdx, rewritePlaceholders(historyWhere, historyOffset), startIdx, endIdx, startIdx)

	var summary EngagementSummary
	if err := r.db.QueryRow(query, args...).Scan(
		&summary.ActiveUsers,
		&summary.PassiveUsers,
		&summary.NewUsers,
		&summary.ReturningUsers,
		&summary.TotalEvents,
	); err != nil {
		return EngagementSummary{}, fmt.Errorf("failed to query engagement summary: %w", err)
	}
	return summary, nil
}

func (r *activityEventsRepo) queryEngagementSeries(params EngagementAnalyticsParams, spec engagementSeriesSpec) ([]EngagementSeriesPoint, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				source,
				event_name,
				entity_type,
				entity_id,
				metadata,
				occurred_at,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		)
		%s
	`, whereSQL, spec.selectSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query engagement series: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementSeriesPoint, 0)
	for rows.Next() {
		var item EngagementSeriesPoint
		if err := rows.Scan(&item.Key, &item.Label, &item.Value); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) queryEngagementTimeline(params EngagementAnalyticsParams) ([]EngagementTrendPoint, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	args = append(args, pq.Array(sortedMeaningfulEvents()))
	meaningfulIdx := len(args)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				occurred_at,
				LOWER(event_name) AS event_name,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		meaningful_actors AS (
			SELECT DISTINCT actor_key
			FROM filtered
			WHERE event_name = ANY($%d)
		),
		actor_history AS (
			SELECT
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key,
				MIN(occurred_at) AS first_seen
			FROM user_activity_events
			WHERE NULLIF(BTRIM(COALESCE(user_key, session_key)), '') IS NOT NULL
			GROUP BY actor_key
		),
		day_rollup AS (
			SELECT
				DATE(filtered.occurred_at AT TIME ZONE 'Asia/Yerevan') AS bucket_day,
				COUNT(*) AS events,
				COUNT(DISTINCT filtered.actor_key) FILTER (
					WHERE meaningful_actors.actor_key IS NOT NULL
				) AS active_users,
				COUNT(DISTINCT filtered.actor_key) FILTER (
					WHERE actor_history.first_seen < DATE_TRUNC('day', filtered.occurred_at AT TIME ZONE 'Asia/Yerevan')
				) AS returning_users,
				COUNT(DISTINCT filtered.actor_key) FILTER (
					WHERE filtered.event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
				) AS applications,
				COUNT(DISTINCT filtered.actor_key) FILTER (
					WHERE filtered.event_name IN ('telegram_payment_success')
				) AS paid_users
			FROM filtered
			LEFT JOIN meaningful_actors ON meaningful_actors.actor_key = filtered.actor_key
			LEFT JOIN actor_history ON actor_history.actor_key = filtered.actor_key
			GROUP BY bucket_day
		)
		SELECT
			TO_CHAR(bucket_day, 'YYYY-MM-DD') AS key,
			TO_CHAR(bucket_day, 'Mon DD') AS label,
			events,
			active_users,
			returning_users,
			applications,
			paid_users,
			CASE
				WHEN applications > 0 THEN ROUND((paid_users::numeric / applications::numeric) * 100, 2)
				ELSE 0
			END AS conversion_rate
		FROM day_rollup
		ORDER BY bucket_day ASC
	`, whereSQL, meaningfulIdx)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query engagement timeline: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementTrendPoint, 0, 32)
	for rows.Next() {
		var item EngagementTrendPoint
		if err := rows.Scan(
			&item.Key,
			&item.Label,
			&item.Events,
			&item.ActiveUsers,
			&item.ReturningUsers,
			&item.Applications,
			&item.PaidUsers,
			&item.ConversionRate,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) querySourcePerformance(params EngagementAnalyticsParams) ([]EngagementSourcePerformance, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				source,
				event_name,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		)
		SELECT
			source AS key,
			CASE WHEN source = 'telegram' THEN 'Telegram' ELSE 'Landing' END AS label,
			COUNT(DISTINCT actor_key) AS users,
			COUNT(DISTINCT actor_key) FILTER (
				WHERE event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
			) AS applications,
			COUNT(DISTINCT actor_key) FILTER (
				WHERE event_name IN ('telegram_payment_success')
			) AS paid_users,
			CASE
				WHEN COUNT(DISTINCT actor_key) FILTER (
					WHERE event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
				) > 0
				THEN ROUND(
					(
						COUNT(DISTINCT actor_key) FILTER (WHERE event_name IN ('telegram_payment_success'))::numeric
						/
						COUNT(DISTINCT actor_key) FILTER (
							WHERE event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
						)::numeric
					) * 100,
					2
				)
				ELSE 0
			END AS conversion_rate
		FROM filtered
		GROUP BY source
		ORDER BY users DESC, label ASC
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query source performance: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementSourcePerformance, 0, 4)
	for rows.Next() {
		var item EngagementSourcePerformance
		if err := rows.Scan(
			&item.Key,
			&item.Label,
			&item.Users,
			&item.Applications,
			&item.PaidUsers,
			&item.ConversionRate,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) queryDinnerPerformance(params EngagementAnalyticsParams) ([]EngagementDinnerPerformance, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				event_name,
				entity_type,
				entity_id,
				metadata,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		dinner_events AS (
			SELECT
				COALESCE(NULLIF(filtered.entity_id, ''), NULLIF(filtered.metadata->>'dinnerId', '')) AS dinner_key,
				filtered.event_name,
				filtered.actor_key
			FROM filtered
			WHERE (
				filtered.entity_type = 'dinner'
				OR NULLIF(filtered.metadata->>'dinnerId', '') IS NOT NULL
			)
		)
		SELECT
			dinner_events.dinner_key AS key,
			COALESCE(NULLIF(MAX(d.description), ''), 'Dinner #' || dinner_events.dinner_key) AS label,
			COUNT(DISTINCT CASE WHEN dinner_events.event_name IN ('viewed_dinner', 'landing_dinner_viewed') THEN dinner_events.actor_key END) AS views,
			COUNT(DISTINCT dinner_events.actor_key) FILTER (
				WHERE dinner_events.event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
			) AS applications,
			CASE
				WHEN COUNT(DISTINCT CASE WHEN dinner_events.event_name IN ('viewed_dinner', 'landing_dinner_viewed') THEN dinner_events.actor_key END) > 0
				THEN ROUND(
					(
						COUNT(DISTINCT dinner_events.actor_key) FILTER (
							WHERE dinner_events.event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
						)::numeric
						/
						COUNT(DISTINCT CASE WHEN dinner_events.event_name IN ('viewed_dinner', 'landing_dinner_viewed') THEN dinner_events.actor_key END)::numeric
					) * 100,
					2
				)
				ELSE 0
			END AS conversion_rate
		FROM dinner_events
		LEFT JOIN landing_dinners d
			ON NULLIF(dinner_events.dinner_key, '') IS NOT NULL
			AND dinner_events.dinner_key ~ '^[0-9]+$'
			AND d.id = CAST(dinner_events.dinner_key AS BIGINT)
		WHERE NULLIF(dinner_events.dinner_key, '') IS NOT NULL
		GROUP BY dinner_events.dinner_key
		HAVING COUNT(DISTINCT CASE WHEN dinner_events.event_name IN ('viewed_dinner', 'landing_dinner_viewed') THEN dinner_events.actor_key END) > 0
		ORDER BY views DESC, applications DESC, label ASC
		LIMIT 8
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query dinner performance: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementDinnerPerformance, 0, 8)
	for rows.Next() {
		var item EngagementDinnerPerformance
		if err := rows.Scan(
			&item.Key,
			&item.Label,
			&item.Views,
			&item.Applications,
			&item.ConversionRate,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) queryButtonPerformance(params EngagementAnalyticsParams) ([]EngagementButtonPerformance, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				event_name,
				metadata,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		clicks AS (
			SELECT
				COALESCE(
					NULLIF(BTRIM(COALESCE(metadata->>'callbackData', '')), ''),
					NULLIF(BTRIM(COALESCE(metadata->>'buttonLabel', '')), ''),
					NULLIF(BTRIM(COALESCE(metadata->>'location', '')), ''),
					event_name
				) AS raw_key,
				actor_key
			FROM filtered
			WHERE event_name LIKE '%%clicked%%'
				OR event_name IN ('clicked_apply', 'telegram_button_clicked')
		),
		applicants AS (
			SELECT DISTINCT actor_key
			FROM filtered
			WHERE event_name IN ('submitted_application', 'join_form_submitted', 'landing_dinner_selection_saved')
		)
		SELECT
			raw_key AS key,
			MIN(raw_key) AS label,
			COUNT(*) AS clicks,
			COUNT(DISTINCT actor_key) AS unique_users,
			CASE
				WHEN COUNT(DISTINCT actor_key) > 0
				THEN ROUND(
					(
						COUNT(DISTINCT actor_key) FILTER (WHERE actor_key IN (SELECT actor_key FROM applicants))::numeric
						/
						COUNT(DISTINCT actor_key)::numeric
					) * 100,
					2
				)
				ELSE 0
			END AS conversion_rate
		FROM clicks
		GROUP BY raw_key
		ORDER BY clicks DESC, unique_users DESC, label ASC
		LIMIT 8
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query button performance: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementButtonPerformance, 0, 8)
	for rows.Next() {
		var item EngagementButtonPerformance
		var rawLabel string
		if err := rows.Scan(
			&item.Key,
			&rawLabel,
			&item.Clicks,
			&item.UniqueUsers,
			&item.ConversionRate,
		); err != nil {
			return nil, err
		}
		item.Label = businessFriendlyButtonLabel(rawLabel)
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) queryHourlyActivity(params EngagementAnalyticsParams) ([]EngagementHourlyPoint, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	args = append(args, pq.Array(sortedMeaningfulEvents()))
	meaningfulIdx := len(args)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				occurred_at,
				LOWER(event_name) AS event_name,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		meaningful_actors AS (
			SELECT DISTINCT actor_key
			FROM filtered
			WHERE event_name = ANY($%d)
		)
		SELECT
			TO_CHAR(filtered.occurred_at AT TIME ZONE 'Asia/Yerevan', 'HH24') AS key,
			TO_CHAR(filtered.occurred_at AT TIME ZONE 'Asia/Yerevan', 'HH24') || ':00' AS label,
			COUNT(*) AS events,
			COUNT(DISTINCT filtered.actor_key) FILTER (WHERE meaningful_actors.actor_key IS NOT NULL) AS active_users
		FROM filtered
		LEFT JOIN meaningful_actors ON meaningful_actors.actor_key = filtered.actor_key
		GROUP BY key, label
		ORDER BY key ASC
	`, whereSQL, meaningfulIdx)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query hourly activity: %w", err)
	}
	defer rows.Close()

	result := make([]EngagementHourlyPoint, 0, 24)
	for rows.Next() {
		var item EngagementHourlyPoint
		if err := rows.Scan(&item.Key, &item.Label, &item.Events, &item.ActiveUsers); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *activityEventsRepo) queryEngagementFunnel(params EngagementAnalyticsParams) ([]EngagementFunnelStep, error) {
	whereSQL, args := buildEngagementActivityWhere(params, true)
	query := fmt.Sprintf(`
		WITH filtered AS (
			SELECT
				event_name,
				CASE
					WHEN NULLIF(BTRIM(user_key), '') IS NOT NULL THEN 'u:' || user_key
					ELSE 's:' || session_key
				END AS actor_key
			FROM user_activity_events
			WHERE %s
		),
		mapped AS (
			SELECT
				CASE
					WHEN event_name IN ('viewed_dinner', 'landing_dinner_viewed', 'opened_tickets') THEN 'viewed_dinner'
					WHEN event_name IN ('selected_package', 'landing_package_clicked', 'landing_package_selected') THEN 'selected_package'
					WHEN event_name IN ('clicked_apply', 'join_form_started') THEN 'started_application'
					WHEN event_name IN ('join_form_submitted', 'submitted_application', 'landing_dinner_selection_saved') THEN 'submitted_application'
					WHEN event_name IN ('telegram_payment_success') THEN 'payment_completed'
					ELSE ''
				END AS funnel_key,
				actor_key
			FROM filtered
		)
		SELECT funnel_key, COUNT(DISTINCT actor_key) AS user_count
		FROM mapped
		WHERE funnel_key <> ''
		GROUP BY funnel_key
	`, whereSQL)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query engagement funnel: %w", err)
	}
	defer rows.Close()

	counts := map[string]int64{}
	for rows.Next() {
		var key string
		var count int64
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		counts[key] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	order := []struct {
		key   string
		label string
	}{
		{key: "viewed_dinner", label: "Viewed Dinner"},
		{key: "selected_package", label: "Selected Package"},
		{key: "started_application", label: "Started Application"},
		{key: "submitted_application", label: "Submitted Application"},
		{key: "payment_completed", label: "Paid"},
	}

	firstCount := int64(0)
	for _, item := range order {
		if counts[item.key] > 0 {
			firstCount = counts[item.key]
			break
		}
	}
	if firstCount == 0 {
		firstCount = 1
	}

	result := make([]EngagementFunnelStep, 0, len(order))
	var previousCount int64
	for index, item := range order {
		count := counts[item.key]
		percent := (float64(count) / float64(firstCount)) * 100
		dropOff := 0.0
		dropText := "Baseline"
		if index > 0 && previousCount > 0 {
			dropOff = (1 - (float64(count) / float64(previousCount))) * 100
			if dropOff < 0 {
				dropOff = 0
			}
			dropText = fmt.Sprintf("%.1f%% drop from previous", dropOff)
		}
		result = append(result, EngagementFunnelStep{
			Key:      item.key,
			Label:    item.label,
			Users:    count,
			Percent:  percent,
			DropOff:  dropOff,
			DropText: dropText,
		})
		previousCount = count
	}
	return result, nil
}

func (r *activityEventsRepo) queryEngagementFilterOptions(params EngagementAnalyticsParams) (EngagementFilterOptions, error) {
	dinnerRows, err := r.db.Query(`
		SELECT id::text, description
		FROM landing_dinners
		ORDER BY dinner_date ASC, id ASC
	`)
	if err != nil {
		return EngagementFilterOptions{}, fmt.Errorf("failed to load engagement dinner options: %w", err)
	}
	defer dinnerRows.Close()

	dinners := make([]EngagementFilterOption, 0)
	for dinnerRows.Next() {
		var option EngagementFilterOption
		if err := dinnerRows.Scan(&option.Value, &option.Label); err != nil {
			return EngagementFilterOptions{}, err
		}
		dinners = append(dinners, option)
	}
	if err := dinnerRows.Err(); err != nil {
		return EngagementFilterOptions{}, err
	}

	sourceOnlyParams := params
	sourceOnlyParams.DinnerID = 0
	sourceOnlyParams.Package = ""
	whereSQL, args := buildEngagementActivityWhere(sourceOnlyParams, true)
	packageQuery := fmt.Sprintf(`
		SELECT DISTINCT LOWER(NULLIF(BTRIM(COALESCE(metadata->>'package', '')), '')) AS package_value
		FROM user_activity_events
		WHERE %s
			AND NULLIF(BTRIM(COALESCE(metadata->>'package', '')), '') IS NOT NULL
	`, whereSQL)

	packageRows, err := r.db.Query(packageQuery, args...)
	if err != nil {
		return EngagementFilterOptions{}, fmt.Errorf("failed to load engagement package options: %w", err)
	}
	defer packageRows.Close()

	packages := make([]EngagementFilterOption, 0)
	for packageRows.Next() {
		var value string
		if err := packageRows.Scan(&value); err != nil {
			return EngagementFilterOptions{}, err
		}
		packages = append(packages, EngagementFilterOption{
			Value: value,
			Label: humanizeEngagementLabel(value),
		})
	}
	if err := packageRows.Err(); err != nil {
		return EngagementFilterOptions{}, err
	}
	sort.Slice(packages, func(i, j int) bool {
		return packages[i].Label < packages[j].Label
	})

	return EngagementFilterOptions{
		Dinners:  dinners,
		Packages: packages,
	}, nil
}

func buildOrderedEngagementFunnel(stageSnapshots []engagementStageSnapshot, actorSources map[string]string) engagementFunnelBuildResult {
	progressByActor := make(map[string]*engagementActorProgress)
	rawActorsByStage := make(map[string]map[string]struct{})
	for _, snapshot := range stageSnapshots {
		if _, ok := progressByActor[snapshot.ActorKey]; !ok {
			progressByActor[snapshot.ActorKey] = &engagementActorProgress{
				Source:   snapshot.Source,
				Stages:   make(map[string]time.Time),
				Inferred: make(map[string]bool),
			}
		}
		progress := progressByActor[snapshot.ActorKey]
		if current, exists := progress.Stages[snapshot.StageKey]; !exists || snapshot.OccurredAt.Before(current) {
			progress.Stages[snapshot.StageKey] = snapshot.OccurredAt.UTC()
			if snapshot.Explicit {
				progress.Inferred[snapshot.StageKey] = false
			}
		}
		addSetValue(rawActorsByStage, snapshot.StageKey, snapshot.ActorKey)
	}

	warnings := make([]string, 0, 12)
	inferredMessages := make([]string, 0, 16)
	excludedActors := make([]string, 0, 8)
	inferredActorsByStage := make(map[string]map[string]struct{})
	orderedActorsByStage := make(map[string]map[string]struct{})

	for actorKey, progress := range progressByActor {
		highestIdx := -1
		for idx, stage := range engagementFunnelStageOrder {
			if _, ok := progress.Stages[stage.Key]; ok {
				highestIdx = idx
			}
		}
		if highestIdx < 0 {
			continue
		}

		anchorTime := time.Time{}
		for idx := highestIdx; idx >= 0; idx-- {
			stage := engagementFunnelStageOrder[idx]
			if ts, ok := progress.Stages[stage.Key]; ok {
				if anchorTime.IsZero() || ts.Before(anchorTime) {
					anchorTime = ts
				}
				continue
			}
			progress.Stages[stage.Key] = anchorTime
			progress.Inferred[stage.Key] = true
			addSetValue(inferredActorsByStage, stage.Key, actorKey)
			inferredMessages = append(inferredMessages, fmt.Sprintf("%s -> inferred %s from downstream stage", actorKey, stage.Key))
		}

		var previousTime time.Time
		for _, stage := range engagementFunnelStageOrder {
			ts, ok := progress.Stages[stage.Key]
			if !ok {
				break
			}
			if previousTime.IsZero() {
				previousTime = ts
				addSetValue(orderedActorsByStage, stage.Key, actorKey)
				continue
			}
			if ts.Before(previousTime) {
				progress.Stages[stage.Key] = previousTime
				warnings = append(warnings, fmt.Sprintf("%s had out-of-order %s timestamp; clamped to preserve ordered funnel", actorKey, stage.Key))
			} else {
				previousTime = ts
			}
			addSetValue(orderedActorsByStage, stage.Key, actorKey)
		}
	}

	steps := make([]EngagementFunnelStep, 0, len(engagementFunnelStageOrder))
	rawDebug := make([]EngagementFunnelDebugStep, 0, len(engagementFunnelStageOrder))
	orderedDebug := make([]EngagementFunnelDebugStep, 0, len(engagementFunnelStageOrder))
	stageTimes := make(map[string]map[string]time.Time, len(engagementFunnelStageOrder))

	topCount := int64(len(orderedActorsByStage[engagementFunnelStageOrder[0].Key]))
	if topCount == 0 {
		topCount = 1
	}

	var previousCount int64
	for index, stage := range engagementFunnelStageOrder {
		rawCount := int64(len(rawActorsByStage[stage.Key]))
		orderedCount := int64(len(orderedActorsByStage[stage.Key]))
		inferredCount := int64(len(inferredActorsByStage[stage.Key]))
		excludedCount := rawCount - orderedCount
		if excludedCount < 0 {
			excludedCount = 0
		}

		stageTimes[stage.Key] = make(map[string]time.Time, len(progressByActor))
		for actorKey, progress := range progressByActor {
			if ts, ok := progress.Stages[stage.Key]; ok {
				stageTimes[stage.Key][actorKey] = ts
			}
		}

		percent := (float64(orderedCount) / float64(topCount)) * 100
		dropOff := 0.0
		dropText := "Baseline"
		if index > 0 && previousCount > 0 {
			dropOff = 100 - ((float64(orderedCount) / float64(previousCount)) * 100)
			if dropOff < 0 {
				dropOff = 0
			}
			dropText = fmt.Sprintf("%.1f%% drop from previous", dropOff)
		}
		steps = append(steps, EngagementFunnelStep{
			Key:      stage.Key,
			Label:    stage.Label,
			Users:    orderedCount,
			Percent:  percent,
			DropOff:  dropOff,
			DropText: dropText,
		})

		rawDebug = append(rawDebug, EngagementFunnelDebugStep{
			Key:            stage.Key,
			Label:          stage.Label,
			RawUsers:       rawCount,
			OrderedUsers:   orderedCount,
			InferredUsers:  inferredCount,
			ExcludedUsers:  excludedCount,
			InferredActors: sortedSetValues(inferredActorsByStage[stage.Key]),
			ExcludedActors: nil,
		})
		orderedDebug = append(orderedDebug, EngagementFunnelDebugStep{
			Key:            stage.Key,
			Label:          stage.Label,
			RawUsers:       rawCount,
			OrderedUsers:   orderedCount,
			InferredUsers:  inferredCount,
			ExcludedUsers:  excludedCount,
			InferredActors: sortedSetValues(inferredActorsByStage[stage.Key]),
			ExcludedActors: nil,
		})
		previousCount = orderedCount
	}

	conversions := buildConversionSummary(orderedActorsByStage, actorSources)
	return engagementFunnelBuildResult{
		Steps:       steps,
		Conversions: conversions,
		Debug: EngagementAnalyticsDebug{
			RawStageCounts:      rawDebug,
			OrderedStageCounts:  orderedDebug,
			ExcludedUsers:       uniqueSortedStrings(excludedActors),
			InferredStages:      uniqueSortedStrings(inferredMessages),
			DataQualityWarnings: uniqueSortedStrings(warnings),
		},
		StageTimes: stageTimes,
	}
}

func buildConversionSummary(orderedActorsByStage map[string]map[string]struct{}, actorSources map[string]string) EngagementConversionSummary {
	telegramSubmitted := countStageActorSetForSource(orderedActorsByStage["submitted_application"], actorSources, "telegram")
	telegramApproved := countStageActorSetForSource(orderedActorsByStage["approved"], actorSources, "telegram")
	telegramPaid := countStageActorSetForSource(orderedActorsByStage["paid"], actorSources, "telegram")
	telegramAttended := countStageActorSetForSource(orderedActorsByStage["attended"], actorSources, "telegram")
	landingViewed := countStageActorSetForSource(orderedActorsByStage["viewed_dinner"], actorSources, "landing")
	landingSelected := countStageActorSetForSource(orderedActorsByStage["selected_package"], actorSources, "landing")
	landingSubmitted := countStageActorSetForSource(orderedActorsByStage["submitted_application"], actorSources, "landing")
	landingApproved := countStageActorSetForSource(orderedActorsByStage["approved"], actorSources, "landing")

	landingBase := landingSelected
	landingBaseLabel := "selected users"
	if landingBase == 0 {
		landingBase = landingViewed
		landingBaseLabel = "viewers"
	}

	conversions := EngagementConversionSummary{
		OverallAvailable:       false,
		OverallSubmittedUsers:  telegramSubmitted + landingSubmitted,
		OverallPaidUsers:       telegramPaid,
		OverallApprovedUsers:   telegramApproved + landingApproved,
		OverallAttendedUsers:   telegramAttended,
		TelegramSubmittedUsers: telegramSubmitted,
		TelegramApprovedUsers:  telegramApproved,
		TelegramPaidUsers:      telegramPaid,
		TelegramAttendedUsers:  telegramAttended,
		TelegramRate:           roundPercent(telegramPaid, telegramSubmitted),
		LandingViewedUsers:     landingViewed,
		LandingSelectedUsers:   landingSelected,
		LandingSubmittedUsers:  landingSubmitted,
		LandingApprovedUsers:   landingApproved,
		LandingRate:            roundPercent(landingSubmitted, landingBase),
		LandingConversionBase:  landingBaseLabel,
		LandingPaymentTracked:  false,
		DisplayLabel:           "Telegram Conversion",
		DisplayRate:            roundPercent(telegramPaid, telegramSubmitted),
	}
	return conversions
}

func buildSourcePerformance(
	actorSources map[string]string,
	meaningfulActorsBySource map[string]map[string]struct{},
	funnel engagementFunnelBuildResult,
	viewStageTimes map[string]time.Time,
	selectedStageTimes map[string]time.Time,
) []EngagementSourcePerformance {
	sources := []struct {
		key   string
		label string
	}{
		{key: "telegram", label: "Telegram"},
		{key: "landing", label: "Landing"},
	}
	result := make([]EngagementSourcePerformance, 0, len(sources))
	for _, source := range sources {
		users := int64(len(meaningfulActorsBySource[source.key]))
		applications := countStageActorsForSource(funnel.StageTimes["submitted_application"], actorSources, source.key)
		paidUsers := countStageActorsForSource(funnel.StageTimes["paid"], actorSources, source.key)
		conversionRate := 0.0
		conversionBase := "paid / submitted"
		if source.key == "telegram" {
			conversionRate = roundPercent(paidUsers, applications)
		} else {
			base := countStageActorsForSource(selectedStageTimes, actorSources, source.key)
			conversionBase = "submitted / selected"
			if base == 0 {
				base = countStageActorsForSource(viewStageTimes, actorSources, source.key)
				conversionBase = "submitted / viewed"
			}
			conversionRate = roundPercent(applications, base)
		}
		result = append(result, EngagementSourcePerformance{
			Key:            source.key,
			Label:          source.label,
			Users:          users,
			Applications:   applications,
			PaidUsers:      paidUsers,
			ConversionRate: conversionRate,
			ConversionBase: conversionBase,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Users != result[j].Users {
			return result[i].Users > result[j].Users
		}
		return result[i].Label < result[j].Label
	})
	return result
}

func buildDinnerViewsSeries(counts map[string]int64, labels map[string]string) []EngagementSeriesPoint {
	result := make([]EngagementSeriesPoint, 0, len(counts))
	for dinnerID, count := range counts {
		result = append(result, EngagementSeriesPoint{
			Key:   dinnerID,
			Label: dinnerLabelForID(dinnerID, labels[dinnerID]),
			Value: count,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Value != result[j].Value {
			return result[i].Value > result[j].Value
		}
		return result[i].Label < result[j].Label
	})
	if len(result) > 8 {
		result = result[:8]
	}
	return result
}

func buildDinnerPerformance(viewActors, submitActors map[string]map[string]struct{}, counts map[string]int64, labels map[string]string) []EngagementDinnerPerformance {
	result := make([]EngagementDinnerPerformance, 0, len(viewActors))
	for dinnerID, viewers := range viewActors {
		uniqueViews := int64(len(viewers))
		applications := int64(len(submitActors[dinnerID]))
		result = append(result, EngagementDinnerPerformance{
			Key:            dinnerID,
			Label:          dinnerLabelForID(dinnerID, labels[dinnerID]),
			Views:          uniqueViews,
			Applications:   applications,
			ConversionRate: roundPercent(applications, uniqueViews),
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Views != result[j].Views {
			return result[i].Views > result[j].Views
		}
		if result[i].Applications != result[j].Applications {
			return result[i].Applications > result[j].Applications
		}
		return result[i].Label < result[j].Label
	})
	if len(result) > 8 {
		result = result[:8]
	}
	return result
}

func buildPackageSelections(packageActors map[string]map[string]struct{}) []EngagementSeriesPoint {
	result := make([]EngagementSeriesPoint, 0, len(packageActors))
	for pkg, actors := range packageActors {
		result = append(result, EngagementSeriesPoint{
			Key:   pkg,
			Label: humanizeEngagementLabel(pkg),
			Value: int64(len(actors)),
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Value != result[j].Value {
			return result[i].Value > result[j].Value
		}
		return result[i].Label < result[j].Label
	})
	if len(result) > 8 {
		result = result[:8]
	}
	return result
}

func buildButtonClicksSeries(counts map[string]int64, labels map[string]string) []EngagementSeriesPoint {
	result := make([]EngagementSeriesPoint, 0, len(counts))
	for key, count := range counts {
		result = append(result, EngagementSeriesPoint{
			Key:   key,
			Label: labels[key],
			Value: count,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Value != result[j].Value {
			return result[i].Value > result[j].Value
		}
		return result[i].Label < result[j].Label
	})
	if len(result) > 8 {
		result = result[:8]
	}
	return result
}

func buildButtonPerformance(
	counts map[string]int64,
	users map[string]map[string]struct{},
	firstClick map[string]map[string]time.Time,
	submittedStageTimes map[string]time.Time,
	labels map[string]string,
) []EngagementButtonPerformance {
	result := make([]EngagementButtonPerformance, 0, len(counts))
	for key, count := range counts {
		uniqueUsers := int64(len(users[key]))
		overlapUsers := int64(0)
		for actorKey, clickAt := range firstClick[key] {
			submittedAt, ok := submittedStageTimes[actorKey]
			if ok && (submittedAt.Equal(clickAt) || submittedAt.After(clickAt)) {
				overlapUsers++
			}
		}
		result = append(result, EngagementButtonPerformance{
			Key:                  key,
			Label:                labels[key],
			Clicks:               count,
			UniqueUsers:          uniqueUsers,
			ApplicantOverlap:     overlapUsers,
			ApplicantOverlapRate: roundPercent(overlapUsers, uniqueUsers),
			ConversionRate:       roundPercent(overlapUsers, uniqueUsers),
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Clicks != result[j].Clicks {
			return result[i].Clicks > result[j].Clicks
		}
		if result[i].UniqueUsers != result[j].UniqueUsers {
			return result[i].UniqueUsers > result[j].UniqueUsers
		}
		return result[i].Label < result[j].Label
	})
	if len(result) > 8 {
		result = result[:8]
	}
	return result
}

func orderedTimeline(buckets map[string]*EngagementTrendPoint) []EngagementTrendPoint {
	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]EngagementTrendPoint, 0, len(keys))
	for _, key := range keys {
		result = append(result, *buckets[key])
	}
	return result
}

func orderedHourlyBuckets(buckets map[string]*EngagementHourlyPoint) []EngagementHourlyPoint {
	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]EngagementHourlyPoint, 0, len(keys))
	for _, key := range keys {
		result = append(result, *buckets[key])
	}
	return result
}

func buildEngagementDebugChecks(analytics EngagementAnalytics, actorSources map[string]string, events []engagementEventRecord) []EngagementDebugCheck {
	duplicateCandidates := 0
	missingAttribution := 0
	missingActor := 0

	for _, event := range events {
		if strings.TrimSpace(event.ActorKey) == "" {
			missingActor++
		}
		if strings.TrimSpace(event.EventKey) == "" {
			duplicateCandidates++
		}
		if strings.TrimSpace(event.Source) == "landing" && !hasAnyAttribution(event) {
			missingAttribution++
		}
	}

	return []EngagementDebugCheck{
		buildDebugCheck("event_volume", "Tracked events", analytics.Summary.TotalEvents > 0, false, fmt.Sprintf("%d", analytics.Summary.TotalEvents), "Events currently loaded into the filtered analytics slice."),
		buildDebugCheck("meaningful_users", "Meaningful active users", analytics.Summary.ActiveUsers > 0, false, fmt.Sprintf("%d", analytics.Summary.ActiveUsers), "Users counted only when they triggered meaningful engagement events."),
		buildDebugCheck("missing_attribution", "Missing attribution", missingAttribution == 0, false, fmt.Sprintf("%d", missingAttribution), "Landing events missing UTM, referrer, and Telegram start attribution."),
		buildDebugCheck("missing_actor_identity", "Missing actor identity", missingActor == 0, true, fmt.Sprintf("%d", missingActor), "Events missing both user and session identity cannot be attributed safely."),
		buildDebugCheck("empty_event_keys", "Events without dedupe keys", duplicateCandidates == 0, false, fmt.Sprintf("%d", duplicateCandidates), "Events without deterministic event_key remain vulnerable to duplicate inserts on retries."),
		buildDebugCheck("journey_monotonicity", "Guest journey monotonicity", funnelIsMonotonic(analytics.Funnel), true, fmt.Sprintf("%d stages", len(analytics.Funnel)), "Ordered journey counts should never increase at a later stage."),
		buildDebugCheck("landing_payment_tracking", "Landing payment tracking", analytics.Conversions.LandingPaymentTracked, false, boolLabel(analytics.Conversions.LandingPaymentTracked), "Landing payment conversion stays unavailable until payment events exist for Landing."),
		buildDebugCheck("cross_channel_identity", "Cross-channel identity stitching", false, false, fmt.Sprintf("%d actors", len(actorSources)), "Telegram and Landing actors are still source-scoped and may represent the same real guest twice."),
	}
}

func buildDebugCheck(key, label string, pass bool, critical bool, metricValue string, details string) EngagementDebugCheck {
	status := "PASS"
	severity := "info"
	if !pass {
		status = "WARN"
		severity = "warning"
	}
	if critical && !pass {
		status = "FAIL"
		severity = "critical"
	}
	return EngagementDebugCheck{
		Key:         key,
		Label:       label,
		Status:      status,
		Severity:    severity,
		MetricValue: metricValue,
		Details:     details,
	}
}

func hasAnyAttribution(event engagementEventRecord) bool {
	return strings.TrimSpace(stringMetadata(event.Metadata, "utmSource")) != "" ||
		strings.TrimSpace(stringMetadata(event.Context, "utmSource")) != "" ||
		strings.TrimSpace(stringMetadata(event.Metadata, "telegramStartParam")) != "" ||
		strings.TrimSpace(stringMetadata(event.Context, "telegramStartParam")) != "" ||
		strings.TrimSpace(stringMetadata(event.Context, "referrer")) != ""
}

func funnelIsMonotonic(steps []EngagementFunnelStep) bool {
	var previous *int64
	for _, step := range steps {
		current := step.Users
		if previous != nil && current > *previous {
			return false
		}
		previous = &current
	}
	return true
}

func boolLabel(value bool) string {
	if value {
		return "yes"
	}
	return "no"
}

func engagementStageKeyForEvent(eventName string) string {
	switch eventName {
	case "viewed_dinner", "landing_dinner_viewed", "opened_tickets":
		return "viewed_dinner"
	case "selected_package", "landing_package_selected":
		return "selected_package"
	case "clicked_apply", "landing_form_started", "join_form_started":
		return "started_application"
	case "submitted_application", "join_form_submitted", "landing_dinner_selection_saved", "landing_form_submitted":
		return "submitted_application"
	case "telegram_payment_success":
		return "paid"
	default:
		return ""
	}
}

func decodeJSONMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	payload := make(map[string]any)
	if err := json.Unmarshal(raw, &payload); err != nil {
		return map[string]any{}
	}
	return payload
}

func addSetValue(target map[string]map[string]struct{}, key, value string) {
	if key == "" || value == "" {
		return
	}
	if _, ok := target[key]; !ok {
		target[key] = make(map[string]struct{})
	}
	target[key][value] = struct{}{}
}

func sortedSetValues(values map[string]struct{}) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func uniqueSortedStrings(values []string) []string {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			set[trimmed] = struct{}{}
		}
	}
	return sortedSetValues(set)
}

func countStageActorsForSource(stageTimes map[string]time.Time, actorSources map[string]string, source string) int64 {
	count := int64(0)
	for actorKey := range stageTimes {
		if actorSources[actorKey] == source {
			count++
		}
	}
	return count
}

func countStageActorSetForSource(stageActors map[string]struct{}, actorSources map[string]string, source string) int64 {
	count := int64(0)
	for actorKey := range stageActors {
		if actorSources[actorKey] == source {
			count++
		}
	}
	return count
}

func roundPercent(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(int(((float64(numerator)/float64(denominator))*100)*100+0.5)) / 100
}

func formatYerevanDay(value time.Time) (string, string) {
	local := value.In(time.FixedZone("Asia/Yerevan", 4*60*60))
	return local.Format("2006-01-02"), local.Format("Jan 02")
}

func startOfYerevanDay(dayKey string) time.Time {
	parsed, err := time.ParseInLocation("2006-01-02", dayKey, time.FixedZone("Asia/Yerevan", 4*60*60))
	if err != nil {
		return time.Time{}
	}
	return parsed.UTC()
}

func formatYerevanHour(value time.Time) (string, string) {
	local := value.In(time.FixedZone("Asia/Yerevan", 4*60*60))
	return local.Format("15"), local.Format("15:00")
}

func eventDinnerID(event engagementEventRecord) string {
	if trimmed := strings.TrimSpace(event.EntityID); trimmed != "" {
		return trimmed
	}
	return strings.TrimSpace(stringMetadata(event.Metadata, "dinnerId"))
}

func dinnerLabelForID(dinnerID string, explicit string) string {
	if strings.TrimSpace(explicit) != "" {
		return strings.TrimSpace(explicit)
	}
	return "Dinner #" + dinnerID
}

func isButtonEvent(eventName string) bool {
	if strings.Contains(eventName, "clicked") {
		return true
	}
	switch eventName {
	case "clicked_apply", "telegram_button_clicked":
		return true
	default:
		return false
	}
}

func buttonEventKey(event engagementEventRecord) string {
	return firstNonEmptyString(
		stringMetadata(event.Metadata, "callbackData"),
		stringMetadata(event.Metadata, "buttonLabel"),
		stringMetadata(event.Metadata, "location"),
		event.EventName,
	)
}

func sortedMeaningfulEvents() []string {
	values := make([]string, 0, len(meaningfulEngagementEvents))
	for value := range meaningfulEngagementEvents {
		values = append(values, value)
	}
	sort.Strings(values)
	return values
}

func buildEngagementActivityWhere(params EngagementAnalyticsParams, includeDate bool) (string, []any) {
	conditions := make([]string, 0, 6)
	args := make([]any, 0, 6)

	if includeDate {
		args = append(args, params.StartDate, params.EndDate)
		conditions = append(conditions, fmt.Sprintf("occurred_at >= $%d", len(args)-1))
		conditions = append(conditions, fmt.Sprintf("occurred_at < $%d", len(args)))
	}

	source := strings.ToLower(strings.TrimSpace(params.Source))
	if source == "landing" || source == "telegram" {
		args = append(args, source)
		conditions = append(conditions, fmt.Sprintf("source = $%d", len(args)))
	}

	if params.DinnerID > 0 {
		value := fmt.Sprintf("%d", params.DinnerID)
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf("(entity_id = $%d OR COALESCE(metadata->>'dinnerId', '') = $%d)", len(args), len(args)))
	}

	if pkg := strings.ToLower(strings.TrimSpace(params.Package)); pkg != "" {
		args = append(args, pkg)
		conditions = append(conditions, fmt.Sprintf("LOWER(COALESCE(metadata->>'package', '')) = $%d", len(args)))
	}

	if len(conditions) == 0 {
		return "TRUE", args
	}
	return strings.Join(conditions, " AND "), args
}

func buildEngagementHistoryWhere(params EngagementAnalyticsParams) (string, []any) {
	conditions := []string{"(NULLIF(BTRIM(user_key), '') IS NOT NULL OR NULLIF(BTRIM(session_key), '') IS NOT NULL)"}
	args := make([]any, 0, 2)
	source := strings.ToLower(strings.TrimSpace(params.Source))
	if source == "landing" || source == "telegram" {
		args = append(args, source)
		conditions = append(conditions, fmt.Sprintf("source = $%d", len(args)))
	}
	return strings.Join(conditions, " AND "), args
}

func rewritePlaceholders(whereSQL string, offset int) string {
	if offset == 0 {
		return whereSQL
	}
	for index := offset; index >= 1; index-- {
		whereSQL = strings.ReplaceAll(whereSQL, fmt.Sprintf("$%d", index), fmt.Sprintf("$%d", index+offset))
	}
	return whereSQL
}

func humanizeEngagementLabel(value string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, "_", " "))
	if value == "" {
		return "Unknown"
	}
	parts := strings.Fields(value)
	for index, part := range parts {
		runes := []rune(part)
		if len(runes) == 0 {
			continue
		}
		parts[index] = strings.ToUpper(string(runes[0])) + strings.ToLower(string(runes[1:]))
	}
	return strings.Join(parts, " ")
}

func businessFriendlyButtonLabel(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "back":
		return "Back Navigation"
	case "clicked_apply":
		return "Apply Button"
	case "my_profile", "profile", "open_profile":
		return "Profile Opened"
	case "invite_friend", "invite_friends":
		return "Invite Friends"
	case "ticket_proceed_payment", "proceed_payment":
		return "Proceed to Payment"
	case "menu":
		return "Main Menu"
	case "next":
		return "Next Step"
	case "continue":
		return "Continue"
	}
	return humanizeEngagementLabel(value)
}
