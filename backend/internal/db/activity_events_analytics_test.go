package db

import (
	"testing"
	"time"
)

func TestBuildActivityEventKeyDedupesViewsWithinThirtySeconds(t *testing.T) {
	t.Parallel()

	base := ActivityEventKeyInput{
		Source:     "landing",
		EventName:  "page_view",
		SessionKey: "session-1",
		PagePath:   "/join",
		Metadata:   map[string]any{"screen": "join"},
		OccurredAt: time.Date(2026, 6, 18, 10, 0, 10, 0, time.UTC),
	}

	first := BuildActivityEventKey(base)
	second := BuildActivityEventKey(ActivityEventKeyInput{
		Source:     base.Source,
		EventName:  base.EventName,
		SessionKey: base.SessionKey,
		PagePath:   base.PagePath,
		Metadata:   base.Metadata,
		OccurredAt: base.OccurredAt.Add(15 * time.Second),
	})
	third := BuildActivityEventKey(ActivityEventKeyInput{
		Source:     base.Source,
		EventName:  base.EventName,
		SessionKey: base.SessionKey,
		PagePath:   base.PagePath,
		Metadata:   base.Metadata,
		OccurredAt: base.OccurredAt.Add(31 * time.Second),
	})

	if first != second {
		t.Fatalf("expected identical event keys within debounce window, got %q and %q", first, second)
	}
	if first == third {
		t.Fatalf("expected different event key outside debounce window, got %q", third)
	}
}

func TestBuildOrderedEngagementFunnelInfersMissingStartedStage(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 9, 0, 0, 0, time.UTC)
	actor := "telegram:u:42"
	result := buildOrderedEngagementFunnel([]engagementStageSnapshot{
		{ActorKey: actor, Source: "telegram", StageKey: "viewed_dinner", OccurredAt: now, Explicit: true},
		{ActorKey: actor, Source: "telegram", StageKey: "selected_package", OccurredAt: now.Add(time.Minute), Explicit: true},
		{ActorKey: actor, Source: "telegram", StageKey: "submitted_application", OccurredAt: now.Add(2 * time.Minute), Explicit: true},
	}, map[string]string{actor: "telegram"})

	started := findFunnelStep(result.Steps, "started_application")
	submitted := findFunnelStep(result.Steps, "submitted_application")
	if started.Users != 1 || submitted.Users != 1 {
		t.Fatalf("expected inferred started and submitted users to both equal 1, got started=%d submitted=%d", started.Users, submitted.Users)
	}
	debug := findDebugStep(result.Debug.OrderedStageCounts, "started_application")
	if debug.InferredUsers != 1 {
		t.Fatalf("expected started_application inference count = 1, got %d", debug.InferredUsers)
	}
}

func TestBuildOrderedEngagementFunnelStaysMonotonicForMixedSources(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 11, 0, 0, 0, time.UTC)
	snapshots := []engagementStageSnapshot{
		{ActorKey: "landing:u:l1", Source: "landing", StageKey: "viewed_dinner", OccurredAt: now, Explicit: true},
		{ActorKey: "landing:u:l1", Source: "landing", StageKey: "selected_package", OccurredAt: now.Add(time.Minute), Explicit: true},
		{ActorKey: "landing:u:l1", Source: "landing", StageKey: "submitted_application", OccurredAt: now.Add(2 * time.Minute), Explicit: true},
		{ActorKey: "telegram:u:t1", Source: "telegram", StageKey: "paid", OccurredAt: now.Add(3 * time.Minute), Explicit: true},
		{ActorKey: "telegram:u:t2", Source: "telegram", StageKey: "selected_package", OccurredAt: now.Add(4 * time.Minute), Explicit: true},
	}
	actorSources := map[string]string{
		"landing:u:l1":  "landing",
		"telegram:u:t1": "telegram",
		"telegram:u:t2": "telegram",
	}

	result := buildOrderedEngagementFunnel(snapshots, actorSources)

	previous := int64(1<<62 - 1)
	for _, step := range result.Steps {
		if step.Users > previous {
			t.Fatalf("funnel is not monotonic at %s: %d > %d", step.Key, step.Users, previous)
		}
		previous = step.Users
	}
}

func TestBuildOrderedEngagementFunnelCountsRepeatedPackageSelectionsOncePerUser(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	actor := "landing:u:l2"
	result := buildOrderedEngagementFunnel([]engagementStageSnapshot{
		{ActorKey: actor, Source: "landing", StageKey: "viewed_dinner", OccurredAt: now, Explicit: true},
		{ActorKey: actor, Source: "landing", StageKey: "selected_package", OccurredAt: now.Add(time.Minute), Explicit: true},
		{ActorKey: actor, Source: "landing", StageKey: "selected_package", OccurredAt: now.Add(2 * time.Minute), Explicit: true},
		{ActorKey: actor, Source: "landing", StageKey: "submitted_application", OccurredAt: now.Add(3 * time.Minute), Explicit: true},
	}, map[string]string{actor: "landing"})

	selected := findFunnelStep(result.Steps, "selected_package")
	if selected.Users != 1 {
		t.Fatalf("expected one selected_package user after repeated selections, got %d", selected.Users)
	}
}

func TestBuildConversionSummarySeparatesTelegramAndLanding(t *testing.T) {
	t.Parallel()

	ordered := map[string]map[string]struct{}{
		"viewed_dinner": {
			"landing:u:l1":  {},
			"telegram:u:t1": {},
		},
		"selected_package": {
			"landing:u:l1":  {},
			"telegram:u:t1": {},
		},
		"submitted_application": {
			"landing:u:l1":  {},
			"telegram:u:t1": {},
		},
		"paid": {
			"telegram:u:t1": {},
		},
	}
	actorSources := map[string]string{
		"landing:u:l1":  "landing",
		"telegram:u:t1": "telegram",
	}

	conversions := buildConversionSummary(ordered, actorSources)

	if conversions.TelegramSubmittedUsers != 1 || conversions.TelegramPaidUsers != 1 || conversions.TelegramRate != 100 {
		t.Fatalf("unexpected telegram conversion summary: %+v", conversions)
	}
	if conversions.LandingSubmittedUsers != 1 || conversions.LandingRate != 100 {
		t.Fatalf("unexpected landing conversion summary: %+v", conversions)
	}
	if conversions.OverallAvailable {
		t.Fatalf("expected overall conversion to remain unavailable when landing payment tracking is absent")
	}
}

func findFunnelStep(steps []EngagementFunnelStep, key string) EngagementFunnelStep {
	for _, step := range steps {
		if step.Key == key {
			return step
		}
	}
	return EngagementFunnelStep{}
}

func findDebugStep(steps []EngagementFunnelDebugStep, key string) EngagementFunnelDebugStep {
	for _, step := range steps {
		if step.Key == key {
			return step
		}
	}
	return EngagementFunnelDebugStep{}
}
