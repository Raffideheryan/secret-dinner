const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
import type { JoinPayload, JoinResponse, JoinSelectionPayload } from "./types";
import { trackLandingError, trackLandingEvent } from "../../activity/tracker";

export async function submitMainInfo(payload: JoinPayload): Promise<JoinResponse> {
    trackLandingEvent("join_form_submit_attempt", {
        guestCount: payload.guestCount,
        hasAllergies: payload.allergies.length > 0,
        hobbyCount: payload.hobbies.length,
        fillDurationMs: payload.fillDurationMs,
    });
    const res = await fetch(`${API_BASE_URL}/api/user/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok){
        const err = await res.json().catch(() => ({}));
        trackLandingEvent("join_form_submit_failed", {
            guestCount: payload.guestCount,
            statusCode: res.status,
            message: err?.message || "Failed to submit application",
        });
        throw new Error(err?.message || "Failed to submit application");
    }

    const data = await res.json();
    trackLandingEvent("join_form_submitted", {
        userId: data?.userId,
        guestCount: payload.guestCount,
    }, {
        userId: data?.userId,
        entityType: "landing_user",
        entityId: data?.userId,
    });
    return data;
}

export async function submitDinnerSelection(payload: JoinSelectionPayload): Promise<{ success: boolean }> {
    trackLandingEvent("landing_package_selection_attempt", {
        dinnerId: payload.dinnerId,
        package: payload.chosenPackage,
        guestPackages: payload.guestPackages ?? [],
    }, {
        userId: payload.userId,
        entityType: "dinner",
        entityId: String(payload.dinnerId),
    });
    const res = await fetch(`${API_BASE_URL}/api/user/join/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        trackLandingError("landing_package_selection_failed", err?.message || "Failed to save dinner selection", {
            dinnerId: payload.dinnerId,
            package: payload.chosenPackage,
            guestPackages: payload.guestPackages ?? [],
            statusCode: res.status,
        }, {
            userId: payload.userId,
            entityType: "dinner",
            entityId: String(payload.dinnerId),
        });
        throw new Error(err?.message || "Failed to save dinner selection");
    }

    const data = await res.json();
    trackLandingEvent("landing_package_selected", {
        dinnerId: payload.dinnerId,
        package: payload.chosenPackage,
        guestPackages: payload.guestPackages ?? [],
    }, {
        userId: payload.userId,
        entityType: "dinner",
        entityId: String(payload.dinnerId),
    });
    return data;
}
