package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"secret-dinner/internal/db"

	"github.com/gofiber/fiber/v2"
)

type stubActivityEventsDB struct {
	inserted []db.UserActivityEventInsert
}

func (s *stubActivityEventsDB) InsertUserActivityEvents(events []db.UserActivityEventInsert) (int64, error) {
	s.inserted = append(s.inserted, events...)
	return int64(len(events)), nil
}

func (s *stubActivityEventsDB) GetEngagementAnalytics(params db.EngagementAnalyticsParams) (db.EngagementAnalytics, error) {
	return db.EngagementAnalytics{}, nil
}

func (s *stubActivityEventsDB) Close() error { return nil }

func TestStoreUserActivityEventsHandler(t *testing.T) {
	makeTestApp := func() (*fiber.App, *stubActivityEventsDB) {
		activityDB := &stubActivityEventsDB{}
		l := &landingApp{
			connections: db.Connections{
				ActivityEvents: activityDB,
			},
		}
		app := fiber.New()
		app.Post("/api/activity/events", l.storeUserActivityEventsHandler())
		return app, activityDB
	}

	t.Run("accepts batch activity payloads", func(t *testing.T) {
		app, activityDB := makeTestApp()
		payload := map[string]any{
			"events": []map[string]any{
				{
					"source":    "landing",
					"eventName": "join_form_submitted",
					"userId":    "landing-user-42",
					"pagePath":  "/join",
					"metadata": map[string]any{
						"step": 1,
					},
				},
				{
					"source":    "telegram",
					"eventName": "booking_opened",
					"sessionId": "tg-session-1",
					"eventKey":  "dedupe-1",
				},
			},
		}
		body, _ := json.Marshal(payload)

		req := httptest.NewRequest("POST", "/api/activity/events", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "engagement-test")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusAccepted {
			raw, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 202, got %d: %s", resp.StatusCode, string(raw))
		}
		if len(activityDB.inserted) != 2 {
			t.Fatalf("expected 2 inserted events, got %d", len(activityDB.inserted))
		}
		if activityDB.inserted[0].Source != "landing" {
			t.Fatalf("expected normalized landing source, got %q", activityDB.inserted[0].Source)
		}
		if activityDB.inserted[1].Source != "telegram" {
			t.Fatalf("expected normalized telegram source, got %q", activityDB.inserted[1].Source)
		}
		if activityDB.inserted[0].EventKey == "" {
			t.Fatalf("expected backend to generate deterministic event key for landing event")
		}
		if activityDB.inserted[1].EventKey != "dedupe-1" {
			t.Fatalf("expected explicit event key to be preserved, got %q", activityDB.inserted[1].EventKey)
		}
	})

	t.Run("rejects invalid source", func(t *testing.T) {
		app, _ := makeTestApp()
		body := []byte(`{"source":"email","eventName":"opened","sessionId":"session-1"}`)

		req := httptest.NewRequest("POST", "/api/activity/events", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusBadRequest {
			raw, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 400, got %d: %s", resp.StatusCode, string(raw))
		}
	})

	t.Run("rejects events without user or session identity", func(t *testing.T) {
		app, _ := makeTestApp()
		body := []byte(`{"source":"landing","eventName":"opened"}`)

		req := httptest.NewRequest("POST", "/api/activity/events", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusBadRequest {
			raw, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 400, got %d: %s", resp.StatusCode, string(raw))
		}
	})
}
