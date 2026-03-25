package routes

import (
	"errors"
	"net/mail"
	"strings"
)

const minJoinFormFillDurationMs int64 = 3000

var disposableEmailDomains = map[string]struct{}{
	"10minutemail.com":   {},
	"10minutemail.net":   {},
	"20minutemail.com":   {},
	"dispostable.com":    {},
	"dropmail.me":        {},
	"emailondeck.com":    {},
	"fakeinbox.com":      {},
	"getairmail.com":     {},
	"getnada.com":        {},
	"guerrillamail.com":  {},
	"guerrillamail.net":  {},
	"inboxbear.com":      {},
	"mail.tm":            {},
	"maildrop.cc":        {},
	"mailinator.com":     {},
	"mailnesia.com":      {},
	"mohmal.com":         {},
	"mytemp.email":       {},
	"sharklasers.com":    {},
	"temp-mail.io":       {},
	"temp-mail.org":      {},
	"tempail.com":        {},
	"tempmail.email":     {},
	"tempmailo.com":      {},
	"temporary-mail.net": {},
	"throwawaymail.com":  {},
	"trashmail.com":      {},
	"yopmail.com":        {},
}

func normalizeEmail(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", errors.New("empty email")
	}

	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", err
	}

	normalized := strings.ToLower(strings.TrimSpace(addr.Address))
	parts := strings.Split(normalized, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", errors.New("invalid email")
	}

	return normalized, nil
}

func isDisposableEmail(email string) bool {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 {
		return true
	}
	domain := parts[1]
	if domain == "" {
		return true
	}

	if _, ok := disposableEmailDomains[domain]; ok {
		return true
	}

	for blocked := range disposableEmailDomains {
		if strings.HasSuffix(domain, "."+blocked) {
			return true
		}
	}

	return false
}
