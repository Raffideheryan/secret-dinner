package db

import "testing"

func TestValidateTelegramApplicationStatusTransition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		current string
		next    string
		wantErr bool
	}{
		// Valid forward transitions
		{name: "draft to pending", current: "draft", next: "pending_application", wantErr: false},
		{name: "draft to cancelled", current: "draft", next: "cancelled", wantErr: false},
		{name: "pending to contacted", current: "pending_application", next: "contacted", wantErr: false},
		{name: "pending to approved", current: "pending_application", next: "approved", wantErr: false},
		{name: "pending to rejected", current: "pending_application", next: "rejected", wantErr: false},
		{name: "pending to cancelled", current: "pending_application", next: "cancelled", wantErr: false},
		{name: "contacted to approved", current: "contacted", next: "approved", wantErr: false},
		{name: "contacted to rejected", current: "contacted", next: "rejected", wantErr: false},
		{name: "contacted to cancelled", current: "contacted", next: "cancelled", wantErr: false},
		{name: "approved to waiting_payment", current: "approved", next: "waiting_payment", wantErr: false},
		{name: "approved to cancelled", current: "approved", next: "cancelled", wantErr: false},
		{name: "waiting_payment to paid", current: "waiting_payment", next: "paid", wantErr: false},
		{name: "waiting_payment to cancelled", current: "waiting_payment", next: "cancelled", wantErr: false},
		{name: "paid to no_show", current: "paid", next: "no_show", wantErr: false},
		{name: "paid to cancelled", current: "paid", next: "cancelled", wantErr: false},

		// Same-status is always allowed
		{name: "same draft", current: "draft", next: "draft", wantErr: false},
		{name: "same pending", current: "pending_application", next: "pending_application", wantErr: false},
		{name: "same rejected", current: "rejected", next: "rejected", wantErr: false},
		{name: "same cancelled", current: "cancelled", next: "cancelled", wantErr: false},
		{name: "same no_show", current: "no_show", next: "no_show", wantErr: false},

		// Invalid: skipping stages
		{name: "draft to paid forbidden", current: "draft", next: "paid", wantErr: true},
		{name: "draft to approved forbidden", current: "draft", next: "approved", wantErr: true},
		{name: "draft to no_show forbidden", current: "draft", next: "no_show", wantErr: true},
		{name: "pending to paid forbidden", current: "pending_application", next: "paid", wantErr: true},
		{name: "pending to no_show forbidden", current: "pending_application", next: "no_show", wantErr: true},
		{name: "pending to waiting_payment forbidden", current: "pending_application", next: "waiting_payment", wantErr: true},
		{name: "approved to paid forbidden", current: "approved", next: "paid", wantErr: true},
		{name: "approved to no_show forbidden", current: "approved", next: "no_show", wantErr: true},
		{name: "waiting_payment to no_show forbidden", current: "waiting_payment", next: "no_show", wantErr: true},

		// Invalid: terminal states cannot be exited
		{name: "terminal rejected to approved forbidden", current: "rejected", next: "approved", wantErr: true},
		{name: "terminal rejected to pending forbidden", current: "rejected", next: "pending_application", wantErr: true},
		{name: "terminal cancelled to approved forbidden", current: "cancelled", next: "approved", wantErr: true},
		{name: "terminal cancelled to pending forbidden", current: "cancelled", next: "pending_application", wantErr: true},
		{name: "terminal no_show to paid forbidden", current: "no_show", next: "paid", wantErr: true},
		{name: "terminal no_show to approved forbidden", current: "no_show", next: "approved", wantErr: true},

		// no_show only from paid — not from other non-terminal states
		{name: "contacted to no_show forbidden", current: "contacted", next: "no_show", wantErr: true},
		{name: "approved to no_show forbidden (direct)", current: "approved", next: "no_show", wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validateTelegramApplicationStatusTransition(tt.current, tt.next)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error for %q -> %q, got nil", tt.current, tt.next)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error for %q -> %q, got %v", tt.current, tt.next, err)
			}
		})
	}
}

func TestNoShowOnlyFromPaid(t *testing.T) {
	t.Parallel()

	// Every non-paid status must not allow transitioning to no_show
	nonPaidStatuses := []string{
		"draft",
		"pending_application",
		"contacted",
		"approved",
		"waiting_payment",
		"rejected",
		"cancelled",
	}
	for _, status := range nonPaidStatuses {
		status := status
		t.Run("no_show from "+status+" is forbidden", func(t *testing.T) {
			t.Parallel()
			if err := validateTelegramApplicationStatusTransition(status, "no_show"); err == nil {
				t.Fatalf("expected error: no_show should only be reachable from paid, not from %q", status)
			}
		})
	}

	// paid must allow no_show
	t.Run("no_show from paid is allowed", func(t *testing.T) {
		t.Parallel()
		if err := validateTelegramApplicationStatusTransition("paid", "no_show"); err != nil {
			t.Fatalf("expected no error for paid -> no_show, got %v", err)
		}
	})
}
