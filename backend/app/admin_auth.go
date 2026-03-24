package app

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"secret-dinner/config"
)

type adminAuthService struct {
	cfg config.AdminConfig
}

func newAdminAuthService(cfg config.AdminConfig) *adminAuthService {
	return &adminAuthService{cfg: cfg}
}

func (a *adminAuthService) validateCredentials(username, password string) bool {
	userOK := subtle.ConstantTimeCompare([]byte(username), []byte(a.cfg.Username)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(password), []byte(a.cfg.Password)) == 1
	return userOK && passOK
}

func (a *adminAuthService) issueToken() (string, time.Time, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(a.cfg.TokenTTLMin) * time.Minute)

	claims := adminTokenClaims{
		Sub: a.cfg.Username,
		Exp: expiresAt.Unix(),
		Iat: now.Unix(),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", time.Time{}, err
	}

	payloadEncoded := base64.RawURLEncoding.EncodeToString(payload)
	signature := signToken(payloadEncoded, a.cfg.AuthSecret)

	return payloadEncoded + "." + signature, expiresAt, nil
}

func (a *adminAuthService) validateToken(token string) (*adminTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, errors.New("invalid token format")
	}

	payloadEncoded := parts[0]
	signature := parts[1]

	expectedSignature := signToken(payloadEncoded, a.cfg.AuthSecret)
	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return nil, errors.New("invalid token signature")
	}

	payload, err := base64.RawURLEncoding.DecodeString(payloadEncoded)
	if err != nil {
		return nil, err
	}

	var claims adminTokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}
	if claims.Sub == "" || claims.Exp == 0 {
		return nil, errors.New("invalid token claims")
	}
	if time.Now().UTC().Unix() > claims.Exp {
		return nil, errors.New("token expired")
	}

	return &claims, nil
}

func signToken(payload, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
