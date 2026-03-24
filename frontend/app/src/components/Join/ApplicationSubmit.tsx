const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
import type { JoinPayload, JoinResponse, JoinSelectionPayload } from "./types";

export async function submitMainInfo(payload: JoinPayload): Promise<JoinResponse> {
    const res = await fetch(`${API_BASE_URL}/api/user/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok){
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to submit application");
    }

    return res.json();
}

export async function submitDinnerSelection(payload: JoinSelectionPayload): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/user/join/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to save dinner selection");
    }

    return res.json();
}
