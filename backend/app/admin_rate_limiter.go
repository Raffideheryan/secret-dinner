package app

import (
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

type loginRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]rateLimitState
	limit    int
	window   time.Duration
}

func newLoginRateLimiter(limit int, window time.Duration) *loginRateLimiter {
	return &loginRateLimiter{
		attempts: make(map[string]rateLimitState),
		limit:    limit,
		window:   window,
	}
}

func (l *loginRateLimiter) middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !l.allow(c.IP()) {
			c.Set("Retry-After", strconv.Itoa(int(l.window.Seconds())))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "too many login attempts",
			})
		}
		return c.Next()
	}
}

func (l *loginRateLimiter) allow(ip string) bool {
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

	if state.count >= l.limit {
		return false
	}

	state.count++
	l.attempts[ip] = state
	return true
}

func (l *loginRateLimiter) reset(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, ip)
}
