import "./join.css"
import { useRef, useState, type SubmitEvent } from "react";
import type { JoinForm, JoinPayload } from "./types";
import { Link, useNavigate } from "react-router-dom"
import BlinkingParticles from "../common/BlinkingParticles";
import { submitMainInfo } from "./ApplicationSubmit";


export default function Join() {
    const navigate = useNavigate();
    const formStartedAt = useRef<number>(Date.now());

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

    const validateForm = () => {
        const errors: Partial<Record<keyof JoinForm, string>> = {};

        if (!form.fullName.trim()) errors.fullName = "Full Name is required.";
        if (!form.email.trim()) errors.email = "Email is required.";
        if (!form.phone.trim()) errors.phone = "Phone is required.";
        if (!form.hobbies.trim()) errors.hobbies = "Hobbies is required.";

        const guestCount = Number(form.guestCount);
        if (!form.guestCount.trim()) {
            errors.guestCount = "Guests Count is required.";
        } else if (!Number.isInteger(guestCount) || guestCount <= 0) {
            errors.guestCount = "Guests Count must be at least 1.";
        }

        return errors;
    };

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setFormAlert("Please fill all required fields.");
            return;
        }

        setFieldErrors({});
        setFormAlert("");

        const guestCount = Number(form.guestCount);
        if (!Number.isInteger(guestCount) || guestCount <= 0) {
            setFieldErrors({ guestCount: "Guests Count must be at least 1." });
            setFormAlert("Please fill all required fields.");
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
            sessionStorage.setItem("joinUserId", response.userId);
            sessionStorage.setItem("joinFormCompleted", "true");
            navigate("/join/dinners");
        } catch (e) {
            setFormAlert(e instanceof Error ? e.message : "Failed to submit application.");
        }
    };

    const handleChange = (field: keyof JoinForm, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
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
            <BlinkingParticles overlayClassName="join__overlay" particleClassName="join__particle" />
            <div className="join__content">     
                <form className="join__form-card" onSubmit={handleSubmit}>
                    <div className="join__logo-wrap">
                        <img className="join__logo" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    </div>
                    {formAlert && <p className="join__form-alert" role="alert">{formAlert}</p>}

                    <label className="join__label" htmlFor="join-full-name">Full Name</label>
                    <input
                        id="join-full-name"
                        className={`join__input ${fieldErrors.fullName ? "join__input--error" : ""}`}
                        type="text"
                        placeholder="John Doe"
                        value={form.fullName}
                        onChange={(e) => handleChange("fullName", e.target.value)}
                    />
                    {fieldErrors.fullName && <p className="join__field-error">{fieldErrors.fullName}</p>}

                    <label className="join__label" htmlFor="join-email">Email</label>
                    <input
                        id="join-email"
                        className={`join__input ${fieldErrors.email ? "join__input--error" : ""}`}
                        type="email"
                        placeholder="john.doe@example.com"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                    />
                    {fieldErrors.email && <p className="join__field-error">{fieldErrors.email}</p>}

                    <label className="join__label" htmlFor="join-phone">Phone</label>
                    <input
                        id="join-phone"
                        className={`join__input ${fieldErrors.phone ? "join__input--error" : ""}`}
                        type="tel"
                        placeholder="+1 555 123 4567"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                    />
                    {fieldErrors.phone && <p className="join__field-error">{fieldErrors.phone}</p>}

                    <label className="join__label" htmlFor="join-guest-count">Guests Count</label>
                    <input
                        id="join-guest-count"
                        className={`join__input ${fieldErrors.guestCount ? "join__input--error" : ""}`}
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1"
                        value={form.guestCount}
                        onChange={(e) => handleChange("guestCount", e.target.value)}
                    />
                    {fieldErrors.guestCount && <p className="join__field-error">{fieldErrors.guestCount}</p>}

                    <label className="join__label" htmlFor="join-hobbies">Hobbies</label>
                    <input
                        id="join-hobbies"
                        className={`join__input ${fieldErrors.hobbies ? "join__input--error" : ""}`}
                        type="text"
                        placeholder="Networking, travel, wine..."
                        value={form.hobbies}
                        onChange={(e) => handleChange("hobbies", e.target.value)}
                    />
                    {fieldErrors.hobbies && <p className="join__field-error">{fieldErrors.hobbies}</p>}

                    <label className="join__label" htmlFor="join-allergies">Allergies</label>
                    <input
                        id="join-allergies"
                        className="join__input"
                        type="text"
                        placeholder="Optional"
                        value={form.allergies ?? ""}
                        onChange={(e) => handleChange("allergies", e.target.value)}
                    />

                    <div className="join__actions">
                        <Link className="join__btn join__btn--back" to="/">Back</Link>
                        <button className="join__btn join__btn--primary" type="submit">Continue</button>
                    </div>
                </form>
                
            </div>

        </section>
    )
}
