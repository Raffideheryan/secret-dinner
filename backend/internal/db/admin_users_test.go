package db

import (
	"errors"
	"testing"
)

func TestErrLandingCompletedRequiresDinnerAndPackage_IsSentinel(t *testing.T) {
	t.Parallel()

	// Verify the error is exported and can be used with errors.Is for HTTP
	// handler detection without string comparison.
	wrapped := errors.Join(ErrLandingCompletedRequiresDinnerAndPackage)
	if !errors.Is(wrapped, ErrLandingCompletedRequiresDinnerAndPackage) {
		t.Fatal("errors.Is did not match wrapped ErrLandingCompletedRequiresDinnerAndPackage")
	}
}

func TestErrLandingCompletedRequiresDinnerAndPackage_Message(t *testing.T) {
	t.Parallel()

	msg := ErrLandingCompletedRequiresDinnerAndPackage.Error()
	if msg == "" {
		t.Fatal("error message must not be empty")
	}
}
