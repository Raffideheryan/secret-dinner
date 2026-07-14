package db

import (
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestUpdateLandingUserStatusAllowsCompletedWithoutDinnerOrPackage(t *testing.T) {
	t.Parallel()

	landingDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer landingDB.Close()

	repo := &adminUsersRepo{landingDB: landingDB}
	createdAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(15 * time.Minute)

	mock.ExpectExec(regexp.QuoteMeta(`
		UPDATE users_landing
		SET selection_status = COALESCE($2, selection_status),
			admin_status = COALESCE($3, admin_status),
			updated_at = now()
		WHERE id::text = $1
	`)).
		WithArgs("landing-user-1", "completed", "review").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			ul.id::text,
			ul.full_name,
			ul.email,
			ul.phone,
			ul.guest_count,
			COALESCE(ul.hobbies, ''),
			COALESCE(ul.allergies, ''),
			ul.dinner_id,
			ul.chosen_package,
			COALESCE(ul.selection_status, CASE WHEN ul.dinner_id IS NOT NULL AND ul.chosen_package IS NOT NULL THEN 'completed' ELSE 'open' END),
			COALESCE(ul.admin_status, 'new'),
			COALESCE(ld.description, ''),
			ul.created_at,
			ul.updated_at
		FROM users_landing ul
		LEFT JOIN landing_dinners ld ON ld.id = ul.dinner_id
		WHERE ul.id::text = $1
	`)).
		WithArgs("landing-user-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "full_name", "email", "phone", "guest_count", "hobbies", "allergies",
			"dinner_id", "chosen_package", "selection_status", "admin_status", "description", "created_at", "updated_at",
		}).AddRow(
			"landing-user-1", "Lead One", "lead@example.com", "+374123456", 2, "food", "nuts",
			nil, nil, "completed", "review", "", createdAt, updatedAt,
		))

	selectionStatus := "completed"
	adminStatus := "review"
	updated, err := repo.UpdateLandingUserStatus("landing-user-1", &selectionStatus, &adminStatus)
	if err != nil {
		t.Fatalf("UpdateLandingUserStatus: %v", err)
	}
	if updated.SelectionStatus != "completed" {
		t.Fatalf("SelectionStatus = %q, want completed", updated.SelectionStatus)
	}
	if updated.DinnerID != nil {
		t.Fatalf("DinnerID = %v, want nil", *updated.DinnerID)
	}
	if updated.ChosenPackage != nil {
		t.Fatalf("ChosenPackage = %v, want nil", *updated.ChosenPackage)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}

func TestDeleteLandingUserReturnsDeletedRecord(t *testing.T) {
	t.Parallel()

	landingDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer landingDB.Close()

	repo := &adminUsersRepo{landingDB: landingDB}
	createdAt := time.Date(2026, 7, 10, 12, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(15 * time.Minute)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			ul.id::text,
			ul.full_name,
			ul.email,
			ul.phone,
			ul.guest_count,
			COALESCE(ul.hobbies, ''),
			COALESCE(ul.allergies, ''),
			ul.dinner_id,
			ul.chosen_package,
			COALESCE(ul.selection_status, CASE WHEN ul.dinner_id IS NOT NULL AND ul.chosen_package IS NOT NULL THEN 'completed' ELSE 'open' END),
			COALESCE(ul.admin_status, 'new'),
			COALESCE(ld.description, ''),
			ul.created_at,
			ul.updated_at
		FROM users_landing ul
		LEFT JOIN landing_dinners ld ON ld.id = ul.dinner_id
		WHERE ul.id::text = $1
		FOR UPDATE OF ul
	`)).
		WithArgs("landing-user-2").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "full_name", "email", "phone", "guest_count", "hobbies", "allergies",
			"dinner_id", "chosen_package", "selection_status", "admin_status", "description", "created_at", "updated_at",
		}).AddRow(
			"landing-user-2", "Lead Two", "lead2@example.com", "+374987654", 3, "music", "",
			int64(42), "guest_1:gold,guest_2:vip,guest_3:silver", "completed", "approved", "Dinner title", createdAt, updatedAt,
		))
	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM users_landing WHERE id::text = $1`)).
		WithArgs("landing-user-2").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	deleted, err := repo.DeleteLandingUser("landing-user-2")
	if err != nil {
		t.Fatalf("DeleteLandingUser: %v", err)
	}
	if deleted.ID != "landing-user-2" {
		t.Fatalf("ID = %q, want landing-user-2", deleted.ID)
	}
	if deleted.DinnerID == nil || *deleted.DinnerID != 42 {
		t.Fatalf("DinnerID = %v, want 42", deleted.DinnerID)
	}
	if deleted.ChosenPackage == nil || *deleted.ChosenPackage != "guest_1:gold,guest_2:vip,guest_3:silver" {
		t.Fatalf("ChosenPackage = %v", deleted.ChosenPackage)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet: %v", err)
	}
}
