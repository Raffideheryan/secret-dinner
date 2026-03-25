package app

import (
	"secret-dinner/config"
	"sync"
)

const (
	defaultAdminLoginPerMinute       = 10
	defaultJoinFormPer20MinByIP      = 5
	defaultJoinSelectionPer20MinByIP = 5
	defaultMinJoinFillDurationMs     = 3000
	defaultPanelAutoRefreshSeconds   = 0
	defaultAdminUsersPageSize        = 30
)

type runtimeAdminSettingsSnapshot struct {
	AdminTokenTTLMinutes      int   `json:"adminTokenTTLMinutes"`
	AdminLoginPerMinute       int   `json:"adminLoginPerMinute"`
	JoinFormPer20MinByIP      int   `json:"joinFormPer20MinByIP"`
	JoinSelectionPer20MinByIP int   `json:"joinSelectionPer20MinByIP"`
	MinJoinFormFillDurationMs int64 `json:"minJoinFormFillDurationMs"`
	PanelAutoRefreshSeconds   int   `json:"panelAutoRefreshSeconds"`
	AdminUsersPageSize        int   `json:"adminUsersPageSize"`
	MaintenanceMode           bool  `json:"maintenanceMode"`
	AllowJoinApplications     bool  `json:"allowJoinApplications"`
	AllowJoinSelections       bool  `json:"allowJoinSelections"`
	AllowAdminDinnerMutations bool  `json:"allowAdminDinnerMutations"`
	AllowAdminUserStatusEdits bool  `json:"allowAdminUserStatusEdits"`
}

type runtimeAdminSettingsUpdate struct {
	AdminTokenTTLMinutes      *int
	AdminLoginPerMinute       *int
	JoinFormPer20MinByIP      *int
	JoinSelectionPer20MinByIP *int
	MinJoinFormFillDurationMs *int64
	PanelAutoRefreshSeconds   *int
	AdminUsersPageSize        *int
	MaintenanceMode           *bool
	AllowJoinApplications     *bool
	AllowJoinSelections       *bool
	AllowAdminDinnerMutations *bool
	AllowAdminUserStatusEdits *bool
}

type runtimeAdminSettings struct {
	mu sync.RWMutex

	adminTokenTTLMinutes      int
	adminLoginPerMinute       int
	joinFormPer20MinByIP      int
	joinSelectionPer20MinByIP int
	minJoinFormFillDurationMs int64
	panelAutoRefreshSeconds   int
	adminUsersPageSize        int
	maintenanceMode           bool
	allowJoinApplications     bool
	allowJoinSelections       bool
	allowAdminDinnerMutations bool
	allowAdminUserStatusEdits bool
}

func newRuntimeAdminSettings(cfg config.Config) *runtimeAdminSettings {
	return &runtimeAdminSettings{
		adminTokenTTLMinutes:      cfg.Admin.TokenTTLMin,
		adminLoginPerMinute:       defaultAdminLoginPerMinute,
		joinFormPer20MinByIP:      defaultJoinFormPer20MinByIP,
		joinSelectionPer20MinByIP: defaultJoinSelectionPer20MinByIP,
		minJoinFormFillDurationMs: defaultMinJoinFillDurationMs,
		panelAutoRefreshSeconds:   defaultPanelAutoRefreshSeconds,
		adminUsersPageSize:        defaultAdminUsersPageSize,
		maintenanceMode:           false,
		allowJoinApplications:     true,
		allowJoinSelections:       true,
		allowAdminDinnerMutations: true,
		allowAdminUserStatusEdits: true,
	}
}

func (s *runtimeAdminSettings) GetAdminTokenTTLMinutes() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.adminTokenTTLMinutes
}

func (s *runtimeAdminSettings) GetAdminLoginPerMinute() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.adminLoginPerMinute
}

func (s *runtimeAdminSettings) GetJoinFormPer20MinByIP() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.joinFormPer20MinByIP
}

func (s *runtimeAdminSettings) GetJoinSelectionPer20MinByIP() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.joinSelectionPer20MinByIP
}

func (s *runtimeAdminSettings) MinJoinFormFillDurationMs() int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.minJoinFormFillDurationMs
}

func (s *runtimeAdminSettings) PanelAutoRefreshSeconds() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.panelAutoRefreshSeconds
}

func (s *runtimeAdminSettings) AdminUsersPageSize() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.adminUsersPageSize
}

func (s *runtimeAdminSettings) MaintenanceMode() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.maintenanceMode
}

func (s *runtimeAdminSettings) AllowJoinApplications() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.allowJoinApplications
}

func (s *runtimeAdminSettings) AllowJoinSelections() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.allowJoinSelections
}

func (s *runtimeAdminSettings) AllowAdminDinnerMutations() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.allowAdminDinnerMutations
}

func (s *runtimeAdminSettings) AllowAdminUserStatusEdits() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.allowAdminUserStatusEdits
}

func (s *runtimeAdminSettings) Snapshot() runtimeAdminSettingsSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return runtimeAdminSettingsSnapshot{
		AdminTokenTTLMinutes:      s.adminTokenTTLMinutes,
		AdminLoginPerMinute:       s.adminLoginPerMinute,
		JoinFormPer20MinByIP:      s.joinFormPer20MinByIP,
		JoinSelectionPer20MinByIP: s.joinSelectionPer20MinByIP,
		MinJoinFormFillDurationMs: s.minJoinFormFillDurationMs,
		PanelAutoRefreshSeconds:   s.panelAutoRefreshSeconds,
		AdminUsersPageSize:        s.adminUsersPageSize,
		MaintenanceMode:           s.maintenanceMode,
		AllowJoinApplications:     s.allowJoinApplications,
		AllowJoinSelections:       s.allowJoinSelections,
		AllowAdminDinnerMutations: s.allowAdminDinnerMutations,
		AllowAdminUserStatusEdits: s.allowAdminUserStatusEdits,
	}
}

func (s *runtimeAdminSettings) Apply(update runtimeAdminSettingsUpdate) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if update.AdminTokenTTLMinutes != nil {
		s.adminTokenTTLMinutes = *update.AdminTokenTTLMinutes
	}
	if update.AdminLoginPerMinute != nil {
		s.adminLoginPerMinute = *update.AdminLoginPerMinute
	}
	if update.JoinFormPer20MinByIP != nil {
		s.joinFormPer20MinByIP = *update.JoinFormPer20MinByIP
	}
	if update.JoinSelectionPer20MinByIP != nil {
		s.joinSelectionPer20MinByIP = *update.JoinSelectionPer20MinByIP
	}
	if update.MinJoinFormFillDurationMs != nil {
		s.minJoinFormFillDurationMs = *update.MinJoinFormFillDurationMs
	}
	if update.PanelAutoRefreshSeconds != nil {
		s.panelAutoRefreshSeconds = *update.PanelAutoRefreshSeconds
	}
	if update.AdminUsersPageSize != nil {
		s.adminUsersPageSize = *update.AdminUsersPageSize
	}
	if update.MaintenanceMode != nil {
		s.maintenanceMode = *update.MaintenanceMode
	}
	if update.AllowJoinApplications != nil {
		s.allowJoinApplications = *update.AllowJoinApplications
	}
	if update.AllowJoinSelections != nil {
		s.allowJoinSelections = *update.AllowJoinSelections
	}
	if update.AllowAdminDinnerMutations != nil {
		s.allowAdminDinnerMutations = *update.AllowAdminDinnerMutations
	}
	if update.AllowAdminUserStatusEdits != nil {
		s.allowAdminUserStatusEdits = *update.AllowAdminUserStatusEdits
	}
}
