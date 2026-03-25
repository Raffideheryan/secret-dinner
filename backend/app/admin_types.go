package app

type adminTokenClaims struct {
	Sub string `json:"sub"`
	Exp int64  `json:"exp"`
	Iat int64  `json:"iat"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type updateAdminSettingsRequest struct {
	AdminTokenTTLMinutes      *int   `json:"adminTokenTTLMinutes"`
	AdminLoginPerMinute       *int   `json:"adminLoginPerMinute"`
	JoinFormPer20MinByIP      *int   `json:"joinFormPer20MinByIP"`
	JoinSelectionPer20MinByIP *int   `json:"joinSelectionPer20MinByIP"`
	MinJoinFormFillDurationMs *int64 `json:"minJoinFormFillDurationMs"`
	PanelAutoRefreshSeconds   *int   `json:"panelAutoRefreshSeconds"`
	AdminUsersPageSize        *int   `json:"adminUsersPageSize"`
	MaintenanceMode           *bool  `json:"maintenanceMode"`
	AllowJoinApplications     *bool  `json:"allowJoinApplications"`
	AllowJoinSelections       *bool  `json:"allowJoinSelections"`
	AllowAdminDinnerMutations *bool  `json:"allowAdminDinnerMutations"`
	AllowAdminUserStatusEdits *bool  `json:"allowAdminUserStatusEdits"`
}

type rateLimitState struct {
	count   int
	resetAt int64
}

const adminUsernameLocalsKey = "admin_username"
