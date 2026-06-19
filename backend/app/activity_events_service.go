package app

import "secret-dinner/internal/db"

type userActivityStoreError struct {
	err error
}

func (e *userActivityStoreError) Error() string {
	return e.err.Error()
}

func (e *userActivityStoreError) Unwrap() error {
	return e.err
}

type userActivityService struct {
	store db.ActivityEventsDB
}

func newUserActivityService(store db.ActivityEventsDB) *userActivityService {
	return &userActivityService{store: store}
}

func (s *userActivityService) Store(events []activityEventPayload, ctx activityRequestContext) (int64, error) {
	insertable, err := normalizeActivityEvents(events, ctx)
	if err != nil {
		return 0, err
	}
	inserted, err := s.store.InsertUserActivityEvents(insertable)
	if err != nil {
		return 0, &userActivityStoreError{err: err}
	}
	return inserted, nil
}
