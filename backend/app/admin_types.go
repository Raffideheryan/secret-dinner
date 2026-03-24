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

type rateLimitState struct {
	count   int
	resetAt int64
}

const adminUsernameLocalsKey = "admin_username"
