import "./join.css"
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { JoinForm, JoinPayload } from "./types";
import { Link, useNavigate } from "react-router-dom"
import BlinkingParticles from "../common/BlinkingParticles";
import { submitMainInfo } from "./ApplicationSubmit";
import { useI18n } from "../../i18n";
import { rememberLandingUserId, trackLandingError, trackLandingEvent } from "../../activity/tracker";
import SeoHead from "../SEO/SeoHead";


export default function Join() {
    const navigate = useNavigate();
    const formStartedAt = useRef<number>(Date.now());
    const { t } = useI18n();

    const [form, setForm] = useState<JoinForm> ({
        fullName: "",
        email: "",
        phone: "",
        guestCount: "1",
        hobbies: "",
        allergies: "",
    });
    const [formAlert, setFormAlert] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof JoinForm, string>>>({});

    useEffect(() => {
        trackLandingEvent("landing_form_started");
    }, []);

    const validateForm = () => {
        const errors: Partial<Record<keyof JoinForm, string>> = {};

        if (!form.fullName.trim()) errors.fullName = t("join.error.required.fullName");
        if (!form.email.trim()) errors.email = t("join.error.required.email");
        if (!form.phone.trim()) errors.phone = t("join.error.required.phone");
        if (!form.hobbies.trim()) errors.hobbies = t("join.error.required.hobbies");

        const guestCount = Number(form.guestCount);
        if (!form.guestCount.trim()) {
            errors.guestCount = t("join.error.required.guests");
        } else if (!Number.isInteger(guestCount) || guestCount <= 0) {
            errors.guestCount = t("join.error.guestsMin");
        }

        return errors;
    };

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            trackLandingEvent("landing_form_validation_failed", {
                fields: Object.keys(errors),
            });
            setFieldErrors(errors);
            setFormAlert(t("join.step1.alertRequired"));
            return;
        }

        setFieldErrors({});
        setFormAlert("");

        const guestCount = Number(form.guestCount);
        if (!Number.isInteger(guestCount) || guestCount <= 0) {
            trackLandingEvent("landing_guest_count_invalid", {
                rawGuestCount: form.guestCount,
            });
            setFieldErrors({ guestCount: t("join.error.guestsMin") });
            setFormAlert(t("join.step1.alertRequired"));
            return;
        }

        const payload: JoinPayload = {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            guestCount,
            fillDurationMs: Date.now() - formStartedAt.current,
            hobbies: form.hobbies.split(",").map((x) => x.trim()).filter(Boolean),
            allergies: (form.allergies ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        };

        try {
            const response = await submitMainInfo(payload);
            rememberLandingUserId(response.userId);
            sessionStorage.setItem("joinUserId", response.userId);
            sessionStorage.setItem("joinFormCompleted", "true");
            sessionStorage.setItem("joinGuestCount", String(guestCount));
            trackLandingEvent("landing_form_submitted", {
                guestCount,
                fillDurationMs: payload.fillDurationMs,
            }, { userId: response.userId });
            navigate("/join/dinners");
        } catch (e) {
            trackLandingError("landing_form_submit_error", e, {
                guestCount,
            });
            setFormAlert(e instanceof Error ? e.message : t("join.error.submitFailed"));
        }
    };

    const handleChange = (field: keyof JoinForm, value: string) => {
        const previousValue = form[field];
        setForm((prev) => ({ ...prev, [field]: value }));
        if (previousValue === "" && value.trim() !== "") {
            trackLandingEvent("landing_form_field_started", {
                field,
            });
        }
        if (field === "guestCount" && previousValue !== value && value.trim() !== "") {
            trackLandingEvent("landing_guest_count_changed", {
                value,
            });
        }
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
        if (formAlert) {
            setFormAlert("");
        }
    };

    return (
        <section className="join" id="join">
            <SeoHead
                title="Join Secret Dinner"
                description="Apply for a Secret Dinner invitation and reserve your place for an exclusive private dining experience."
                noindex
            />
            <BlinkingParticles overlayClassName="join__overlay" particleClassName="join__particle" />
            <div className="join__content">     
                <form className="join__form-card" onSubmit={handleSubmit}>
                    <div className="join__logo-wrap">
                        <img className="join__logo" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    </div>
                    {formAlert && <p className="join__form-alert" role="alert">{formAlert}</p>}

                    <label className="join__label" htmlFor="join-full-name">{t("join.step1.field.fullName")}</label>
                    <input
                        id="join-full-name"
                        className={`join__input ${fieldErrors.fullName ? "join__input--error" : ""}`}
                        type="text"
                        placeholder={t("join.step1.placeholder.fullName")}
                        value={form.fullName}
                        onChange={(e) => handleChange("fullName", e.target.value)}
                    />
                    {fieldErrors.fullName && <p className="join__field-error">{fieldErrors.fullName}</p>}

                    <label className="join__label" htmlFor="join-email">{t("join.step1.field.email")}</label>
                    <input
                        id="join-email"
                        className={`join__input ${fieldErrors.email ? "join__input--error" : ""}`}
                        type="email"
                        placeholder={t("join.step1.placeholder.email")}
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                    />
                    {fieldErrors.email && <p className="join__field-error">{fieldErrors.email}</p>}

                    <label className="join__label" htmlFor="join-phone">{t("join.step1.field.phone")}</label>
                    <input
                        id="join-phone"
                        className={`join__input ${fieldErrors.phone ? "join__input--error" : ""}`}
                        type="tel"
                        placeholder={t("join.step1.placeholder.phone")}
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                    />
                    {fieldErrors.phone && <p className="join__field-error">{fieldErrors.phone}</p>}

                    <label className="join__label" htmlFor="join-guest-count">{t("join.step1.field.guests")}</label>
                    <input
                        id="join-guest-count"
                        className={`join__input ${fieldErrors.guestCount ? "join__input--error" : ""}`}
                        type="number"
                        min={1}
                        step={1}
                        placeholder={t("join.step1.placeholder.guests")}
                        value={form.guestCount}
                        onChange={(e) => handleChange("guestCount", e.target.value)}
                    />
                    {fieldErrors.guestCount && <p className="join__field-error">{fieldErrors.guestCount}</p>}

                    <label className="join__label" htmlFor="join-hobbies">{t("join.step1.field.hobbies")}</label>
                    <input
                        id="join-hobbies"
                        className={`join__input ${fieldErrors.hobbies ? "join__input--error" : ""}`}
                        type="text"
                        placeholder={t("join.step1.placeholder.hobbies")}
                        value={form.hobbies}
                        onChange={(e) => handleChange("hobbies", e.target.value)}
                    />
                    {fieldErrors.hobbies && <p className="join__field-error">{fieldErrors.hobbies}</p>}

                    <label className="join__label" htmlFor="join-allergies">{t("join.step1.field.allergies")}</label>
                    <input
                        id="join-allergies"
                        className="join__input"
                        type="text"
                        placeholder={t("join.step1.placeholder.allergies")}
                        value={form.allergies ?? ""}
                        onChange={(e) => handleChange("allergies", e.target.value)}
                    />

                    <div className="join__actions">
                        <Link className="join__btn join__btn--back" to="/">{t("join.step1.back")}</Link>
                        <button className="join__btn join__btn--primary" type="submit">{t("join.step1.continue")}</button>
                    </div>
                </form>
                
            </div>

        </section>
    )
}
