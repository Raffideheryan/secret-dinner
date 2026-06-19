const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8085";

type ActivitySource = "landing";

type UTMParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  telegramStartParam?: string;
};

type ActivityEvent = {
  source: ActivitySource;
  eventName: string;
  eventKey?: string;
  userId?: string;
  sessionId?: string;
  entityType?: string;
  entityId?: string;
  pagePath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  telegramStartParam?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

const STORAGE_SESSION_KEY = "landingActivitySessionId";
const STORAGE_USER_KEY = "joinUserId";

let pendingEvents: ActivityEvent[] = [];
let flushTimer: number | null = null;

function getActivityEndpoint(): string {
  return `${API_BASE_URL}/api/activity/events`;
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(STORAGE_SESSION_KEY);
    if (existing) return existing;
    const next = generateId("landing");
    window.sessionStorage.setItem(STORAGE_SESSION_KEY, next);
    return next;
  } catch {
    return generateId("landing");
  }
}

function getJoinUserId(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_USER_KEY) ?? "";
  } catch {
    return "";
  }
}

// Capture UTM parameters from the entry URL once per page load.
// sessionStorage preserves them across SPA navigation within the same tab.
function readUTMFromURL(): UTMParams {
  try {
    const params = new URLSearchParams(window.location.search);
    const result: UTMParams = {};
    const src = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    const content = params.get("utm_content");
    const term = params.get("utm_term");
    const startParam = params.get("tgWebAppStartParam") ?? params.get("start");
    if (src) result.utmSource = src;
    if (medium) result.utmMedium = medium;
    if (campaign) result.utmCampaign = campaign;
    if (content) result.utmContent = content;
    if (term) result.utmTerm = term;
    if (startParam) result.telegramStartParam = startParam;
    return result;
  } catch {
    return {};
  }
}

const STORAGE_UTM_KEY = "landingActivityUTM";

function getUTM(): UTMParams {
  try {
    // Prefer UTM from the current URL if present (direct campaign link).
    const fromURL = readUTMFromURL();
    if (Object.keys(fromURL).length > 0) {
      window.sessionStorage.setItem(STORAGE_UTM_KEY, JSON.stringify(fromURL));
      return fromURL;
    }
    // Fall back to session-stored UTM (user navigated away from entry page).
    const stored = window.sessionStorage.getItem(STORAGE_UTM_KEY);
    if (stored) return JSON.parse(stored) as UTMParams;
  } catch {
    // ignore
  }
  return {};
}

function buildEvent(eventName: string, metadata?: Record<string, unknown>, overrides?: Partial<ActivityEvent>): ActivityEvent {
  const utm = getUTM();
  return {
    source: "landing",
    eventName,
    userId: overrides?.userId ?? (getJoinUserId() || undefined),
    sessionId: overrides?.sessionId ?? getSessionId(),
    entityType: overrides?.entityType,
    entityId: overrides?.entityId,
    eventKey: overrides?.eventKey,
    pagePath: overrides?.pagePath ?? window.location.pathname,
    referrer: overrides?.referrer ?? (document.referrer || undefined),
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    utmContent: utm.utmContent,
    utmTerm: utm.utmTerm,
    telegramStartParam: utm.telegramStartParam,
    occurredAt: new Date().toISOString(),
    metadata,
    context: overrides?.context,
  };
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushActivityEvents();
  }, 250);
}

async function flushActivityEvents(): Promise<void> {
  if (pendingEvents.length === 0) return;
  const batch = pendingEvents;
  pendingEvents = [];

  const body = JSON.stringify({ events: batch });
  try {
    await fetch(getActivityEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    });
  } catch {
    // Tracking must never break user flows.
  }
}

function flushWithBeacon(): void {
  if (pendingEvents.length === 0) return;
  const batch = pendingEvents;
  pendingEvents = [];
  try {
    const payload = JSON.stringify({ events: batch });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(getActivityEndpoint(), blob)) {
        return;
      }
    }
    void fetch(getActivityEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushWithBeacon();
    }
  });
  window.addEventListener("beforeunload", () => {
    flushWithBeacon();
  });
  window.addEventListener("error", (event) => {
    trackLandingEvent("landing_client_error", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "unknown rejection");
    trackLandingEvent("landing_unhandled_rejection", {
      reason,
    });
  });
}

export function trackLandingEvent(eventName: string, metadata?: Record<string, unknown>, overrides?: Partial<ActivityEvent>): void {
  try {
    pendingEvents.push(buildEvent(eventName, metadata, overrides));
    scheduleFlush();
  } catch {
    // ignore
  }
}

export function trackLandingError(eventName: string, error: unknown, metadata?: Record<string, unknown>, overrides?: Partial<ActivityEvent>): void {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "unknown error";
  trackLandingEvent(eventName, { ...metadata, errorMessage: message }, overrides);
}

export function rememberLandingUserId(userId: string): void {
  try {
    if (userId.trim()) {
      window.sessionStorage.setItem(STORAGE_USER_KEY, userId.trim());
    }
  } catch {
    // ignore
  }
}

export function clearLandingTrackingIdentity(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_USER_KEY);
  } catch {
    // ignore
  }
}
