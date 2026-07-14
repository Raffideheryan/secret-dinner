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

	"secret-dinner/internal/db"
)

type telegramBotMessageRequest struct {
	ChatID                int64  `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode,omitempty"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview,omitempty"`
}

func (l *landingApp) deliverTelegramBookingNotification(item db.TelegramBookingStatusNotification) error {
	token := strings.TrimSpace(l.cfg.Telegram.BotToken)
	if token == "" {
		return fmt.Errorf("telegram bot token is not configured")
	}
	message := buildTelegramBookingStatusMessage(item.Language, item.PublicCode, item.Status)
	if strings.TrimSpace(message) == "" {
		return nil
	}
	payload, err := json.Marshal(telegramBotMessageRequest{
		ChatID:                item.UserID,
		Text:                  message,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(l.ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("telegram sendMessage failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func buildTelegramBookingStatusMessage(language, publicCode, status string) string {
	code := strings.TrimSpace(publicCode)
	if code == "" {
		code = "—"
	}
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "approved":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your reservation request has been approved.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nOur team will contact you with the next steps soon.",
			"<b>Ձեր ամրագրման հայտը հաստատվել է։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nՄեր թիմը շուտով կկապվի ձեզ հետ հաջորդ քայլերի համար։",
			"<b>Ваша заявка на бронирование одобрена.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nНаша команда скоро свяжется с вами по следующим шагам.",
		), code)
	case "rejected":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your reservation request was not approved this time.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nYou can contact our team if you have questions.",
			"<b>Ձեր ամրագրման հայտը այս անգամ չի հաստատվել։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nՀարցերի դեպքում կարող եք կապ հաստատել մեր թիմի հետ։",
			"<b>Ваша заявка на бронирование в этот раз не была одобрена.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nЕсли у вас есть вопросы, вы можете связаться с нашей командой.",
		), code)
	case "waiting_payment":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your reservation request is approved pending payment.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nOur team will contact you with payment instructions.",
			"<b>Ձեր ամրագրման հայտը հաստատված է և սպասում է վճարման։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nՄեր թիմը կկապվի ձեզ հետ վճարման մանրամասներով։",
			"<b>Ваша заявка на бронирование одобрена и ожидает оплаты.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nНаша команда свяжется с вами с инструкциями по оплате.",
		), code)
	case "paid":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your payment has been confirmed.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nWe look forward to seeing you at dinner.",
			"<b>Ձեր վճարումը հաստատվել է։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nՍպասում ենք ձեզ ընթրիքի ժամանակ։",
			"<b>Ваш платеж подтвержден.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nБудем рады видеть вас на ужине.",
		), code)
	case "cancelled":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your reservation has been cancelled.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nContact our team if you need help with another booking.",
			"<b>Ձեր ամրագրումը չեղարկվել է։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nԵթե օգնության կարիք ունեք նոր ամրագրման համար, կապ հաստատեք մեր թիմի հետ։",
			"<b>Ваше бронирование отменено.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nЕсли нужна помощь с новым бронированием, свяжитесь с нашей командой.",
		), code)
	case "no_show":
		return fmt.Sprintf(localizedBookingStatusMessage(language,
			"<b>Your reservation was marked as no-show.</b>\n🔐 <b>Secret Key:</b> <code>%s</code>\nContact our team if you think this was a mistake.",
			"<b>Ձեր ամրագրումը նշվել է որպես չմասնակցած։</b>\n🔐 <b>Գաղտնի բանալի՝</b> <code>%s</code>\nԵթե կարծում եք, որ սա սխալ է, կապ հաստատեք մեր թիմի հետ։",
			"<b>Ваше бронирование отмечено как неиспользованное посещение.</b>\n🔐 <b>Секретный ключ:</b> <code>%s</code>\nСвяжитесь с нашей командой, если это ошибка.",
		), code)
	default:
		return ""
	}
}

func localizedBookingStatusMessage(language, english, armenian, russian string) string {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case "armenian", "hy", "am":
		return armenian
	case "russian", "ru":
		return russian
	default:
		return english
	}
}
