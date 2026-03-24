const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";
import type { JoinPayload } from "./types";

export async function submitMainInfo(payload: JoinPayload) {
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
