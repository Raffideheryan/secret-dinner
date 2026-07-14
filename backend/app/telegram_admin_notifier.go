package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"secret-dinner/routes"
)

func (l *landingApp) notifyAdminsAboutLandingJoin(event routes.LandingJoinCreatedNotification) {
	if event.UserID == "" {
		return
	}
	if err := l.sendTelegramAdminNotification(buildLandingJoinCreatedMessage(event)); err != nil {
		log.WithError(err).WithField("landing_user_id", event.UserID).Warn("Failed to notify admins about landing registration")
	}
}

func (l *landingApp) notifyAdminsAboutLandingSelection(event routes.LandingJoinSelectionNotification) {
	if event.UserID == "" || event.DinnerID <= 0 {
		return
	}
	if err := l.sendTelegramAdminNotification(l.buildLandingSelectionMessage(event)); err != nil {
		log.WithError(err).WithFields(map[string]any{
			"landing_user_id": event.UserID,
			"dinner_id":       event.DinnerID,
		}).Warn("Failed to notify admins about landing dinner selection")
	}
}

func (l *landingApp) sendTelegramAdminNotification(message string) error {
	token := strings.TrimSpace(l.cfg.Telegram.BotToken)
	adminIDs := l.cfg.Telegram.AdminIDs
	if token == "" || len(adminIDs) == 0 || strings.TrimSpace(message) == "" {
		return nil
	}
	payloadBody, err := json.Marshal(telegramBotMessageRequest{
		Text:                  message,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	})
	if err != nil {
		return err
	}
	for _, adminID := range adminIDs {
		payload := append([]byte(nil), payloadBody...)
		var request telegramBotMessageRequest
		if err := json.Unmarshal(payload, &request); err != nil {
			return err
		}
		request.ChatID = adminID
		body, err := json.Marshal(request)
		if err != nil {
			return err
		}
		ctx, cancel := context.WithTimeout(l.ctx, 5*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token), bytes.NewReader(body))
		if err != nil {
			cancel()
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		cancel()
		if err != nil {
			return err
		}
		func() {
			defer resp.Body.Close()
			if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
				body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
				err = fmt.Errorf("telegram admin sendMessage failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
			}
		}()
		if err != nil {
			return err
		}
	}
	return nil
}

func buildLandingJoinCreatedMessage(event routes.LandingJoinCreatedNotification) string {
	hobbies := strings.TrimSpace(event.User.Hobbies)
	if hobbies == "" {
		hobbies = "—"
	}
	allergies := strings.TrimSpace(event.User.Allergies)
	if allergies == "" {
		allergies = "—"
	}
	return fmt.Sprintf(
		"📝 <b>New landing registration</b>\n\n<b>ID:</b> <code>%s</code>\n<b>Name:</b> %s\n<b>Email:</b> %s\n<b>Phone:</b> %s\n<b>Guests:</b> %d\n<b>Hobbies:</b> %s\n<b>Allergies:</b> %s",
		escapeTelegramHTML(event.UserID),
		escapeTelegramHTML(strings.TrimSpace(event.User.FullName)),
		escapeTelegramHTML(strings.TrimSpace(event.User.Email)),
		escapeTelegramHTML(strings.TrimSpace(event.User.Phone)),
		event.User.GuestCount,
		escapeTelegramHTML(hobbies),
		escapeTelegramHTML(allergies),
	)
}

func (l *landingApp) buildLandingSelectionMessage(event routes.LandingJoinSelectionNotification) string {
	dinnerLabel := fmt.Sprintf("Dinner #%d", event.DinnerID)
	if l.connections.Dinners != nil {
		if dinners, err := l.connections.Dinners.GetAdminDinners(); err == nil {
			for _, dinner := range dinners {
				if dinner.ID == event.DinnerID {
					dateLabel := dinner.DinnerDate.Format("2006-01-02")
					dinnerLabel = fmt.Sprintf("%s (%s)", strings.TrimSpace(dinner.Description), dateLabel)
					break
				}
			}
		}
	}
	packageSummary := strings.TrimSpace(event.ChosenPackage)
	if len(event.GuestPackages) > 0 {
		packageSummary = strings.Join(event.GuestPackages, ", ")
	}
	packageSummary = strings.ToUpper(packageSummary)
	return fmt.Sprintf(
		"✅ <b>Landing application finalized</b>\n\n<b>User ID:</b> <code>%s</code>\n<b>Dinner:</b> %s\n<b>Packages:</b> %s",
		escapeTelegramHTML(event.UserID),
		escapeTelegramHTML(dinnerLabel),
		escapeTelegramHTML(packageSummary),
	)
}

func escapeTelegramHTML(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
	)
	return replacer.Replace(value)
}

func normalizeLandingStoredPackages(chosenPackage string, guestPackages []string) []string {
	if len(guestPackages) > 0 {
		items := make([]string, 0, len(guestPackages))
		for _, pkg := range guestPackages {
			normalized := strings.ToLower(strings.TrimSpace(pkg))
			if normalized != "" {
				items = append(items, normalized)
			}
		}
		return items
	}
	normalized := strings.ToLower(strings.TrimSpace(chosenPackage))
	if normalized == "" {
		return nil
	}
	if strings.Contains(normalized, "guest_") {
		parts := strings.Split(normalized, ",")
		items := make([]string, 0, len(parts))
		for _, part := range parts {
			segment := strings.TrimSpace(part)
			if segment == "" {
				continue
			}
			pkg, ok := strings.CutPrefix(segment, "guest_")
			if !ok {
				continue
			}
			_, after, found := strings.Cut(pkg, ":")
			if found && after != "" {
				items = append(items, strings.ToLower(strings.TrimSpace(after)))
			}
		}
		return items
	}
	return []string{normalized}
}
