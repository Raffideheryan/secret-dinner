package db

import "testing"

func TestNormalizeLandingGuestPackages(t *testing.T) {
	t.Run("single package expands to guest count", func(t *testing.T) {
		got, err := normalizeLandingGuestPackages("gold", 3)
		if err != nil {
			t.Fatalf("normalizeLandingGuestPackages returned error: %v", err)
		}
		want := []string{"gold", "gold", "gold"}
		if len(got) != len(want) {
			t.Fatalf("len = %d, want %d", len(got), len(want))
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("got[%d] = %q, want %q", i, got[i], want[i])
			}
		}
	})

	t.Run("guest encoded package keeps per guest choices", func(t *testing.T) {
		got, err := normalizeLandingGuestPackages("guest_1:silver,guest_2:gold,guest_3:vip", 3)
		if err != nil {
			t.Fatalf("normalizeLandingGuestPackages returned error: %v", err)
		}
		want := []string{"silver", "gold", "vip"}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("got[%d] = %q, want %q", i, got[i], want[i])
			}
		}
	})

	t.Run("guest count mismatch fails", func(t *testing.T) {
		if _, err := normalizeLandingGuestPackages("guest_1:silver,guest_2:gold", 3); err == nil {
			t.Fatal("expected error for guest count mismatch")
		}
	})
}

func TestCountLandingPackages(t *testing.T) {
	counts := countLandingPackages([]string{"silver", "gold", "gold", "custom", "vip"})
	if counts["silver"] != 1 {
		t.Fatalf("silver count = %d, want 1", counts["silver"])
	}
	if counts["gold"] != 2 {
		t.Fatalf("gold count = %d, want 2", counts["gold"])
	}
	if counts["vip"] != 1 {
		t.Fatalf("vip count = %d, want 1", counts["vip"])
	}
}
