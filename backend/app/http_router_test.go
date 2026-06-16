package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"secret-dinner/config"
	"secret-dinner/internal/db"
	"secret-dinner/routes"

	"github.com/gofiber/fiber/v2"
)

type stubLandingUsersDB struct {
	insertedUsers      []db.Users
	updatedSelections  []selectionUpdateCall
	insertResponseID   string
	updateSelectionErr error
}

type selectionUpdateCall struct {
	userID        string
	dinnerID      int64
	chosenPackage string
}

func (s *stubLandingUsersDB) Insert(user db.Users) (string, error) {
	s.insertedUsers = append(s.insertedUsers, user)
	if s.insertResponseID == "" {
		return "test-user-id", nil
	}
	return s.insertResponseID, nil
}

func (s *stubLandingUsersDB) UpdateSelection(userID string, dinnerID int64, chosenPackage string) error {
	s.updatedSelections = append(s.updatedSelections, selectionUpdateCall{
		userID:        userID,
		dinnerID:      dinnerID,
		chosenPackage: chosenPackage,
	})
	return s.updateSelectionErr
}

func (s *stubLandingUsersDB) Close() error { return nil }

func (s *stubLandingUsersDB) CountLandingUsers() (int64, error) { return int64(len(s.insertedUsers)), nil }

type stubLandingDinnersDB struct {
	syncAllCalls int
}

func (s *stubLandingDinnersDB) GetActiveDinners() ([]db.Dinners, error) { return nil, nil }
func (s *stubLandingDinnersDB) GetAdminDinners() ([]db.Dinners, error)  { return nil, nil }
func (s *stubLandingDinnersDB) CreateDinner(input db.DinnerMutation) (db.Dinners, error) {
	return db.Dinners{}, nil
}
func (s *stubLandingDinnersDB) UpdateDinner(id int64, input db.DinnerMutation) error { return nil }
func (s *stubLandingDinnersDB) DeleteDinner(id int64) error                           { return nil }
func (s *stubLandingDinnersDB) SyncDinnerRegistrations(dinnerID int64) error          { return nil }
func (s *stubLandingDinnersDB) SyncAllDinnerRegistrations() error {
	s.syncAllCalls++
	return nil
}
func (s *stubLandingDinnersDB) Close() error { return nil }

func TestJoinGuards(t *testing.T) {
	makeTestApp := func() (*fiber.App, *runtimeAdminSettings, *stubLandingUsersDB, *stubLandingDinnersDB) {
		settings := newRuntimeAdminSettings(config.Config{})
		usersDB := &stubLandingUsersDB{}
		dinnersDB := &stubLandingDinnersDB{}

		l := &landingApp{
			settings: settings,
			connections: db.Connections{
				Users:   usersDB,
				Dinners: dinnersDB,
			},
		}

		app := fiber.New()
		app.Post("/api/user/join", l.joinApplicationsGuard(), routes.HandleJoin(usersDB, settings))
		app.Post("/api/user/join/selection", l.joinSelectionsGuard(), routes.HandleJoinSelection(usersDB, dinnersDB))
		return app, settings, usersDB, dinnersDB
	}

	t.Run("maintenance mode blocks both join endpoints", func(t *testing.T) {
		app, settings, _, _ := makeTestApp()
		enabled := true
		settings.Apply(runtimeAdminSettingsUpdate{
			MaintenanceMode:       &enabled,
			AllowJoinApplications: &enabled,
			AllowJoinSelections:   &enabled,
		})

		for _, path := range []string{"/api/user/join", "/api/user/join/selection"} {
			req := httptest.NewRequest("POST", path, bytes.NewBufferString(`{}`))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("request failed for %s: %v", path, err)
			}
			if resp.StatusCode != fiber.StatusServiceUnavailable {
				t.Fatalf("expected 503 for %s, got %d", path, resp.StatusCode)
			}
		}
	})

	t.Run("join applications toggle blocks only application step", func(t *testing.T) {
		app, settings, _, _ := makeTestApp()
		disabled := false
		enabled := true
		settings.Apply(runtimeAdminSettingsUpdate{
			AllowJoinApplications: &disabled,
			AllowJoinSelections:   &enabled,
		})

		req := httptest.NewRequest("POST", "/api/user/join", bytes.NewBufferString(`{}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("join request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusForbidden {
			t.Fatalf("expected 403 for join applications, got %d", resp.StatusCode)
		}
	})

	t.Run("join selections toggle blocks only selection step", func(t *testing.T) {
		app, settings, _, _ := makeTestApp()
		disabled := false
		enabled := true
		settings.Apply(runtimeAdminSettingsUpdate{
			AllowJoinApplications: &enabled,
			AllowJoinSelections:   &disabled,
		})

		req := httptest.NewRequest("POST", "/api/user/join/selection", bytes.NewBufferString(`{}`))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("selection request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusForbidden {
			t.Fatalf("expected 403 for join selections, got %d", resp.StatusCode)
		}
	})

	t.Run("enabled join application reaches handler", func(t *testing.T) {
		app, settings, usersDB, _ := makeTestApp()
		enabled := true
		settings.Apply(runtimeAdminSettingsUpdate{
			AllowJoinApplications: &enabled,
			AllowJoinSelections:   &enabled,
		})

		body := map[string]any{
			"fullName":       "Test Guest",
			"email":          "guest@example.com",
			"phone":          "+37412345678",
			"hobbies":        []string{"food", "art"},
			"allergies":      []string{},
			"guestCount":     2,
			"fillDurationMs": int64(3500),
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/user/join", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("join request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			raw, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 200 for join applications, got %d: %s", resp.StatusCode, string(raw))
		}
		if len(usersDB.insertedUsers) != 1 {
			t.Fatalf("expected one inserted landing user, got %d", len(usersDB.insertedUsers))
		}
	})

	t.Run("enabled join selection reaches handler", func(t *testing.T) {
		app, settings, usersDB, dinnersDB := makeTestApp()
		enabled := true
		settings.Apply(runtimeAdminSettingsUpdate{
			AllowJoinApplications: &enabled,
			AllowJoinSelections:   &enabled,
		})

		body := map[string]any{
			"userId":        "landing-user-1",
			"dinnerId":      42,
			"chosenPackage": "gold",
		}
		payload, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/api/user/join/selection", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("selection request failed: %v", err)
		}
		if resp.StatusCode != fiber.StatusOK {
			raw, _ := io.ReadAll(resp.Body)
			t.Fatalf("expected 200 for join selections, got %d: %s", resp.StatusCode, string(raw))
		}
		if len(usersDB.updatedSelections) != 1 {
			t.Fatalf("expected one selection update, got %d", len(usersDB.updatedSelections))
		}
		if dinnersDB.syncAllCalls != 1 {
			t.Fatalf("expected dinner sync after selection, got %d calls", dinnersDB.syncAllCalls)
		}
	})
}
