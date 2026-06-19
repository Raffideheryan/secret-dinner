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
		{name: "pending to contacted", current: "pending_application", next: "contacted", wantErr: false},
		{name: "pending to paid allowed for admin override", current: "pending_application", next: "paid", wantErr: false},
		{name: "approved to waiting payment", current: "approved", next: "waiting_payment", wantErr: false},
		{name: "approved to paid allowed for admin override", current: "approved", next: "paid", wantErr: false},
		{name: "waiting payment to paid", current: "waiting_payment", next: "paid", wantErr: false},
		{name: "paid to no show", current: "paid", next: "no_show", wantErr: false},
		{name: "paid to rejected allowed for admin override", current: "paid", next: "rejected", wantErr: false},
		{name: "terminal rejected to rejected", current: "rejected", next: "rejected", wantErr: false},
		{name: "terminal cancelled to approved allowed for admin override", current: "cancelled", next: "approved", wantErr: false},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validateTelegramApplicationStatusTransition(tt.current, tt.next)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}
