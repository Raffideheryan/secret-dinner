package app

import (
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ipRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]rateLimitState
	limit    int
	window   time.Duration
	message  string
	limitFn  func() int
}

func newIPRateLimiter(limit int, window time.Duration, message string, limitFn func() int) *ipRateLimiter {
	return &ipRateLimiter{
		attempts: make(map[string]rateLimitState),
		limit:    limit,
		window:   window,
		message:  message,
		limitFn:  limitFn,
	}
}

func (l *ipRateLimiter) middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.allow(c.IP()) {
			c.Set("Retry-After", strconv.Itoa(int(l.window.Seconds())))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   true,
				"message": l.message,
			})
		}
		return c.Next()
	}
}

func (l *ipRateLimiter) allow(ip string) bool {
	limit := l.limit
	if l.limitFn != nil {
		if dynamic := l.limitFn(); dynamic > 0 {
			limit = dynamic
		}
	}

	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	state, ok := l.attempts[ip]
	if !ok || now.Unix() > state.resetAt {
		l.attempts[ip] = rateLimitState{
			count:   1,
			resetAt: now.Add(l.window).Unix(),
		}
		return true
	}

	if state.count >= limit {
		return false
	}

	state.count++
	l.attempts[ip] = state
	return true
}
