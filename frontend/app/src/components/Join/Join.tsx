import "./join.css"
import { useState, type SubmitEvent } from "react";
import type { JoinForm, JoinPayload } from "./types";
import { Link, useNavigate } from "react-router-dom"
import BlinkingParticles from "../common/BlinkingParticles";
import { submitMainInfo } from "./ApplicationSubmit";


export default function Join() {
    const navigate = useNavigate();

    const [form, setForm] = useState<JoinForm> ({
        fullName: "",
        email: "",
        phone: "",
        guestCount: "1",
        hobbies: "",
        allergies: "",
    });

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const guestCount = Number(form.guestCount);
        if (!Number.isInteger(guestCount) || guestCount <= 0) {
            return;
        }

        const payload: JoinPayload = {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            guestCount,
            hobbies: form.hobbies.split(",").map((x) => x.trim()).filter(Boolean),
            allergies: (form.allergies ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        };

        await submitMainInfo(payload);
        sessionStorage.setItem("joinFormCompleted", "true");
        navigate("/join/dinners");
    };

    return (
        <section className="join" id="join">
            <BlinkingParticles overlayClassName="join__overlay" particleClassName="join__particle" />
            <div className="join__content">     
                <form className="join__form-card" onSubmit={handleSubmit}>
                    <div className="join__logo-wrap">
                        <img className="join__logo" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    </div>

                    <label className="join__label" htmlFor="join-full-name">Full Name</label>
                    <input
                        id="join-full-name"
                        className="join__input"
                        type="text"
                        placeholder="John Doe"
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        required
                    />

                    <label className="join__label" htmlFor="join-email">Email</label>
                    <input
                        id="join-email"
                        className="join__input"
                        type="email"
                        placeholder="john.doe@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                    />

                    <label className="join__label" htmlFor="join-phone">Phone</label>
                    <input
                        id="join-phone"
                        className="join__input"
                        type="tel"
                        placeholder="+1 555 123 4567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required
                    />

                    <label className="join__label" htmlFor="join-guest-count">Guests Count</label>
                    <input
                        id="join-guest-count"
                        className="join__input"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1"
                        value={form.guestCount}
                        onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                        required
                    />

                    <label className="join__label" htmlFor="join-hobbies">Hobbies</label>
                    <input
                        id="join-hobbies"
                        className="join__input"
                        type="text"
                        placeholder="Networking, travel, wine..."
                        value={form.hobbies}
                        onChange={(e) => setForm({ ...form, hobbies: e.target.value })}
                        required
                    />

                    <label className="join__label" htmlFor="join-allergies">Allergies</label>
                    <input
                        id="join-allergies"
                        className="join__input"
                        type="text"
                        placeholder="Optional"
                        value={form.allergies ?? ""}
                        onChange={(e) => setForm({ ...form, allergies: e.target.value })}
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
