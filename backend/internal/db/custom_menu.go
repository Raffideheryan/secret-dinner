package db

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type CustomMenuItem struct {
	ID        int64     `json:"id"`
	NameArm   string    `json:"nameArm"`
	NameRus   string    `json:"nameRus"`
	NameEng   string    `json:"nameEng"`
	Price     float64   `json:"price"`
	DishType  string    `json:"dishType"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateCustomMenuItemInput struct {
	NameArm  string
	NameRus  string
	NameEng  string
	Price    float64
	DishType string
}

var ErrInvalidDishType = errors.New("invalid dish type")

type CustomMenuDB interface {
	Close() error
	ListDishTypes() ([]string, error)
	ListItemsByType(dishType string) ([]CustomMenuItem, error)
	CreateItem(input CreateCustomMenuItemInput) (CustomMenuItem, error)
}

type customMenuRepo struct {
	db *sql.DB
}

func NewCustomMenuDB(db *sql.DB) CustomMenuDB {
	return &customMenuRepo{db: db}
}

func (r *customMenuRepo) Close() error {
	return r.db.Close()
}

func (r *customMenuRepo) ListDishTypes() ([]string, error) {
	const query = `
		SELECT unnest(enum_range(NULL::dish_type_enum))::text
		ORDER BY 1
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *customMenuRepo) ListItemsByType(dishType string) ([]CustomMenuItem, error) {
	dishType = strings.TrimSpace(dishType)
	if dishType == "" {
		return nil, ErrInvalidDishType
	}

	const query = `
		SELECT id, name_arm, name_rus, name_eng, price, dish_type, created_at, updated_at
		FROM custom_menu
		WHERE dish_type = $1
		ORDER BY name_eng
	`

	rows, err := r.db.Query(query, dishType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CustomMenuItem
	for rows.Next() {
		var item CustomMenuItem
		if err := rows.Scan(
			&item.ID,
			&item.NameArm,
			&item.NameRus,
			&item.NameEng,
			&item.Price,
			&item.DishType,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *customMenuRepo) CreateItem(input CreateCustomMenuItemInput) (CustomMenuItem, error) {
	input.NameArm = strings.TrimSpace(input.NameArm)
	input.NameRus = strings.TrimSpace(input.NameRus)
	input.NameEng = strings.TrimSpace(input.NameEng)
	input.DishType = strings.TrimSpace(input.DishType)

	if input.NameArm == "" || input.NameRus == "" || input.NameEng == "" {
		return CustomMenuItem{}, errors.New("dish names are required")
	}
	if input.DishType == "" {
		return CustomMenuItem{}, ErrInvalidDishType
	}
	if input.Price <= 0 {
		return CustomMenuItem{}, errors.New("price must be positive")
	}

	const query = `
		INSERT INTO custom_menu (name_arm, name_rus, name_eng, price, dish_type)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	var item CustomMenuItem
	item.NameArm = input.NameArm
	item.NameRus = input.NameRus
	item.NameEng = input.NameEng
	item.Price = input.Price
	item.DishType = input.DishType

	if err := r.db.QueryRow(query, input.NameArm, input.NameRus, input.NameEng, input.Price, input.DishType).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt); err != nil {
		// postgres enum mismatch or constraint error; keep message generic but useful
		return CustomMenuItem{}, fmt.Errorf("failed to create dish: %w", err)
	}
	return item, nil
}
