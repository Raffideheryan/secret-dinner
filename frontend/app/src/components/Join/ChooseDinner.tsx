import "./join.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
import type { Dinner, PackageTier } from "./types";
import BlinkingParticles from "../common/BlinkingParticles";
import { submitDinnerSelection } from "./ApplicationSubmit";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TelegramIcon from "@mui/icons-material/Telegram";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useI18n } from "../../i18n";
import { clearLandingTrackingIdentity, trackLandingError, trackLandingEvent } from "../../activity/tracker";
import SeoHead from "../SEO/SeoHead";

const TIERS: PackageTier[] = ["silver", "gold", "vip", "custom"];
const MULTI_GUEST_TIERS: PackageTier[] = ["silver", "gold", "vip"];

export default function JoinDinners() {
    const navigate = useNavigate();
    const { t, lang } = useI18n();
    const [dinners, setDinners] = useState<Dinner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [saveError, setSaveError] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [showSuccessCard, setShowSuccessCard] = useState(false);
    const [selectedDinnerId, setSelectedDinnerId] = useState<number | null>(null);
    const [guestCount, setGuestCount] = useState(1);
    const [selectedPackages, setSelectedPackages] = useState<(PackageTier | null)[]>([null]);

    const canContinue =
        selectedDinnerId !== null &&
        selectedPackages.length === guestCount &&
        selectedPackages.every((pkg) => pkg !== null);

    const selectedDinner = useMemo(
        () => dinners.find((dinner) => dinner.id === selectedDinnerId) ?? null,
        [dinners, selectedDinnerId]
    );

    const isMultiGuest = guestCount > 1;

    useEffect(() => {
        const rawGuestCount = sessionStorage.getItem("joinGuestCount");
        const parsedGuestCount = Number(rawGuestCount);
        const normalizedGuestCount = Number.isInteger(parsedGuestCount) && parsedGuestCount > 0
            ? parsedGuestCount
            : 1;
        setGuestCount(normalizedGuestCount);
        setSelectedPackages(Array.from({ length: normalizedGuestCount }, () => null));
    }, []);

    const fetchDinners = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE_URL}/api/dinners/info`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || t("join.step2.loadFailed"));
            setDinners(data.dinners ?? []);
            trackLandingEvent("landing_dinners_loaded", {
                dinnerCount: Array.isArray(data.dinners) ? data.dinners.length : 0,
            });
        } catch (e) {
            trackLandingError("landing_dinners_load_failed", e);
            setError(e instanceof Error ? e.message : t("join.step2.requestFailed"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        trackLandingEvent("landing_dinner_selection_opened");
        void fetchDinners();
    }, []);

    const locale = lang === "ru" ? "ru-RU" : lang === "hy" ? "hy-AM" : "en-US";

    const formatPrice = (value: number | null) => {
        if (value === null) return t("join.step2.unavailable");
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "AMD",
            maximumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (value: string) =>
        Number.isNaN(new Date(value).getTime())
            ? t("join.step2.dateTba")
            : new Intl.DateTimeFormat(locale, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
            }).format(new Date(value));

    const getVenueLabel = (rawLocation: string) => {
        const value = rawLocation?.trim().toLowerCase();
        if (!value || value === "unknown" || value === "tba" || value === "to be announced") {
            return t("join.step2.locationAfterConfirm");
        }
        return rawLocation;
    };

    const getAvailabilityLabel = (dinner: Dinner) => {
        if (typeof dinner.places !== "number" || dinner.places <= 0) {
            return t("join.step2.seatsOnRequest");
        }

        const taken = typeof dinner.alreadyRegistered === "number" ? dinner.alreadyRegistered : 0;
        const left = Math.max(dinner.places - taken, 0);

        if (left === 0) return t("join.step2.waitlist");
        if (left <= 4) return t("join.step2.seatsLeft", { count: left });
        return t("join.step2.limitedSeats");
    };

    const getPriceForTier = (dinner: Dinner, packageTier: PackageTier) => {
        if (packageTier === "silver") return dinner.silverPrice;
        if (packageTier === "gold") return dinner.goldPrice;
        if (packageTier === "vip") return dinner.vipPrice;
        return null;
    };

    const getAvailableTiers = () => (isMultiGuest ? MULTI_GUEST_TIERS : TIERS);

    const getFirstAvailableTier = (dinner: Dinner): PackageTier | null => {
        const firstAvailable = getAvailableTiers().find(
            (tier) => tier !== "custom" && getPriceForTier(dinner, tier) !== null
        );
        if (!firstAvailable) return isMultiGuest ? null : "custom";
        return firstAvailable ?? null;
    };

    const derivePrimaryPackage = (packages: (PackageTier | null)[]): PackageTier => {
        if (packages.includes("vip")) return "vip";
        if (packages.includes("gold")) return "gold";
        if (packages.includes("silver")) return "silver";
        return "custom";
    };

    const buildDefaultGuestPackages = (dinner: Dinner) => {
        const fallback = getFirstAvailableTier(dinner);
        return Array.from({ length: guestCount }, (_, index) => {
            const current = selectedPackages[index];
            if (current && (current === "custom" || getPriceForTier(dinner, current) !== null)) {
                return current;
            }
            return fallback;
        });
    };

    const handleSelectDinner = (dinner: Dinner) => {
        setSelectedDinnerId(dinner.id);
        trackLandingEvent("landing_dinner_viewed", {
            dinnerTitle: dinner.description,
            availabilityLabel: getAvailabilityLabel(dinner),
        }, {
            entityType: "dinner",
            entityId: String(dinner.id),
        });
        setSelectedPackages(buildDefaultGuestPackages(dinner));
    };

    const handleChoosePackage = (dinnerId: number, packageTier: PackageTier, guestIndex = 0) => {
        setSelectedDinnerId(dinnerId);
        setSelectedPackages((prev) => {
            const next = prev.length === guestCount
                ? [...prev]
                : Array.from({ length: guestCount }, (_, index) => prev[index] ?? null);
            next[guestIndex] = packageTier;
            return next;
        });
        trackLandingEvent("landing_package_clicked", {
            package: packageTier,
            guestIndex: guestIndex + 1,
        }, {
            entityType: "dinner",
            entityId: String(dinnerId),
        });
    };

    const handleSaveSelection = async () => {
        if (!canContinue || !selectedDinner) return;
        const guestPackages = selectedPackages.filter((pkg): pkg is PackageTier => pkg !== null);
        const chosenPackage = derivePrimaryPackage(guestPackages);
        if (guestPackages.length !== guestCount) return;
        const payloadGuestPackages = isMultiGuest ? guestPackages : undefined;
        const userId = sessionStorage.getItem("joinUserId");
        if (!userId) {
            setSaveError(t("join.step2.sessionExpired"));
            navigate("/join", { replace: true });
            return;
        }
        setSaveError("");
        setSaving(true);

        try {
            await submitDinnerSelection({
                userId,
                dinnerId: selectedDinner.id,
                chosenPackage,
                guestPackages: payloadGuestPackages,
            });

            sessionStorage.setItem(
                "joinDinnerSelection",
                JSON.stringify({
                    dinnerId: selectedDinner.id,
                    package: chosenPackage,
                    guestPackages: payloadGuestPackages ?? [chosenPackage],
                    guestCount,
                    location: getVenueLabel(selectedDinner.location),
                    date: selectedDinner.dinnerDate,
                })
            );

            trackLandingEvent("landing_dinner_selection_saved", {
                package: chosenPackage,
                guestPackages: payloadGuestPackages ?? [chosenPackage],
                guestCount,
            }, {
                userId,
                entityType: "dinner",
                entityId: String(selectedDinner.id),
            });
            setShowSuccessCard(true);
        } catch (e) {
            trackLandingError("landing_dinner_selection_save_error", e, {
                dinnerId: selectedDinner.id,
                package: chosenPackage,
                guestPackages: payloadGuestPackages ?? [chosenPackage],
            }, {
                userId,
                entityType: "dinner",
                entityId: String(selectedDinner.id),
            });
            setSaveError(e instanceof Error ? e.message : t("join.step2.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const renderGuestSelectionPanel = () => {
        if (!selectedDinner || !isMultiGuest) return null;

        return (
            <section className="join__guest-selector" aria-label={t("join.step2.guestPackagesTitle")}>
                <div className="join__guest-selector-head">
                    <div>
                        <h3>{t("join.step2.guestPackagesTitle", { count: guestCount })}</h3>
                        <p>{t("join.step2.guestPackagesSubtitle")}</p>
                    </div>
                    <span className="join__guest-count-pill">{t("join.step2.guestCountBadge", { count: guestCount })}</span>
                </div>
                <div className="join__guest-selector-grid">
                    {Array.from({ length: guestCount }, (_, guestIndex) => (
                        <div key={guestIndex} className="join__guest-card">
                            <div className="join__guest-card-head">
                                <strong>{t("join.step2.guestLabel", { count: guestIndex + 1 })}</strong>
                                <span>
                                    {selectedPackages[guestIndex]
                                        ? t(`join.tier.${selectedPackages[guestIndex] as PackageTier}`)
                                        : t("join.step2.chooseGuestPackage")}
                                </span>
                            </div>
                            <div className="join__guest-tier-row">
                                {MULTI_GUEST_TIERS.map((tier) => {
                                    const price = getPriceForTier(selectedDinner, tier);
                                    const unavailable = price === null;
                                    const active = selectedPackages[guestIndex] === tier;
                                    return (
                                        <button
                                            key={`${guestIndex}-${tier}`}
                                            type="button"
                                            className={[
                                                "join__tier-btn",
                                                `join__tier-btn--${tier}`,
                                                "join__tier-btn--compact",
                                                active ? "join__tier-btn--active" : "",
                                            ].join(" ").trim()}
                                            onClick={() => handleChoosePackage(selectedDinner.id, tier, guestIndex)}
                                            disabled={unavailable}
                                        >
                                            <span className="join__tier-label">{t(`join.tier.${tier}`)}</span>
                                            <span className="join__tier-price">{formatPrice(price)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    };

    const renderSelectionSummary = () => {
        if (!selectedDinner || !canContinue) {
            return <p>{t(isMultiGuest ? "join.step2.chooseGuestsToContinue" : "join.step2.chooseToContinue")}</p>;
        }

        if (!isMultiGuest) {
            const selectedPackage = selectedPackages[0] as PackageTier;
            return (
                <p>
                    {t("join.step2.selectionPrefix")} <strong>{getVenueLabel(selectedDinner.location)}</strong> ·{" "}
                    <strong>{formatDate(selectedDinner.dinnerDate)}</strong> ·{" "}
                    <strong>{t(`join.tier.${selectedPackage}`)}</strong> (
                    {selectedPackage === "custom"
                        ? t("join.step2.tailored")
                        : formatPrice(getPriceForTier(selectedDinner, selectedPackage))})
                </p>
            );
        }

        return (
            <div className="join__selection-summary">
                <p className="join__selection-summary-intro">
                    {t("join.step2.selectionPrefix")} <strong>{getVenueLabel(selectedDinner.location)}</strong> ·{" "}
                    <strong>{formatDate(selectedDinner.dinnerDate)}</strong> ·{" "}
                    <strong>{t("join.step2.guestCountBadge", { count: guestCount })}</strong>
                </p>
                <div className="join__selection-summary-tags">
                    {selectedPackages.map((pkg, index) => (
                        <span key={`summary-${index}`} className="join__selection-summary-tag">
                            {t("join.step2.guestLabel", { count: index + 1 })}: {pkg ? t(`join.tier.${pkg}`) : t("join.step2.chooseGuestPackage")}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    const handleReturnHome = () => {
        trackLandingEvent("landing_return_home");
        sessionStorage.removeItem("joinFormCompleted");
        sessionStorage.removeItem("joinUserId");
        clearLandingTrackingIdentity();
        navigate("/");
    };

    return (
        <section className="join join--dinners" id="join-dinners">
            <SeoHead
                title="Select Your Secret Dinner"
                description="Choose a dinner date and package tier for your Secret Dinner reservation."
                noindex
            />
            <BlinkingParticles overlayClassName="join__overlay" particleClassName="join__particle" />
            <div className="join__content">
                {showSuccessCard ? (
                    <div className="join__success-card">
                        <div className="join__success-icon-wrap">
                            <AccessTimeIcon />
                        </div>

                        <h2 className="join__success-title">{t("join.step2.success.title")}</h2>
                        <p className="join__success-subtitle">{t("join.step2.success.subtitle")}</p>

                        <div className="join__success-next">
                            <h3>{t("join.step2.success.nextTitle")}</h3>
                            <ol>
                                <li>{t("join.step2.success.next1")}</li>
                                <li>{t("join.step2.success.next2")}</li>
                                <li>{t("join.step2.success.next3")}</li>
                            </ol>
                        </div>

                        <a
                            className="join__success-btn join__success-btn--telegram"
                            href="https://t.me/secret_dinner_bot"
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => trackLandingEvent("landing_telegram_redirect_clicked", { location: "selection_success" })}
                        >
                            <TelegramIcon />
                            {t("join.step2.success.telegram")}
                        </a>

                        <button
                            type="button"
                            className="join__success-btn join__success-btn--home"
                            onClick={handleReturnHome}
                        >
                            <HomeOutlinedIcon />
                            {t("join.step2.success.home")}
                        </button>
                    </div>
                ) : (
                <div className="join__dinners-card">
                    <div className="join__logo-wrap">
                        <img className="join__logo" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    </div>

                    <p className="join__step-chip">{t("join.step2.stepChip")}</p>
                    <h2 className="join__dinners-title">{t("join.step2.title")}</h2>
                    <p className="join__dinners-subtitle">
                        {t("join.step2.subtitle")}
                    </p>
                    <p className="join__micro-hint">
                        {t("join.step2.tip")}
                    </p>

                    {loading && <p className="join__state">{t("join.step2.loading")}</p>}
                    {error && (
                        <div className="join__state join__state--error">
                            <p>{error}</p>
                            <button type="button" className="join__retry-btn" onClick={() => void fetchDinners()}>
                                {t("join.step2.retry")}
                            </button>
                        </div>
                    )}

                    {!loading && !error && dinners.length === 0 && (
                        <p className="join__state">{t("join.step2.none")}</p>
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
                                        {isSelected && <span className="join__picked-badge">{t("join.step2.selectedDinner")}</span>}

                                        <div className={isMultiGuest ? "join__package-row join__package-row--multi" : "join__package-row"}>
                                            {getAvailableTiers().map((tier) => {
                                                const price = getPriceForTier(dinner, tier);
                                                const unavailable = tier !== "custom" && price === null;
                                                const active =
                                                    isSelected && !isMultiGuest && selectedPackages[0] === tier;

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
                                                            handleChoosePackage(dinner.id, tier, 0);
                                                        }}
                                                        disabled={isMultiGuest || unavailable}
                                                    >
                                                        <span className="join__tier-label">{t(`join.tier.${tier}`)}</span>
                                                        <span className="join__tier-price">
                                                            {tier === "custom" ? t("join.step2.tailored") : formatPrice(price)}
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

                    {renderGuestSelectionPanel()}

                    <div className="join__selection">
                        {renderSelectionSummary()}
                    </div>
                    {saveError && <p className="join__state join__state--error">{saveError}</p>}

                    <div className="join__actions">
                        <Link className="join__btn join__btn--back" to="/join">{t("join.step2.back")}</Link>
                        <button
                            className={`join__btn join__btn--primary ${(!canContinue || saving) ? "join__btn--disabled" : ""}`}
                            type="button"
                            disabled={!canContinue || saving}
                            onClick={() => void handleSaveSelection()}
                        >
                            {saving ? t("join.step2.saving") : t("join.step2.saveContinue")}
                        </button>
                    </div>
                </div>
                )}
            </div>
        </section>
    );
}
