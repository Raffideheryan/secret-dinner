package db

import "testing"

func TestTelegramStatusCountsTowardCapacity(t *testing.T) {
	t.Parallel()

	cases := []struct {
		status string
		want   bool
	}{
		{status: "draft", want: true},
		{status: "pending_application", want: true},
		{status: "contacted", want: true},
		{status: "approved", want: true},
		{status: "waiting_payment", want: true},
		{status: "paid", want: true},
		{status: "rejected", want: false},
		{status: "cancelled", want: false},
		{status: "no_show", want: false},
		{status: "", want: false},
		{status: " APPROVED ", want: true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.status, func(t *testing.T) {
			t.Parallel()
			if got := telegramStatusCountsTowardCapacity(tc.status); got != tc.want {
				t.Fatalf("telegramStatusCountsTowardCapacity(%q) = %v, want %v", tc.status, got, tc.want)
			}
		})
	}
}

func TestDeriveApplicationPackageMetaGuestCount(t *testing.T) {
	t.Parallel()

	cases := []struct {
		menu string
		want int
	}{
		{menu: "silver", want: 1},
		{menu: "gold", want: 1},
		{menu: "vip", want: 1},
		{menu: "custom_menu", want: 1},
		{menu: "guest_1:silver,guest_2:gold,guest_3:vip", want: 3},
		{menu: "starter,main,dessert", want: 3},
		{menu: "", want: 0},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.menu, func(t *testing.T) {
			t.Parallel()
			_, _, got := deriveApplicationPackageMeta(tc.menu)
			if got != tc.want {
				t.Fatalf("deriveApplicationPackageMeta(%q) guestCount = %d, want %d", tc.menu, got, tc.want)
			}
		})
	}
}

func TestTelegramCapacityUsage(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		status       string
		menu         string
		wantBookings int64
		wantSeats    int64
	}{
		{
			name:         "one booking with two guests consumes two seats",
			status:       "approved",
			menu:         "guest_1:silver,guest_2:gold",
			wantBookings: 1,
			wantSeats:    2,
		},
		{
			name:         "cancelled booking consumes zero seats",
			status:       "cancelled",
			menu:         "guest_1:silver,guest_2:gold",
			wantBookings: 0,
			wantSeats:    0,
		},
		{
			name:         "rejected booking consumes zero seats",
			status:       "rejected",
			menu:         "guest_1:silver,guest_2:gold",
			wantBookings: 0,
			wantSeats:    0,
		},
		{
			name:         "no show booking consumes zero seats",
			status:       "no_show",
			menu:         "guest_1:silver,guest_2:gold",
			wantBookings: 0,
			wantSeats:    0,
		},
		{
			name:         "missing guest count does not consume seats",
			status:       "approved",
			menu:         "",
			wantBookings: 0,
			wantSeats:    0,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			gotBookings, gotSeats := telegramCapacityUsage(tc.status, tc.menu)
			if gotBookings != tc.wantBookings || gotSeats != tc.wantSeats {
				t.Fatalf(
					"telegramCapacityUsage(%q, %q) = (%d bookings, %d seats), want (%d bookings, %d seats)",
					tc.status,
					tc.menu,
					gotBookings,
					gotSeats,
					tc.wantBookings,
					tc.wantSeats,
				)
			}
		})
	}
}

func TestTelegramCapacityUsageSumsGuestCountAcrossBookings(t *testing.T) {
	t.Parallel()

	bookings := []struct {
		status string
		menu   string
	}{
		{status: "pending_application", menu: "guest_1:silver,guest_2:gold"},
		{status: "paid", menu: "guest_1:silver,guest_2:gold,guest_3:vip,guest_4:vip,guest_5:gold"},
		{status: "cancelled", menu: "guest_1:silver"},
		{status: "rejected", menu: "guest_1:silver,guest_2:gold"},
		{status: "no_show", menu: "guest_1:silver"},
	}

	var totalBookings int64
	var totalSeats int64
	for _, booking := range bookings {
		countedBookings, countedSeats := telegramCapacityUsage(booking.status, booking.menu)
		totalBookings += countedBookings
		totalSeats += countedSeats
	}

	if totalBookings != 2 {
		t.Fatalf("total counted bookings = %d, want 2", totalBookings)
	}
	if totalSeats != 7 {
		t.Fatalf("total occupied seats = %d, want 7", totalSeats)
	}
}
