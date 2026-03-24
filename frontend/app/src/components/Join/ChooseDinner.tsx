import "./join.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
import type { Dinner, PackageTier } from "./types";
import BlinkingParticles from "../common/BlinkingParticles";
import { submitDinnerSelection } from "./ApplicationSubmit";

const TIERS: PackageTier[] = ["silver", "gold", "vip", "custom"];

export default function JoinDinners() {
    const navigate = useNavigate();
    const [dinners, setDinners] = useState<Dinner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [saveError, setSaveError] = useState<string>("");
    const [successMessage, setSuccessMessage] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [selectedDinnerId, setSelectedDinnerId] = useState<number | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<PackageTier | null>(null);

    const canContinue = selectedDinnerId !== null && selectedPackage !== null;

    const selectedDinner = useMemo(
        () => dinners.find((dinner) => dinner.id === selectedDinnerId) ?? null,
        [dinners, selectedDinnerId]
    );

    const fetchDinners = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE_URL}/api/dinners/info`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to load dinners");
            setDinners(data.dinners ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchDinners();
    }, []);

    const formatPrice = (value: number | null) => {
        if (value === null) return "Unavailable";
        return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (value: string) =>
        Number.isNaN(new Date(value).getTime())
            ? "Date to be announced"
            : new Intl.DateTimeFormat("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
            }).format(new Date(value));

    const getVenueLabel = (rawLocation: string) => {
        const value = rawLocation?.trim().toLowerCase();
        if (!value || value === "unknown" || value === "tba" || value === "to be announced") {
            return "Location shared after confirmation";
        }
        return rawLocation;
    };

    const getAvailabilityLabel = (dinner: Dinner) => {
        if (typeof dinner.places !== "number" || dinner.places <= 0) {
            return "Seats updated on request";
        }

        const taken = typeof dinner.alreadyRegistered === "number" ? dinner.alreadyRegistered : 0;
        const left = Math.max(dinner.places - taken, 0);

        if (left === 0) return "Waitlist available";
        if (left <= 4) return `${left} seats left`;
        return "Limited seats";
    };

    const getPriceForTier = (dinner: Dinner, packageTier: PackageTier) => {
        if (packageTier === "silver") return dinner.silverPrice;
        if (packageTier === "gold") return dinner.goldPrice;
        if (packageTier === "vip") return dinner.vipPrice;
        return null;
    };

    const getFirstAvailableTier = (dinner: Dinner): PackageTier | null => {
        const firstAvailable = TIERS.find(
            (tier) => tier !== "custom" && getPriceForTier(dinner, tier) !== null
        );
        if (!firstAvailable) return "custom";
        return firstAvailable ?? null;
    };

    const handleSelectDinner = (dinner: Dinner) => {
        setSelectedDinnerId(dinner.id);
        if (!selectedPackage || getPriceForTier(dinner, selectedPackage) === null) {
            setSelectedPackage(getFirstAvailableTier(dinner));
        }
    };

    const handleChoosePackage = (dinnerId: number, packageTier: PackageTier) => {
        setSelectedDinnerId(dinnerId);
        setSelectedPackage(packageTier);
    };

    const handleSaveSelection = async () => {
        if (!canContinue || !selectedDinner) return;
        const chosenPackage = selectedPackage;
        if (!chosenPackage) return;
        const userId = sessionStorage.getItem("joinUserId");
        if (!userId) {
            setSaveError("Session expired. Please complete step 1 again.");
            navigate("/join", { replace: true });
            return;
        }
        setSaveError("");
        setSuccessMessage("");
        setSaving(true);

        try {
            await submitDinnerSelection({
                userId,
                dinnerId: selectedDinner.id,
                chosenPackage,
            });

            sessionStorage.setItem(
                "joinDinnerSelection",
                JSON.stringify({
                    dinnerId: selectedDinner.id,
                    package: chosenPackage,
                    location: getVenueLabel(selectedDinner.location),
                    date: selectedDinner.dinnerDate,
                })
            );

            setSuccessMessage("Success. We will contact you as soon as possible.");
            window.setTimeout(() => {
                sessionStorage.removeItem("joinFormCompleted");
                sessionStorage.removeItem("joinUserId");
                navigate("/");
            }, 1800);
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Failed to save selection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="join join--dinners" id="join-dinners">
            <BlinkingParticles overlayClassName="join__overlay" particleClassName="join__particle" />
            <div className="join__content">
                <div className="join__dinners-card">
                    <div className="join__logo-wrap">
                        <img className="join__logo" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    </div>

                    <p className="join__step-chip">Step 2 of 2</p>
                    <h2 className="join__dinners-title">Choose Your Evening</h2>
                    <p className="join__dinners-subtitle">
                        Pick a dinner first, then choose your package tier. Your selection is saved instantly.
                    </p>
                    <p className="join__micro-hint">
                        Tip: clicking a dinner card preselects the first available package or Custom.
                    </p>

                    {loading && <p className="join__state">Loading available dinners...</p>}
                    {error && (
                        <div className="join__state join__state--error">
                            <p>{error}</p>
                            <button type="button" className="join__retry-btn" onClick={() => void fetchDinners()}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!loading && !error && dinners.length === 0 && (
                        <p className="join__state">No dinners available right now.</p>
                    )}

                    {!loading && !error && dinners.length > 0 && (
                        <div className="join__dinners-grid">
                            {dinners.map((dinner) => {
                                const isSelected = selectedDinnerId === dinner.id;
                                const dinnerClasses = [
                                    "join__dinner-item",
                                    isSelected ? "join__dinner-item--selected" : "",
                                ].join(" ").trim();

                                return (
                                    <article
                                        key={dinner.id}
                                        className={dinnerClasses}
                                        onClick={() => handleSelectDinner(dinner)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                handleSelectDinner(dinner);
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={isSelected}
                                    >
                                        <div className="join__dinner-head">
                                            <span className="join__dinner-location">{getVenueLabel(dinner.location)}</span>
                                            <span className="join__dinner-date">{formatDate(dinner.dinnerDate)}</span>
                                        </div>
                                        <p className="join__dinner-availability">{getAvailabilityLabel(dinner)}</p>
                                        <p className="join__dinner-description">{dinner.description}</p>
                                        {isSelected && <span className="join__picked-badge">Selected Dinner</span>}

                                        <div className="join__package-row">
                                            {TIERS.map((tier) => {
                                                const price = getPriceForTier(dinner, tier);
                                                const unavailable = tier !== "custom" && price === null;
                                                const active =
                                                    isSelected && selectedPackage === tier;

                                                const tierClasses = [
                                                    "join__tier-btn",
                                                    `join__tier-btn--${tier}`,
                                                    active ? "join__tier-btn--active" : "",
                                                ].join(" ").trim();

                                                return (
                                                    <button
                                                        key={tier}
                                                        type="button"
                                                        className={tierClasses}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleChoosePackage(dinner.id, tier);
                                                        }}
                                                        disabled={unavailable}
                                                    >
                                                        <span className="join__tier-label">{tier.toUpperCase()}</span>
                                                        <span className="join__tier-price">
                                                            {tier === "custom" ? "Tailored" : formatPrice(price)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    <div className="join__selection">
                        {selectedDinner && selectedPackage ? (
                            <p>
                                Selected: <strong>{getVenueLabel(selectedDinner.location)}</strong> ·{" "}
                                <strong>{formatDate(selectedDinner.dinnerDate)}</strong> ·{" "}
                                <strong>{selectedPackage.toUpperCase()}</strong> (
                                {selectedPackage === "custom"
                                    ? "Tailored"
                                    : formatPrice(getPriceForTier(selectedDinner, selectedPackage))})
                            </p>
                        ) : (
                            <p>Choose one dinner and one package to continue.</p>
                        )}
                    </div>
                    {saveError && <p className="join__state join__state--error">{saveError}</p>}
                    {successMessage && <p className="join__state join__state--success">{successMessage}</p>}

                    <div className="join__actions">
                        <Link className="join__btn join__btn--back" to="/join">Back</Link>
                        <button
                            className={`join__btn join__btn--primary ${(!canContinue || saving) ? "join__btn--disabled" : ""}`}
                            type="button"
                            disabled={!canContinue || saving}
                            onClick={() => void handleSaveSelection()}
                        >
                            {saving ? "Saving..." : "Save & Continue"}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
