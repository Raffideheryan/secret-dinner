import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  createAdminDish,
  createAdminDinner,
  deleteAdminDinner,
  getAdminDishesByType,
  getAdminDishTypes,
  getAdminAuditLogs,
  getAdminLandingUsers,
  getAdminTelegramApplications,
  getAdminTelegramUsers,
  getAdminDinners,
  getAdminPanel,
  syncAdminDinners,
  type AdminAuditLog as AdminAuditLogEntry,
  type AdminDishItem,
  type AdminDinner,
  type AdminLandingUser,
  type AdminLandingUsersSummary,
  type AdminSettingsPayload,
  type AdminPanelResponse,
  type AdminTelegramApplication,
  type AdminTelegramApplicationsSummary,
  type AdminTelegramUser,
  type AdminTelegramUsersSummary,
  updateAdminLandingUserStatus,
  updateAdminTelegramApplication,
  updateAdminSettings,
  updateAdminDinner,
} from "../../admin/api";
import {
  AdminAuditLog as AdminAuditLogCard,
  AdminBadge,
  AdminButton,
  AdminChartCard,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminPageHeader,
  AdminTable,
} from "./AdminUI";
import "./admin.css";

type AdminSection = "overview" | "guests" | "bookings" | "dinners" | "revenue" | "analytics" | "telegram" | "menu" | "operations" | "settings" | "audit";
type PackageBar = { label: string; value: number; height: number };
type BookingsSource = "landing" | "telegram";
type MetricItem = {
  label: string;
  value: string;
  hint?: string;
  description?: string;
  trend?: string;
  tone?: "default" | "gold" | "emerald" | "danger";
  icon?: string;
};
type DualTrendBar = {
  label: string;
  primary: number;
  secondary: number;
  primaryHeight: number;
  secondaryHeight: number;
};
type SingleTrendBar = {
  label: string;
  value: number;
  height: number;
};
type SparklineGeometry = {
  linePath: string;
  areaPath: string;
};

type AuditPayload = Record<string, unknown>;
type AuditTimelineEvent = {
  key: string;
  adminLabel: string;
  actionLabel: string;
  entityLabel: string;
  entityMeta?: string;
  reason: string;
  createdAt: string;
  previousStatus: string | null;
  nextStatus: string | null;
  previousTone: "default" | "gold" | "emerald" | "danger";
  nextTone: "default" | "gold" | "emerald" | "danger";
  itemCount: number;
  itemIds: number[];
};
type BookingActionOption = {
  value: string;
  label: string;
};
type BookingActionSection = {
  key: "application" | "payment" | "attendance";
  label: string;
  options: BookingActionOption[];
};
type GuestCrmRow = {
  key: string;
  name: string;
  phone: string;
  telegramUsername: string;
  source: string;
  rawStatus?: string;
  applicationsCount: number | null;
  paidBookingsCount: number | null;
  attendanceCount: number | null;
  totalPayments: number | null;
  referralCount: number | null;
  points: number | null;
  lastActivityAt?: string;
  createdAt?: string;
  statusLabel?: string;
  packageLabel?: string;
  paidStatusLabel?: string;
  detailTitle?: string;
  detailLines: string[];
  timelineLines: string[];
};
type DinnerCapacityState = "low" | "healthy" | "almost-full" | "full" | "overbooked" | "unknown";
type DinnerCapacitySummary = {
  registered: number;
  places: number;
  remaining: number;
  fillPercent: number;
  state: DinnerCapacityState;
  label: string;
  warning: string | null;
};
type DinnerCapacityDetail = {
  available: boolean;
  occupiedGuests: number;
  totalSeats: number;
  remainingSeats: number;
  activeBookings: number;
  overbookedGuests: number;
  message: string;
  supporting: string;
};
type BookingStatusSummaryBadge = {
  key: "application" | "payment" | "attendance";
  shortLabel: string;
  fullLabel: string;
  value: string;
  tone: "default" | "gold" | "emerald" | "danger";
  description: string;
};

function DishTypeSelect({
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = value || placeholder || "Select type";

  return (
    <div className="admin-select" ref={rootRef}>
      <button
        className="admin-select__btn admin-dinner-input"
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={label}
      >
        <span className="admin-select__value">{label}</span>
        <span className="admin-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="admin-select__menu" role="listbox" aria-label="Dish types">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              className={opt === value ? "admin-select__item admin-select__item--active" : "admin-select__item"}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              title={opt}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BookingStatusDropdown({
  value,
  options,
  onChange,
  disabled,
  busy,
  ariaLabel,
  formatLabel,
  getIcon,
}: {
  value?: string;
  options: BookingActionOption[];
  onChange: (next: string) => void;
  disabled?: boolean;
  busy?: boolean;
  ariaLabel: string;
  formatLabel: (status?: string) => string;
  getIcon: (status?: string) => string;
}) {
  const currentLabel = formatLabel(value);

  return (
    <div className="admin-booking-actions" role="group" aria-label={ariaLabel}>
      <div className="admin-booking-actions__header">
        <span className="admin-booking-actions__label">Current status</span>
        <span className={`admin-booking-actions__current admin-booking-actions__current--${getBookingActionTone(value)}`}>
          <span className="admin-booking-actions__icon" aria-hidden="true">
            {getIcon(value)}
          </span>
          <span className="admin-booking-actions__current-text">{busy ? "Saving..." : currentLabel}</span>
        </span>
      </div>

      <div className="admin-booking-actions__segments">
        {options.map((option) => {
          const isActive = option.value === value;
          const tone = getBookingActionTone(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              className={`admin-booking-actions__segment admin-booking-actions__segment--${tone} ${isActive ? "admin-booking-actions__segment--active" : ""}`}
              disabled={Boolean(disabled || busy) || isActive}
              onClick={() => onChange(option.value)}
              title={option.label}
            >
              <span className="admin-booking-actions__icon" aria-hidden="true">
                {getIcon(option.value)}
              </span>
              <span className="admin-booking-actions__text">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DinnerFormState = {
  id?: number;
  description: string;
  location: string;
  dinnerDate: string;
  places: string;
  silverPrice: string;
  goldPrice: string;
  vipPrice: string;
  expired: boolean;
};
type SettingsFormState = {
  adminTokenTTLMinutes: string;
  adminLoginPerMinute: string;
  joinFormPer20MinByIP: string;
  joinSelectionPer20MinByIP: string;
  minJoinFormFillDurationMs: string;
  panelAutoRefreshSeconds: string;
  adminUsersPageSize: string;
  maintenanceMode: boolean;
  allowJoinApplications: boolean;
  allowJoinSelections: boolean;
  allowAdminDinnerMutations: boolean;
  allowAdminUserStatusEdits: boolean;
};
type UsersSource = "landing" | "telegram";
type DishFormState = {
  dishType: string;
  nameEng: string;
  nameRus: string;
  nameArm: string;
  price: string;
};

const sectionLabels: Record<AdminSection, string> = {
  overview: "Overview",
  guests: "Guests",
  bookings: "Bookings",
  dinners: "Dinners",
  revenue: "Revenue",
  analytics: "Analytics",
  telegram: "Telegram",
  menu: "Menu",
  operations: "Operations",
  settings: "Settings",
  audit: "Audit Logs",
};

const sectionHints: Record<AdminSection, string> = {
  overview: "Revenue, bookings, capacity, and operational health at a glance.",
  guests: "Guest-level monitoring, loyalty, legal, and relationship context.",
  bookings: "Telegram applications, booking statuses, package mix, and admin overrides.",
  dinners: "Dinner inventory, capacity, pricing, and fill management.",
  revenue: "Paid performance, ticket economics, package revenue, and dinner yield.",
  analytics: "Application, package selection, capacity, and behavioral insights across channels.",
  telegram: "Telegram service health, users, and revenue activity.",
  menu: "Custom package and menu catalog used by Telegram operations.",
  operations: "Runtime controls and operational switches for the admin control room.",
  settings: "Infrastructure-facing runtime details and environment configuration.",
  audit: "Admin overrides and internal change history.",
};

const sectionEyebrows: Record<AdminSection, string> = {
  overview: "Executive Overview",
  guests: "Guest Intelligence",
  bookings: "Reservations",
  dinners: "Inventory",
  revenue: "Commercial",
  analytics: "Performance",
  telegram: "Concierge Channel",
  menu: "Custom Menu",
  operations: "Operations",
  settings: "Configuration",
  audit: "Governance",
};

const emptyDinnerForm: DinnerFormState = {
  description: "",
  location: "",
  dinnerDate: "",
  places: "",
  silverPrice: "",
  goldPrice: "",
  vipPrice: "",
  expired: false,
};
const emptyDishForm: DishFormState = {
  dishType: "",
  nameEng: "",
  nameRus: "",
  nameArm: "",
  price: "",
};
const USERS_PAGE_SIZE = 30;

const metricHints: Record<string, string> = {
  "Landing applications": "Total join form applications from the landing website.",
  "Package selected completion": "Percent of users who finished both steps: profile + dinner/package selection.",
  "Application -> Package Rate": "How many submitted users completed package selection compared to all applications.",
  "Active landing dinners": "Landing dinners that are not expired and still upcoming.",
  "Telegram users": "Total users recorded in the Telegram service database.",
  "Telegram revenue": "Total paid revenue from Telegram registrations.",
  "Orders last 24h": "Number of Telegram registrations created in the last 24 hours.",
  "Total users": "Unique users stored in this data source.",
  "Package selected": "Landing users with both dinner and package selected.",
  "Pending package selection": "Landing users who submitted step 1 but did not finish package selection.",
  "Distinct dinner picks": "How many different dinners were chosen by landing users.",
  "Average guests per form": "Average value of guest_count in landing applications.",
  "Average time to select": "Average hours between step 1 submit and dinner/package selection.",
  "Package selected last 24h": "Users who completed dinner/package selection in the last 24 hours.",
  "Application -> Package Rate %": "Completion ratio from application submitted to final package selection.",
  "Potential revenue": "Estimated revenue using selected package prices on current package selections.",
  "Latest application": "Most recent landing application timestamp.",
  "Terms accepted": "Telegram users who accepted terms.",
  "Terms acceptance %": "Share of Telegram users with terms_accepted = true.",
  "Users with phone": "Telegram users that provided phone number.",
  "Phone coverage %": "Phone-provided users as percentage of total Telegram users.",
  "Referral coverage %": "Referral records count compared to total Telegram users.",
  "Blocked rate %": "Currently blocked users divided by total Telegram users.",
  "Revenue 24h": "Revenue from Telegram registrations created in the last 24 hours.",
  "Orders 24h": "Telegram registration count in the last 24 hours.",
  "Users with payments": "Telegram users with total payments greater than zero.",
  "Average order value": "Revenue total divided by registration count.",
  "Blocked active": "Users currently blocked (or with future unblock date).",
  "Next dinner": "Nearest upcoming dinner date in Telegram dinners table.",
  "Total dinners": "All dinners currently in the shared dinners list.",
  "Active dinners": "Dinners that are currently not marked as expired.",
  "Total registrations": "Sum of already registered counters across dinners.",
  "Telegram DB configured": "Whether backend has Telegram DB URL configured.",
  "Admin user": "Authenticated admin username from current session.",
  "Frontend origin": "Allowed frontend origin configured in backend CORS/admin settings.",
  "Listen address": "Backend HTTP bind address.",
  "Cookie secure": "If true, admin auth cookie is sent only over HTTPS.",
  "Admin token TTL": "How long admin session token stays valid.",
  "Maintenance mode": "When enabled, all join/selection requests are blocked with maintenance response.",
  "Join applications": "Controls whether step-1 applications are accepted.",
  "Join selections": "Controls whether step-2 dinner/package choices are accepted.",
  "Min fill duration": "Minimum time (ms) user must spend before form submit is accepted.",
  "Selection P50": "Median time from first form submit to dinner/package selection.",
  "Selection P90": "90th percentile of time to complete dinner/package selection.",
  "Top email domain": "Most common domain among submitted landing emails.",
  "Weekend share": "Share of landing applications happening on Saturday and Sunday.",
  "Hourly telegram orders": "Registrations created in Telegram in the last 24 hours.",
  "Top package revenue": "Package that generated the highest Telegram revenue.",
  "Overbooked dinners": "Telegram dinners where registrations exceed listed places.",
  "Top fill band": "Most common occupancy level across Telegram dinners.",
  "Landing users total": "Total users captured from landing join flow.",
  "Package Selected": "Landing users who finished dinner and package selection.",
  "Open package selection": "Landing users who still need to finish package selection.",
  "Telegram users total": "Total users in telegram service database.",
  "Paying users": "Telegram users with total payments above zero.",
  "Login rate limit": "Maximum login attempts per minute per IP.",
  "Join form limit": "Maximum first-step applications per IP in 20 minutes.",
  "Join selection limit": "Maximum package-selection requests per IP in 20 minutes.",
  "Panel auto-refresh": "Admin page auto-refresh interval in seconds. 0 disables auto-refresh.",
  "Users page size": "Maximum users returned per page for users monitoring lists.",
  "Dinner mutations": "Controls whether admins can create, edit, delete, or sync dinners.",
  "User status edits": "Controls whether admins can change landing user package-selected status.",
};

const landingSelectionStatusOptions: Array<{
  value: AdminLandingUser["selectionStatus"];
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
];

const telegramBookingActionOptions: BookingActionOption[] = [
  { value: "pending_application", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "approved", label: "Approved" },
  { value: "waiting_payment", label: "Waiting payment" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

function buildPackageBars(input: {
  silver: number;
  gold: number;
  vip: number;
  custom: number;
  unselected: number;
}): PackageBar[] {
  const entries = [
    { label: "Silver", value: input.silver },
    { label: "Gold", value: input.gold },
    { label: "VIP", value: input.vip },
    { label: "Custom", value: input.custom },
    { label: "Open", value: input.unselected },
  ];
  const max = Math.max(...entries.map((item) => item.value), 1);
  return entries.map((item) => ({
    ...item,
    height: item.value > 0 ? Math.max(Math.round((item.value / max) * 100), 8) : 6,
  }));
}

function normalizeHeight(value: number, max: number) {
  if (value <= 0 || max <= 0) {
    return 6;
  }
  return Math.max(Math.round((value / max) * 100), 8);
}

function formatDateLabel(value?: string) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "AMD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatCompactNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function getDinnerCapacitySummary(registered?: number | null, places?: number | null): DinnerCapacitySummary {
  const rawRegistered = typeof registered === "number" && Number.isFinite(registered) ? registered : null;
  const rawPlaces = typeof places === "number" && Number.isFinite(places) ? places : null;

  if (rawRegistered === null || rawPlaces === null || rawRegistered < 0 || rawPlaces <= 0) {
    return {
      registered: Math.max(0, rawRegistered ?? 0),
      places: Math.max(0, rawPlaces ?? 0),
      remaining: 0,
      fillPercent: 0,
      state: "unknown",
      label: "Capacity unavailable",
      warning: null,
    };
  }

  const safeRegistered = Math.max(0, rawRegistered);
  const safePlaces = Math.max(0, rawPlaces);
  const remaining = safePlaces - safeRegistered;
  const fillPercent = (safeRegistered / safePlaces) * 100;

  if (safeRegistered > safePlaces) {
    return {
      registered: safeRegistered,
      places: safePlaces,
      remaining,
      fillPercent,
      state: "overbooked",
      label: "Overbooked",
      warning: `${Math.abs(remaining)} seats over`,
    };
  }
  if (safeRegistered === safePlaces) {
    return {
      registered: safeRegistered,
      places: safePlaces,
      remaining,
      fillPercent,
      state: "full",
      label: "Full",
      warning: "No seats left",
    };
  }
  if (fillPercent >= 85) {
    return {
      registered: safeRegistered,
      places: safePlaces,
      remaining,
      fillPercent,
      state: "almost-full",
      label: "Almost full",
      warning: `${remaining} seats left`,
    };
  }
  if (fillPercent >= 35) {
    return {
      registered: safeRegistered,
      places: safePlaces,
      remaining,
      fillPercent,
      state: "healthy",
      label: "Healthy",
      warning: `${remaining} seats left`,
    };
  }
  return {
    registered: safeRegistered,
    places: safePlaces,
    remaining,
    fillPercent,
    state: "low",
    label: "Low",
    warning: `${remaining} seats left`,
  };
}

function getDinnerCapacityDetail(
  occupiedGuests?: number | null,
  totalSeats?: number | null,
  activeBookings?: number | null
): DinnerCapacityDetail {
  const guests = typeof occupiedGuests === "number" && Number.isFinite(occupiedGuests) ? occupiedGuests : null;
  const seats = typeof totalSeats === "number" && Number.isFinite(totalSeats) ? totalSeats : null;
  const bookings = typeof activeBookings === "number" && Number.isFinite(activeBookings) ? activeBookings : null;

  if (guests === null || seats === null || bookings === null || guests < 0 || seats <= 0 || bookings < 0 || bookings > guests) {
    return {
      available: false,
      occupiedGuests: Math.max(0, guests ?? 0),
      totalSeats: Math.max(0, seats ?? 0),
      remainingSeats: 0,
      activeBookings: Math.max(0, bookings ?? 0),
      overbookedGuests: 0,
      message: "Capacity unavailable",
      supporting: "Capacity unavailable",
    };
  }

  const remainingSeats = seats - guests;
  const overbookedGuests = Math.max(0, guests - seats);
  return {
    available: true,
    occupiedGuests: guests,
    totalSeats: seats,
    remainingSeats: Math.max(0, remainingSeats),
    activeBookings: bookings,
    overbookedGuests,
    message: `${guests} / ${seats} seats occupied`,
    supporting: overbookedGuests > 0 ? `${overbookedGuests} seats overbooked` : `${Math.max(0, remainingSeats)} seats remaining`,
  };
}

function formatTelegramStatusChipLabel(group: BookingStatusSummaryBadge) {
  switch (group.key) {
    case "application":
      return `Application ${group.value}`;
    case "payment":
      return `Payment ${group.value === "Paid" ? "Received" : group.value}`;
    case "attendance":
      return `Attendance ${group.value === "Not Scheduled" ? "Pending" : group.value}`;
    default:
      return `${group.fullLabel} ${group.value}`;
  }
}

function DinnerCapacityInline({
  registered,
  places,
  compact,
}: {
  registered?: number | null;
  places?: number | null;
  compact?: boolean;
}) {
  const summary = getDinnerCapacitySummary(registered, places);

  return (
    <div className={`admin-capacity ${compact ? "admin-capacity--compact" : ""} admin-capacity--${summary.state}`}>
      <div className="admin-capacity__head">
        <span className="admin-capacity__ratio">
          {summary.registered} / {summary.places > 0 ? summary.places : "—"}
        </span>
        <span className={`admin-capacity__state admin-capacity__state--${summary.state}`}>{summary.label}</span>
      </div>
      <div className="admin-capacity__meta">
        <span>{summary.fillPercent.toFixed(1)}% filled</span>
        <span>
          {summary.state === "overbooked"
            ? `${Math.abs(summary.remaining)} over`
            : `${Math.max(summary.remaining, 0)} left`}
        </span>
      </div>
      <div className="admin-capacity__track" aria-hidden="true">
        <span
          className={`admin-capacity__fill admin-capacity__fill--${summary.state}`}
          style={{ width: `${summary.state === "unknown" ? 0 : Math.max(6, Math.min(summary.fillPercent, 100))}%` }}
        />
      </div>
      {summary.warning ? <div className="admin-capacity__warning">{summary.warning}</div> : null}
    </div>
  );
}

function getPackageTone(label?: string): "default" | "gold" | "emerald" {
  switch ((label ?? "").toLowerCase()) {
    case "vip":
    case "gold":
      return "gold";
    case "silver":
    case "custom":
      return "default";
    default:
      return "emerald";
  }
}

function formatApplicationStatus(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "pending_application":
      return "Pending";
    case "contacted":
      return "Contacted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "waiting_payment":
      return "Waiting payment";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No show";
    case "draft":
      return "Draft";
    default:
      return status || "—";
  }
}

function getApplicationStatusIcon(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "pending_application":
      return "○";
    case "contacted":
      return "↗";
    case "approved":
      return "✓";
    case "waiting_payment":
      return "◔";
    case "paid":
      return "$";
    case "cancelled":
      return "×";
    case "rejected":
      return "!";
    case "no_show":
      return "•";
    default:
      return "•";
  }
}

function formatLandingSelectionStatus(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "open":
      return "Open";
    case "completed":
      return "Completed";
    default:
      return status || "—";
  }
}

function getLandingSelectionStatusIcon(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "completed":
      return "✓";
    case "open":
      return "○";
    default:
      return "•";
  }
}

function getBookingActionTone(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "pending_application":
    case "open":
      return "neutral";
    case "contacted":
      return "info";
    case "approved":
      return "violet";
    case "waiting_payment":
      return "warning";
    case "paid":
    case "completed":
      return "success";
    case "no_show":
      return "danger-deep";
    case "cancelled":
    case "rejected":
      return "danger";
    default:
      return "default";
  }
}

function getTelegramStatusSummary(status?: string): BookingStatusSummaryBadge[] {
  switch ((status ?? "").trim().toLowerCase()) {
    case "contacted":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Contacted", tone: "default", description: "Application has been contacted by the team." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Not Started", tone: "gold", description: "Payment has not started yet." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is not scheduled yet." },
      ];
    case "approved":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application has been approved." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Not Started", tone: "gold", description: "Payment has not started yet." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is not scheduled yet." },
      ];
    case "waiting_payment":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application has been approved." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Waiting", tone: "gold", description: "Payment is waiting to be completed." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is not scheduled yet." },
      ];
    case "paid":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application has been approved." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Paid", tone: "emerald", description: "Payment has been completed." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance has not been marked yet." },
      ];
    case "cancelled":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application was previously approved before the booking was cancelled." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Cancelled", tone: "danger", description: "Payment or booking flow was cancelled." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is no longer scheduled." },
      ];
    case "rejected":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Rejected", tone: "danger", description: "Application has been rejected." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Not Started", tone: "default", description: "Payment is not applicable and was never started." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is not scheduled." },
      ];
    case "no_show":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application had been approved." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Paid", tone: "emerald", description: "Payment had been completed." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "No-show", tone: "danger", description: "Guest did not attend the event." },
      ];
    case "draft":
    case "pending_application":
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Pending", tone: "default", description: "Application is still pending review." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Not Started", tone: "gold", description: "Payment has not started yet." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance is not scheduled yet." },
      ];
    default:
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: formatApplicationStatus(status), tone: "default", description: "Application status from the booking record." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Not Started", tone: "default", description: "Payment status is not recognized in the summary mapping." },
        { key: "attendance", shortLabel: "Attend", fullLabel: "Attendance", value: "Not Scheduled", tone: "default", description: "Attendance status is not recognized in the summary mapping." },
      ];
  }
}

function getTelegramBookingActionSections(options: BookingActionOption[]): BookingActionSection[] {
  const lookup = new Map(options.map((option) => [option.value, option]));
  const sections: BookingActionSection[] = [
    {
      key: "application",
      label: "Application",
      options: ["pending_application", "contacted", "approved", "rejected"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option)),
    },
    {
      key: "payment",
      label: "Payment",
      options: ["waiting_payment", "paid", "cancelled"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option)),
    },
    {
      key: "attendance",
      label: "Attendance",
      options: ["no_show"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option)),
    },
  ];
  return sections.filter((section) => section.options.length > 0);
}

function getTelegramBookingDangerOptions(options: BookingActionOption[]) {
  const dangerValues = new Set(["rejected", "cancelled", "no_show"]);
  return options.filter((option) => dangerValues.has(option.value));
}

function formatNullableCount(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}`;
}

function formatTelegramUsername(value?: string) {
  const normalized = (value ?? "").trim();
  return normalized ? `@${normalized}` : "—";
}

function buildGuestCrmRowFromLandingUser(item: AdminLandingUser): GuestCrmRow {
  return {
    key: `landing-${item.id}`,
    name: item.fullName,
    phone: item.phone || "—",
    telegramUsername: "—",
    source: "landing",
    rawStatus: item.selectionStatus,
    applicationsCount: 1,
    paidBookingsCount: null,
    attendanceCount: null,
    totalPayments: null,
    referralCount: null,
    points: null,
    lastActivityAt: item.updatedAt || item.createdAt,
    createdAt: item.createdAt,
    statusLabel: formatLandingSelectionStatus(item.selectionStatus),
    packageLabel: item.chosenPackage || "Unselected",
    paidStatusLabel: "Not tracked",
    detailTitle: item.dinnerTitle || "No dinner selected",
    detailLines: [
      `Email: ${item.email || "—"}`,
      `Guests: ${item.guestCount}`,
      `Package: ${item.chosenPackage || "Unselected"}`,
      `Status: ${formatLandingSelectionStatus(item.selectionStatus)}`,
      `Hobbies: ${item.hobbies || "—"}`,
      `Allergies: ${item.allergies || "—"}`,
    ],
    timelineLines: [
      `Created ${formatDateLabel(item.createdAt)}`,
      `Last updated ${formatDateLabel(item.updatedAt)}`,
      item.dinnerTitle ? `Dinner selected: ${item.dinnerTitle}` : "Dinner not selected yet",
      item.chosenPackage ? `Package selected: ${item.chosenPackage}` : "Package not selected yet",
    ],
  };
}

function buildTelegramGuestCounts(
  user: AdminTelegramUser,
  applications: AdminTelegramApplication[]
) {
  const guestApplications = applications.filter((item) => item.userId === user.id);
  if (guestApplications.length === 0) {
    return {
      applicationsCount: user.ordersCount ?? 0,
      paidBookingsCount: user.totalPayments > 0 ? null : 0,
      attendanceCount: user.attendanceCount ?? 0,
      lastActivityAt: user.lastRegisteredAt || user.updatedAt || user.createdAt,
    };
  }

  let paidBookingsCount = 0;
  let attendanceCount = 0;
  let lastActivityAt = user.lastRegisteredAt || user.updatedAt || user.createdAt;

  guestApplications.forEach((item) => {
    const status = (item.status ?? "").trim().toLowerCase();
    if (status === "paid" || status === "no_show") {
      paidBookingsCount += 1;
    }
    if (status === "no_show") {
      attendanceCount += 1;
    }
    const updatedAt = item.updatedAt || item.createdAt;
    if (updatedAt && (!lastActivityAt || new Date(updatedAt).getTime() > new Date(lastActivityAt).getTime())) {
      lastActivityAt = updatedAt;
    }
  });

  return {
    applicationsCount: guestApplications.length,
    paidBookingsCount,
    attendanceCount,
    lastActivityAt,
  };
}

function buildGuestCrmRowFromTelegramUser(
  item: AdminTelegramUser,
  applications: AdminTelegramApplication[]
): GuestCrmRow {
  const counts = buildTelegramGuestCounts(item, applications);
  const fullName = [item.name, item.surname].filter(Boolean).join(" ").trim() || formatTelegramUsername(item.username);

  return {
    key: `telegram-${item.id}`,
    name: fullName,
    phone: item.phone || "—",
    telegramUsername: formatTelegramUsername(item.username),
    source: "telegram",
    rawStatus: item.lastApplicationStatus,
    applicationsCount: counts.applicationsCount,
    paidBookingsCount: counts.paidBookingsCount,
    attendanceCount: counts.attendanceCount,
    totalPayments: item.totalPayments ?? 0,
    referralCount: item.friendsInvited ?? 0,
    points: item.points ?? 0,
    lastActivityAt: counts.lastActivityAt,
    createdAt: item.createdAt,
    statusLabel: formatApplicationStatus(item.lastApplicationStatus),
    packageLabel: item.lastApplicationStatus ? formatApplicationStatus(item.lastApplicationStatus) : "No status",
    paidStatusLabel: counts.paidBookingsCount && counts.paidBookingsCount > 0 ? `Paid ${counts.paidBookingsCount}` : "Unpaid",
    detailTitle: item.lastApplicationStatus ? `Last status: ${formatApplicationStatus(item.lastApplicationStatus)}` : "No recent status",
    detailLines: [
      `Language: ${item.language || "—"}`,
      `Terms: ${item.termsAccepted ? "Accepted" : "Pending"}`,
      `Legal version: ${item.legalVersion || "—"}`,
      `Payments total: ${formatCurrency(item.totalPayments ?? 0)}`,
      `Attendance: ${formatNullableCount(counts.attendanceCount)}`,
      `Referrals: ${formatNullableCount(item.friendsInvited ?? 0)}`,
      `Points: ${formatNullableCount(item.points ?? 0)}`,
      `Referral code: ${item.referralCode || "—"}`,
      `Used referral: ${item.referralUsedCode || "—"}`,
      `Table preference: ${formatTablePreference(item.lastTablePreference)}`,
    ],
    timelineLines: [
      `Created ${formatDateLabel(item.createdAt)}`,
      `Last updated ${formatDateLabel(item.updatedAt)}`,
      `Last registration ${formatDateLabel(item.lastRegisteredAt)}`,
      item.acceptedAt ? `Terms accepted ${formatDateLabel(item.acceptedAt)}` : "Terms acceptance not recorded",
    ],
  };
}

function formatAuditActionLabel(actionType?: string) {
  switch ((actionType ?? "").trim().toLowerCase()) {
    case "telegram_application_updated":
      return "Booking status updated";
    case "landing_user_status_updated":
      return "Landing status updated";
    case "dinner_created":
      return "Dinner created";
    case "dinner_updated":
      return "Dinner updated";
    case "dinner_deleted":
      return "Dinner deleted";
    case "dinners_synced":
      return "Dinner sync run";
    case "settings_updated":
      return "Settings updated";
    default:
      return (actionType ?? "Unknown action")
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function formatAuditEntityLabel(entityType?: string, entityId?: string) {
  const label = (entityType ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return label ? `${label} #${entityId || "—"}` : entityId || "—";
}

function parseAuditPayload(value?: string): AuditPayload | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as AuditPayload;
  } catch {
    return null;
  }
}

function readAuditStatus(payload: AuditPayload | null): string | null {
  if (!payload) {
    return null;
  }
  const raw = payload.status ?? payload.selectionStatus;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function formatAuditStatus(entityType: string, status: string | null) {
  if (!status) {
    return null;
  }
  return entityType === "landing_user" ? formatLandingSelectionStatus(status) : formatApplicationStatus(status);
}

function getAuditStatusChange(item: AdminAuditLogEntry) {
  const previousStatusRaw = readAuditStatus(parseAuditPayload(item.previousValue));
  const nextStatusRaw = readAuditStatus(parseAuditPayload(item.newValue));
  const previousStatus = formatAuditStatus(item.entityType, previousStatusRaw);
  const nextStatus = formatAuditStatus(item.entityType, nextStatusRaw);
  if (!previousStatus && !nextStatus) {
    return null;
  }
  return {
    previousStatusRaw,
    nextStatusRaw,
    previousStatus,
    nextStatus,
  };
}

function getAuditStatusBadgeTone(entityType: string, status: string | null): "default" | "gold" | "emerald" | "danger" {
  if (!status) {
    return "default";
  }
  const normalized = status.trim().toLowerCase();
  if (entityType === "landing_user") {
    if (normalized === "completed") return "emerald";
    if (normalized === "open") return "gold";
    return "default";
  }
  switch (normalized) {
    case "approved":
    case "paid":
      return "emerald";
    case "rejected":
    case "cancelled":
    case "no_show":
      return "danger";
    case "pending_application":
    case "contacted":
    case "waiting_payment":
    case "draft":
      return "gold";
    default:
      return "default";
  }
}

function readAuditBookingCode(payload: AuditPayload | null): string | null {
  if (!payload) {
    return null;
  }
  const raw = payload.publicCode;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function getAuditBookingCode(item: AdminAuditLogEntry) {
  const nextCode = readAuditBookingCode(parseAuditPayload(item.newValue));
  if (nextCode) {
    return nextCode;
  }
  return readAuditBookingCode(parseAuditPayload(item.previousValue));
}

function buildAuditTimelineEvents(logs: AdminAuditLogEntry[]): AuditTimelineEvent[] {
  return logs.reduce<AuditTimelineEvent[]>((events, item) => {
    const change = getAuditStatusChange(item);
    const entityMeta = getAuditBookingCode(item) ? `Booking code ${getAuditBookingCode(item)}` : undefined;
    const nextEvent: AuditTimelineEvent = {
      key: `audit-event-${item.id}`,
      adminLabel: item.adminUsername || "admin",
      actionLabel: formatAuditActionLabel(item.actionType),
      entityLabel: formatAuditEntityLabel(item.entityType, item.entityId),
      entityMeta,
      reason: item.reason || "No reason provided",
      createdAt: item.createdAt,
      previousStatus: change?.previousStatus ?? null,
      nextStatus: change?.nextStatus ?? null,
      previousTone: getAuditStatusBadgeTone(item.entityType, change?.previousStatusRaw ?? null),
      nextTone: getAuditStatusBadgeTone(item.entityType, change?.nextStatusRaw ?? null),
      itemCount: 1,
      itemIds: [item.id],
    };

    const previousEvent = events[events.length - 1];
    const previousItemTimestamp = previousEvent ? new Date(previousEvent.createdAt).getTime() : 0;
    const currentTimestamp = new Date(item.createdAt).getTime();
    const shouldCollapse = Boolean(
      previousEvent &&
        change &&
        previousEvent.previousStatus !== null &&
        previousEvent.nextStatus !== null &&
        previousEvent.adminLabel === nextEvent.adminLabel &&
        previousEvent.actionLabel === nextEvent.actionLabel &&
        previousEvent.entityLabel === nextEvent.entityLabel &&
        Math.abs(previousItemTimestamp - currentTimestamp) <= 1000 * 60 * 20
    );

    if (!shouldCollapse) {
      events.push(nextEvent);
      return events;
    }

    previousEvent.itemCount += 1;
    previousEvent.itemIds.push(item.id);
    previousEvent.previousStatus = nextEvent.previousStatus ?? previousEvent.previousStatus;
    previousEvent.previousTone = getAuditStatusBadgeTone(item.entityType, change?.previousStatusRaw ?? null);
    if (!previousEvent.reason || previousEvent.reason === "No reason provided") {
      previousEvent.reason = nextEvent.reason;
    }
    previousEvent.key = `${previousEvent.key}-${item.id}`;
    return events;
  }, []);
}

function AuditTimelineList({
  logs,
  emptyTitle,
  emptyDescription,
  compact = false,
}: {
  logs: AdminAuditLogEntry[];
  emptyTitle: string;
  emptyDescription: string;
  compact?: boolean;
}) {
  const events = buildAuditTimelineEvents(logs);

  if (events.length === 0) {
    return <AdminEmptyState compact={compact} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={compact ? "admin-audit-timeline admin-audit-timeline--compact" : "admin-audit-timeline"}>
      {events.map((event) => (
        <article key={event.key} className="admin-audit-timeline__item">
          <div className="admin-audit-timeline__head">
            <div className="admin-audit-timeline__title-wrap">
              <strong className="admin-audit-timeline__title">{event.actionLabel}</strong>
              {event.itemCount > 1 ? <AdminBadge tone="gold">Grouped {event.itemCount} edits</AdminBadge> : null}
            </div>
            <span className="admin-audit-timeline__time">{formatDateLabel(event.createdAt)}</span>
          </div>
          <div className="admin-audit-timeline__meta">
            <span className="admin-audit-timeline__admin">{event.adminLabel}</span>
            <span className="admin-audit-timeline__dot" aria-hidden="true">
              •
            </span>
            <span className="admin-audit-timeline__entity">{event.entityLabel}</span>
            {event.entityMeta ? (
              <>
                <span className="admin-audit-timeline__dot" aria-hidden="true">
                  •
                </span>
                <span className="admin-audit-timeline__entity">{event.entityMeta}</span>
              </>
            ) : null}
          </div>
          {event.previousStatus || event.nextStatus ? (
            <div className="admin-audit-timeline__status-flow" aria-label="Status change">
              {event.previousStatus ? <AdminBadge tone={event.previousTone}>{event.previousStatus}</AdminBadge> : <span className="admin-audit__status-placeholder">Set from empty</span>}
              <span className="admin-audit__status-arrow" aria-hidden="true">
                →
              </span>
              {event.nextStatus ? <AdminBadge tone={event.nextTone}>{event.nextStatus}</AdminBadge> : <span className="admin-audit__status-placeholder">Cleared</span>}
            </div>
          ) : null}
          <p className="admin-audit-timeline__reason">{event.reason}</p>
        </article>
      ))}
    </div>
  );
}

function isRiskyTelegramOverride(currentStatus?: string, nextStatus?: string) {
  const current = (currentStatus ?? "").trim().toLowerCase();
  const next = (nextStatus ?? "").trim().toLowerCase();
  if (!current || !next || current === next) {
    return false;
  }
  return next === "cancelled" || next === "rejected" || next === "no_show";
}

function getSubmissionPulseStatus(latestApplicationAt?: string) {
  if (!latestApplicationAt) {
    return {
      label: "No activity yet",
      tone: "default" as const,
      detail: "No applications have been recorded yet.",
    };
  }

  const latest = new Date(latestApplicationAt);
  if (Number.isNaN(latest.getTime())) {
    return {
      label: "Status unknown",
      tone: "default" as const,
      detail: "Latest application timestamp could not be read.",
    };
  }

  const minutesAgo = Math.max(0, Math.round((Date.now() - latest.getTime()) / 60000));
  if (minutesAgo <= 60) {
    return {
      label: "Live now",
      tone: "emerald" as const,
      detail: "An application arrived within the last hour.",
    };
  }
  if (minutesAgo <= 180) {
    return {
      label: "Active",
      tone: "gold" as const,
      detail: "Guests have been applying recently today.",
    };
  }
  if (minutesAgo <= 720) {
    return {
      label: "Cooling off",
      tone: "default" as const,
      detail: "Application activity has slowed over the last few hours.",
    };
  }
  return {
    label: "Quiet",
    tone: "default" as const,
    detail: "No recent applications in the last several hours.",
  };
}

function formatSourceLabel(value?: string) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "telegram":
    case "telegram_bot":
      return "Telegram";
    case "landing":
    case "landing_page":
      return "Landing";
    case "manual_admin_entry":
      return "Manual admin";
    default:
      return value || "—";
  }
}

function getSourceBadgeTone(value?: string): "default" | "gold" | "emerald" | "danger" {
  switch ((value ?? "").trim().toLowerCase()) {
    case "landing":
    case "landing_page":
      return "gold";
    case "telegram":
    case "telegram_bot":
      return "default";
    case "manual_admin_entry":
      return "danger";
    default:
      return "default";
  }
}

function renderSourceBadge(value?: string) {
  return (
    <AdminBadge tone={getSourceBadgeTone(value)}>
      {formatSourceLabel(value)}
    </AdminBadge>
  );
}

function formatTablePreference(value?: string) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "shared":
      return "Shared";
    case "private":
      return "Separate";
    default:
      return "—";
  }
}

function toDateInputValue(value?: string) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value: string): number | null {
  const normalized = value.trim();
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function buildSettingsForm(settings: AdminPanelResponse["settings"]): SettingsFormState {
  return {
    adminTokenTTLMinutes: String(settings.adminTokenTTLMinutes ?? 60),
    adminLoginPerMinute: String(settings.rateLimits.adminLoginPerMinute ?? 10),
    joinFormPer20MinByIP: String(settings.rateLimits.joinFormPer20MinByIP ?? 5),
    joinSelectionPer20MinByIP: String(settings.rateLimits.joinSelectionPer20MinByIP ?? 5),
    minJoinFormFillDurationMs: String(settings.runtime.minJoinFormFillDurationMs ?? 3000),
    panelAutoRefreshSeconds: String(settings.runtime.panelAutoRefreshSeconds ?? 0),
    adminUsersPageSize: String(settings.runtime.adminUsersPageSize ?? USERS_PAGE_SIZE),
    maintenanceMode: Boolean(settings.runtime.maintenanceMode),
    allowJoinApplications: Boolean(settings.runtime.allowJoinApplications),
    allowJoinSelections: Boolean(settings.runtime.allowJoinSelections),
    allowAdminDinnerMutations: Boolean(settings.runtime.allowAdminDinnerMutations),
    allowAdminUserStatusEdits: Boolean(settings.runtime.allowAdminUserStatusEdits),
  };
}

function buildSparkline(values: number[], width = 560, height = 180, padding = 14): SparklineGeometry {
  if (values.length === 0) {
    return { linePath: "", areaPath: "" };
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = padding + index * stepX;
    const y = padding + innerHeight - (value / max) * innerHeight;
    return { x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const baselineY = padding + innerHeight;
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding} ${baselineY} L ${points[0]?.x ?? padding} ${baselineY} Z`;

  return { linePath, areaPath };
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [dinners, setDinners] = useState<AdminDinner[]>([]);
  const [dinnersLoading, setDinnersLoading] = useState(false);
  const [dinnerFormOpen, setDinnerFormOpen] = useState(false);
  const [dinnerSaving, setDinnerSaving] = useState(false);
  const [dinnerDeleting, setDinnerDeleting] = useState(false);
  const [dinnerDeleteTarget, setDinnerDeleteTarget] = useState<AdminDinner | null>(null);
  const [dinnerFormError, setDinnerFormError] = useState("");
  const [dinnerForm, setDinnerForm] = useState<DinnerFormState>(emptyDinnerForm);
  const [dishTypes, setDishTypes] = useState<string[]>([]);
  const [dishType, setDishType] = useState<string>("");
  const [dishes, setDishes] = useState<AdminDishItem[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesError, setDishesError] = useState("");
  const [dishSaving, setDishSaving] = useState(false);
  const [dishForm, setDishForm] = useState<DishFormState>(emptyDishForm);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [usersSource, setUsersSource] = useState<UsersSource>("landing");
  const [bookingsSource, setBookingsSource] = useState<BookingsSource>("telegram");
  const [usersStatus, setUsersStatus] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [landingUsers, setLandingUsers] = useState<AdminLandingUser[]>([]);
  const [telegramUsers, setTelegramUsers] = useState<AdminTelegramUser[]>([]);
  const [telegramApplications, setTelegramApplications] = useState<AdminTelegramApplication[]>([]);
  const [telegramApplicationsSummary, setTelegramApplicationsSummary] = useState<AdminTelegramApplicationsSummary>({
    total: 0,
    pendingApplication: 0,
    approved: 0,
    waitingPayment: 0,
    paid: 0,
    cancelled: 0,
    rejected: 0,
    noShow: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [selectionStatusSaving, setSelectionStatusSaving] = useState<Record<string, boolean>>({});
  const [applicationSaving, setApplicationSaving] = useState<Record<number, boolean>>({});
  const [bookingManageTarget, setBookingManageTarget] = useState<AdminTelegramApplication | null>(null);
  const [bookingManageStatus, setBookingManageStatus] = useState<AdminTelegramApplication["status"] | "">("");
  const [bookingManageNote, setBookingManageNote] = useState("");
  const [bookingManageReason, setBookingManageReason] = useState("");
  const [bookingManageError, setBookingManageError] = useState("");
  const [expandedTelegramBookingId, setExpandedTelegramBookingId] = useState<number | null>(null);
  const [expandedGuestKey, setExpandedGuestKey] = useState<string | null>(null);
  const [guestTelegramApplications, setGuestTelegramApplications] = useState<AdminTelegramApplication[]>([]);
  const [telegramRecentApplications, setTelegramRecentApplications] = useState<AdminTelegramApplication[]>([]);
  const bookingManagerRef = useRef<HTMLElement | null>(null);
  const bookingManagerCloseRef = useRef<HTMLButtonElement | null>(null);
  const bookingManagerLastFocusRef = useRef<HTMLElement | null>(null);
  const [landingUsersSummary, setLandingUsersSummary] = useState<AdminLandingUsersSummary>({ total: 0, completed: 0, open: 0 });
  const [telegramUsersSummary, setTelegramUsersSummary] = useState<AdminTelegramUsersSummary>({
    total: 0,
    termsAccepted: 0,
    payingUsers: 0,
    blockedActive: 0,
  });

  const loadPanel = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const response = await getAdminPanel();
      setData(response);
      setSettingsForm(buildSettingsForm(response.settings));
      setSettingsError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load panel");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadDinners = async () => {
    setDinnersLoading(true);
    try {
      const items = await getAdminDinners();
      setDinners(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load dinners");
    } finally {
      setDinnersLoading(false);
    }
  };

  const loadUsers = async (append = false) => {
    setUsersLoading(true);
    setUsersError("");

    const pageSize = Math.max(
      5,
      Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE)
    );
    const nextOffset = append ? usersOffset : 0;

    try {
      if (usersSource === "landing") {
        const response = await getAdminLandingUsers({
          search: searchQuery.trim(),
          status: usersStatus === "all" ? "" : usersStatus,
          limit: pageSize,
          offset: nextOffset,
        });
        setLandingUsers((prev) => (append ? [...prev, ...response.users] : response.users));
        setLandingUsersSummary(response.summary);
        setUsersHasMore(response.users.length === pageSize);
      } else {
        const response = await getAdminTelegramUsers({
          search: searchQuery.trim(),
          status: usersStatus === "all" ? "" : usersStatus,
          limit: pageSize,
          offset: nextOffset,
        });
        setTelegramUsers((prev) => (append ? [...prev, ...response.users] : response.users));
        setTelegramUsersSummary(response.summary);
        setUsersHasMore(response.users.length === pageSize);
      }

      setUsersOffset(nextOffset + pageSize);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadGuestTelegramApplications = async () => {
    try {
      const response = await getAdminTelegramApplications({
        search: searchQuery.trim(),
        status: "",
        limit: Math.max(100, Math.min(500, (data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE) * 10)),
        offset: 0,
      });
      setGuestTelegramApplications(response.applications);
    } catch {
      setGuestTelegramApplications([]);
    }
  };

  const loadTelegramRecentActivity = async () => {
    try {
      const response = await getAdminTelegramApplications({
        search: "",
        status: "",
        limit: 8,
        offset: 0,
      });
      setTelegramRecentApplications(response.applications);
    } catch {
      setTelegramRecentApplications([]);
    }
  };

  const loadTelegramApplications = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const response = await getAdminTelegramApplications({
        search: searchQuery.trim(),
        status: usersStatus === "all" ? "" : usersStatus,
        limit: Math.max(5, Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE)),
        offset: 0,
      });
      setTelegramApplications(response.applications);
      setTelegramApplicationsSummary(response.summary);
      const logs = await getAdminAuditLogs(12);
      setAuditLogs(logs);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load telegram applications");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadOverviewOperations = async () => {
    try {
      const response = await getAdminTelegramApplications({
        search: "",
        status: "",
        limit: Math.max(20, Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE)),
        offset: 0,
      });
      setTelegramApplicationsSummary(response.summary);
      const logs = await getAdminAuditLogs(12);
      setAuditLogs(logs);
    } catch {
      // Keep overview resilient even if telegram booking storage is unavailable.
    }
  };

  const loadLandingBookings = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const response = await getAdminLandingUsers({
        search: searchQuery.trim(),
        status: usersStatus === "all" ? "" : usersStatus,
        limit: Math.max(5, Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE)),
        offset: 0,
      });
      setLandingUsers(response.users);
      setLandingUsersSummary(response.summary);
      const logs = await getAdminAuditLogs(12);
      setAuditLogs(logs);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load landing applications");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await getAdminAuditLogs(24);
      setAuditLogs(logs);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load admin audit logs");
    }
  };

  useEffect(() => {
    void loadPanel();
  }, []);

  useEffect(() => {
    if (activeSection === "dinners" || activeSection === "overview" || activeSection === "bookings") {
      void loadDinners();
    }
  }, [activeSection]);

  const loadDishTypes = async () => {
    setDishesError("");
    setDishesLoading(true);
    try {
      const types = await getAdminDishTypes();
      setDishTypes(types);
      if (!dishType && types.length > 0) {
        setDishType(types[0] ?? "");
        setDishForm((prev) => ({ ...prev, dishType: types[0] ?? "" }));
      }
    } catch (err) {
      setDishesError(err instanceof Error ? err.message : "failed to load dish types");
    } finally {
      setDishesLoading(false);
    }
  };

  const loadDishes = async (type: string) => {
    if (!type) {
      setDishes([]);
      return;
    }
    setDishesError("");
    setDishesLoading(true);
    try {
      const items = await getAdminDishesByType(type);
      setDishes(items);
    } catch (err) {
      setDishesError(err instanceof Error ? err.message : "failed to load dishes");
    } finally {
      setDishesLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection !== "menu") {
      return;
    }
    void loadDishTypes();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "menu") {
      return;
    }
    if (!dishType) {
      return;
    }
    void loadDishes(dishType);
  }, [activeSection, dishType]);

  useEffect(() => {
    if (activeSection !== "guests") {
      return;
    }
    setUsersOffset(0);
    void loadUsers(false);
  }, [activeSection, usersSource, usersStatus, searchQuery]);

  useEffect(() => {
    if (activeSection !== "guests" || usersSource !== "telegram") {
      return;
    }
    void loadGuestTelegramApplications();
  }, [activeSection, usersSource, searchQuery, data?.settings?.runtime?.adminUsersPageSize]);

  useEffect(() => {
    if (activeSection !== "bookings") {
      return;
    }
    if (bookingsSource === "landing") {
      void loadLandingBookings();
      return;
    }
    void loadTelegramApplications();
  }, [activeSection, bookingsSource, usersStatus, searchQuery]);

  useEffect(() => {
    if (activeSection !== "overview") {
      return;
    }
    void loadOverviewOperations();
  }, [activeSection, data?.settings?.runtime?.adminUsersPageSize]);

  useEffect(() => {
    if (activeSection !== "audit" && activeSection !== "operations") {
      return;
    }
    void loadAuditLogs();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "telegram") {
      return;
    }
    void loadAuditLogs();
    void loadTelegramRecentActivity();
  }, [activeSection]);

  useEffect(() => {
    const intervalSec = data?.settings?.runtime?.panelAutoRefreshSeconds ?? 0;
    if (intervalSec <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      if (activeSection === "dinners") {
        void loadDinners();
        return;
      }
      if (activeSection === "guests") {
        setUsersOffset(0);
        void loadUsers(false);
        return;
      }
      if (activeSection === "bookings") {
        if (bookingsSource === "landing") {
          void loadLandingBookings();
          return;
        }
        void loadTelegramApplications();
        return;
      }
      if (activeSection === "audit" || activeSection === "operations") {
        void loadAuditLogs();
        return;
      }
      void loadPanel(true);
    }, intervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [data?.settings.runtime.panelAutoRefreshSeconds, activeSection, usersSource, bookingsSource, usersStatus, searchQuery]);

  useEffect(() => {
    if (!dinnerDeleteTarget) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dinnerDeleting) {
        setDinnerDeleteTarget(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dinnerDeleteTarget, dinnerDeleting]);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  const handleRefresh = async () => {
    if (activeSection === "dinners") {
      await loadDinners();
      return;
    }
    if (activeSection === "guests") {
      setUsersOffset(0);
      await loadUsers(false);
      return;
    }
    if (activeSection === "bookings") {
      if (bookingsSource === "landing") {
        await loadLandingBookings();
        return;
      }
      await loadTelegramApplications();
      return;
    }
    if (activeSection === "audit" || activeSection === "operations") {
      await loadAuditLogs();
      return;
    }
    if (activeSection === "menu") {
      await loadDishTypes();
      if (dishType) {
        await loadDishes(dishType);
      }
      return;
    }
    await loadPanel(true);
  };

  const handleLoadMoreUsers = async () => {
    if (usersLoading || !usersHasMore) {
      return;
    }
    await loadUsers(true);
  };

  const handleUpdateLandingUserStatus = async (userID: string, status: AdminLandingUser["selectionStatus"]) => {
    setSelectionStatusSaving((prev) => ({ ...prev, [userID]: true }));
    setUsersError("");
    try {
      await updateAdminLandingUserStatus(userID, status);
      setLandingUsers((prev) => prev.map((user) => (user.id === userID ? { ...user, selectionStatus: status } : user)));
      setInfoMessage("User status updated");
      window.setTimeout(() => setInfoMessage(""), 1500);
      if (activeSection === "bookings") {
        const logs = await getAdminAuditLogs(12);
        setAuditLogs(logs);
      }
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to update user status");
    } finally {
      setSelectionStatusSaving((prev) => {
        const next = { ...prev };
        delete next[userID];
        return next;
      });
    }
  };

  const handleUpdateTelegramApplication = async (
    application: AdminTelegramApplication,
    status: AdminTelegramApplication["status"],
    noteOverride?: string,
    reasonOverride?: string
  ) => {
    setApplicationSaving((prev) => ({ ...prev, [application.packageInfoId]: true }));
    setUsersError("");
    if (bookingManageTarget?.packageInfoId === application.packageInfoId) {
      setBookingManageError("");
    }
    try {
      const nextNote = noteOverride ?? application.adminNote;
      const nextReason = (reasonOverride ?? "").trim();
      const updated = await updateAdminTelegramApplication(application.packageInfoId, {
        status,
        note: nextNote,
        reason: nextReason,
        expectedUpdatedAt: application.updatedAt,
      });
      setTelegramApplications((prev) =>
        prev.map((item) => (item.packageInfoId === updated.packageInfoId ? updated : item))
      );
      if (bookingManageTarget?.packageInfoId === updated.packageInfoId) {
        setBookingManageTarget(updated);
        setBookingManageStatus(updated.status);
        setBookingManageNote(updated.adminNote || "");
        setBookingManageReason("");
      }
      setInfoMessage(`Application ${updated.publicCode || `#${updated.packageInfoId}`} updated`);
      window.setTimeout(() => setInfoMessage(""), 1800);
      const logs = await getAdminAuditLogs(12);
      setAuditLogs(logs);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update telegram application";
      if (bookingManageTarget?.packageInfoId === application.packageInfoId) {
        setBookingManageError(message);
      } else {
        setUsersError(message);
      }
      return false;
    } finally {
      setApplicationSaving((prev) => {
        const next = { ...prev };
        delete next[application.packageInfoId];
        return next;
      });
    }
  };

  const openTelegramBookingManager = (application: AdminTelegramApplication) => {
    setBookingManageTarget(application);
    setBookingManageStatus(application.status);
    setBookingManageNote(application.adminNote || "");
    setBookingManageReason("");
    setBookingManageError("");
  };

  const closeTelegramBookingManager = (force = false) => {
    if (!force && bookingManageTarget && applicationSaving[bookingManageTarget.packageInfoId]) {
      return;
    }
    setBookingManageTarget(null);
    setBookingManageStatus("");
    setBookingManageNote("");
    setBookingManageReason("");
    setBookingManageError("");
  };

  const toggleTelegramBookingExpanded = (packageInfoId: number) => {
    setExpandedTelegramBookingId((current) => (current === packageInfoId ? null : packageInfoId));
  };

  const handleSaveTelegramBookingManager = async () => {
    if (!bookingManageTarget || !bookingManageStatus) {
      return;
    }
    if (isRiskyTelegramOverride(bookingManageTarget.status, bookingManageStatus) && !bookingManageReason.trim()) {
      setBookingManageError("Reason is required for risky status overrides like cancelled, rejected, or no-show.");
      return;
    }
    setBookingManageError("");
    const saved = await handleUpdateTelegramApplication(
      bookingManageTarget,
      bookingManageStatus,
      bookingManageNote,
      bookingManageReason
    );
    if (saved) {
      closeTelegramBookingManager(true);
    }
  };

  const handleExport = () => {
    if (!data) {
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `secret-dinner-admin-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setInfoMessage("Snapshot exported");
    window.setTimeout(() => setInfoMessage(""), 1500);
  };

  const handleCopyFrontendOrigin = async () => {
    if (!settings.frontendOrigin) {
      return;
    }
    try {
      await navigator.clipboard.writeText(settings.frontendOrigin);
      setInfoMessage("Frontend origin copied");
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch {
      setInfoMessage("Could not copy");
      window.setTimeout(() => setInfoMessage(""), 1500);
    }
  };

  const handleCreateDish = async () => {
    setDishesError("");
    setDishSaving(true);
    try {
      const price = Number(dishForm.price);
      const created = await createAdminDish({
        dishType: dishForm.dishType,
        nameEng: dishForm.nameEng.trim(),
        nameRus: dishForm.nameRus.trim(),
        nameArm: dishForm.nameArm.trim(),
        price,
      });
      setInfoMessage("Dish created");
      window.setTimeout(() => setInfoMessage(""), 1500);
      if (created.dishType === dishType) {
        setDishes((prev) => [created, ...prev]);
      } else if (dishType) {
        await loadDishes(dishType);
      }
      setDishForm((prev) => ({ ...emptyDishForm, dishType: prev.dishType || dishType }));
    } catch (err) {
      setDishesError(err instanceof Error ? err.message : "failed to create dish");
    } finally {
      setDishSaving(false);
    }
  };

  const handleStartCreateDinner = () => {
    setDinnerFormError("");
    setDinnerForm({ ...emptyDinnerForm });
    setDinnerFormOpen(true);
  };

  const handleStartEditDinner = (item: AdminDinner) => {
    setDinnerFormError("");
    setDinnerForm({
      id: item.id,
      description: item.description,
      location: item.location,
      dinnerDate: toDateInputValue(item.dinnerDate),
      places: String(item.places),
      silverPrice: item.silverPrice != null ? String(item.silverPrice) : "",
      goldPrice: item.goldPrice != null ? String(item.goldPrice) : "",
      vipPrice: item.vipPrice != null ? String(item.vipPrice) : "",
      expired: item.expired,
    });
    setDinnerFormOpen(true);
  };

  const handleDeleteDinner = (item: AdminDinner) => {
    setDinnerFormError("");
    setDinnerDeleteTarget(item);
  };

  const confirmDeleteDinner = async () => {
    if (!dinnerDeleteTarget) {
      return;
    }

    setDinnerDeleting(true);
    try {
      await deleteAdminDinner(dinnerDeleteTarget.id);
      await Promise.all([loadDinners(), loadPanel(true)]);
      setInfoMessage(`Dinner #${dinnerDeleteTarget.id} deleted`);
      window.setTimeout(() => setInfoMessage(""), 1500);
      setDinnerDeleteTarget(null);
    } catch (err) {
      setDinnerFormError(err instanceof Error ? err.message : "failed to delete dinner");
    } finally {
      setDinnerDeleting(false);
    }
  };

  const handleSyncDinners = async () => {
    try {
      await syncAdminDinners();
      await loadDinners();
      setInfoMessage("Registration counts synced");
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch (err) {
      setDinnerFormError(err instanceof Error ? err.message : "failed to sync dinners");
    }
  };

  const handleSaveDinner = async () => {
    setDinnerFormError("");
    const description = dinnerForm.description.trim();
    const location = dinnerForm.location.trim();
    if (description === "" || location === "" || dinnerForm.dinnerDate.trim() === "" || dinnerForm.places.trim() === "") {
      setDinnerFormError("Description, location, date and places are required.");
      return;
    }

    const placesNumber = Number(dinnerForm.places);
    if (!Number.isFinite(placesNumber) || placesNumber < 0) {
      setDinnerFormError("Places must be a valid number >= 0.");
      return;
    }

    const payload = {
      description,
      location,
      dinnerDate: dinnerForm.dinnerDate,
      places: placesNumber,
      silverPrice: parseOptionalNumber(dinnerForm.silverPrice),
      goldPrice: parseOptionalNumber(dinnerForm.goldPrice),
      vipPrice: parseOptionalNumber(dinnerForm.vipPrice),
      expired: dinnerForm.expired,
    };

    setDinnerSaving(true);
    try {
      if (dinnerForm.id) {
        await updateAdminDinner(dinnerForm.id, payload);
      } else {
        await createAdminDinner(payload);
      }
      setDinnerFormOpen(false);
      setDinnerForm({ ...emptyDinnerForm });
      await Promise.all([loadDinners(), loadPanel(true)]);
      setInfoMessage(dinnerForm.id ? "Dinner updated" : "Dinner created");
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch (err) {
      setDinnerFormError(err instanceof Error ? err.message : "failed to save dinner");
    } finally {
      setDinnerSaving(false);
    }
  };

  const handleResetSettings = () => {
    setSettingsForm(buildSettingsForm(settings));
    setSettingsError("");
  };

  const handleSaveSettings = async () => {
    if (!settingsForm) {
      return;
    }

    setSettingsError("");

    const adminTokenTTLMinutes = parsePositiveInt(settingsForm.adminTokenTTLMinutes);
    const adminLoginPerMinute = parsePositiveInt(settingsForm.adminLoginPerMinute);
    const joinFormPer20MinByIP = parsePositiveInt(settingsForm.joinFormPer20MinByIP);
    const joinSelectionPer20MinByIP = parsePositiveInt(settingsForm.joinSelectionPer20MinByIP);
    const minJoinFormFillDurationMs = parsePositiveInt(settingsForm.minJoinFormFillDurationMs);
    const panelAutoRefreshSeconds = Number(settingsForm.panelAutoRefreshSeconds.trim());
    const adminUsersPageSize = parsePositiveInt(settingsForm.adminUsersPageSize);

    if (!adminTokenTTLMinutes || !adminLoginPerMinute || !joinFormPer20MinByIP || !joinSelectionPer20MinByIP || !minJoinFormFillDurationMs || !adminUsersPageSize) {
      setSettingsError("All numeric settings must be positive integers.");
      return;
    }
    if (!Number.isFinite(panelAutoRefreshSeconds) || panelAutoRefreshSeconds < 0 || panelAutoRefreshSeconds > 300) {
      setSettingsError("Auto-refresh seconds must be between 0 and 300.");
      return;
    }

    const payload: AdminSettingsPayload = {
      adminTokenTTLMinutes,
      adminLoginPerMinute,
      joinFormPer20MinByIP,
      joinSelectionPer20MinByIP,
      minJoinFormFillDurationMs,
      panelAutoRefreshSeconds: Math.floor(panelAutoRefreshSeconds),
      adminUsersPageSize,
      maintenanceMode: settingsForm.maintenanceMode,
      allowJoinApplications: settingsForm.allowJoinApplications,
      allowJoinSelections: settingsForm.allowJoinSelections,
      allowAdminDinnerMutations: settingsForm.allowAdminDinnerMutations,
      allowAdminUserStatusEdits: settingsForm.allowAdminUserStatusEdits,
    };

    setSettingsSaving(true);
    try {
      const updatedSettings = await updateAdminSettings(payload);
      setData((prev) => (prev ? { ...prev, settings: updatedSettings } : prev));
      setSettingsForm(buildSettingsForm(updatedSettings));
      setInfoMessage("Settings updated");
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "failed to update settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const landing = data?.landing;
  const telegram = data?.telegram;
  const telegramStats = telegram?.stats;
  const meta = data?.meta ?? {
    generatedAt: "",
    username: "—",
  };
  const settings = data?.settings ?? {
    frontendOrigin: "",
    listenAddr: "",
    adminCookieSecure: false,
    adminTokenTTLMinutes: 0,
    telegramDatabaseConfigured: false,
    rateLimits: {
      adminLoginPerMinute: 0,
      joinFormPer20MinByIP: 0,
      joinSelectionPer20MinByIP: 0,
    },
    runtime: {
      maintenanceMode: false,
      allowJoinApplications: true,
      allowJoinSelections: true,
      minJoinFormFillDurationMs: 3000,
      panelAutoRefreshSeconds: 0,
      adminUsersPageSize: USERS_PAGE_SIZE,
      allowAdminDinnerMutations: true,
      allowAdminUserStatusEdits: true,
    },
  };

  const totalUsers = landing?.totalUsers ?? 0;
  const completedSelections = landing?.completedSelections ?? 0;
  const pendingSelections = landing?.pendingSelections ?? 0;
  const completionPercent = totalUsers > 0 ? Math.round((completedSelections / totalUsers) * 100) : 0;

  const dashboardDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const landingBars = useMemo(
    () =>
      buildPackageBars(
        landing?.packageBreakdown ?? {
          silver: 0,
          gold: 0,
          vip: 0,
          custom: 0,
          unselected: 0,
        }
      ),
    [landing]
  );

  const telegramBars = useMemo(
    () =>
      buildPackageBars(
        telegramStats?.packageBreakdown ?? {
          silver: 0,
          gold: 0,
          vip: 0,
          custom: 0,
          unselected: 0,
        }
      ),
    [telegramStats]
  );

  const landingDailyTrendBars = useMemo(() => {
    const submissions = landing?.dailySubmissions ?? [];
    const selectionsMap = new Map((landing?.dailySelections ?? []).map((item) => [item.day, item.count]));
    const points = submissions.map((item) => ({
      label: item.day.slice(5),
      primary: item.count,
      secondary: selectionsMap.get(item.day) ?? 0,
    }));
    const max = Math.max(
      1,
      ...points.map((point) => point.primary),
      ...points.map((point) => point.secondary)
    );
    return points.map((point) => ({
      ...point,
      primaryHeight: normalizeHeight(point.primary, max),
      secondaryHeight: normalizeHeight(point.secondary, max),
    })) as DualTrendBar[];
  }, [landing?.dailySubmissions, landing?.dailySelections]);

  const landingHourlyBars = useMemo(() => {
    const points = landing?.hourlySubmissions ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.hour.slice(0, 2),
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [landing?.hourlySubmissions]);

  const landingFlowSummary = useMemo(() => {
    const submissions = landingDailyTrendBars.reduce((sum, point) => sum + point.primary, 0);
    const selections = landingDailyTrendBars.reduce((sum, point) => sum + point.secondary, 0);
    return {
      submissions,
      selections,
      conversion: submissions > 0 ? (selections / submissions) * 100 : 0,
    };
  }, [landingDailyTrendBars]);

  const landingHourlySparkline = useMemo(() => {
    const values = landingHourlyBars.map((point) => point.value);
    return {
      labels: landingHourlyBars.map((point) => point.label),
      geometry: buildSparkline(values),
    };
  }, [landingHourlyBars]);

  const landingPeakHour = useMemo(() => {
    if (landingHourlyBars.length === 0) {
      return "—";
    }
    const peak = landingHourlyBars.reduce((best, point) => (point.value > best.value ? point : best), landingHourlyBars[0]);
    return `${peak.label}:00`;
  }, [landingHourlyBars]);

  const landingPulseSummary = useMemo(() => {
    const total24h = landingHourlyBars.reduce((sum, point) => sum + point.value, 0);
    const avgPerHour = total24h > 0 ? total24h / Math.max(landingHourlyBars.length, 1) : 0;
    return {
      total24h,
      avgPerHour,
      status: getSubmissionPulseStatus(landing?.latestApplicationAt),
    };
  }, [landing?.latestApplicationAt, landingHourlyBars]);

  const telegramOrderRevenueBars = useMemo(() => {
    const points = telegramStats?.dailyOrders ?? [];
    const maxOrders = Math.max(1, ...points.map((point) => point.orders));
    const maxRevenue = Math.max(1, ...points.map((point) => point.revenue));
    return points.map((point) => ({
      label: point.day.slice(5),
      primary: point.orders,
      secondary: point.revenue,
      primaryHeight: normalizeHeight(point.orders, maxOrders),
      secondaryHeight: normalizeHeight(point.revenue, maxRevenue),
    })) as DualTrendBar[];
  }, [telegramStats?.dailyOrders]);

  const telegramDailyUsersBars = useMemo(() => {
    const points = telegramStats?.dailyNewUsers ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.day.slice(5),
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [telegramStats?.dailyNewUsers]);

  const telegramOrdersRevenueSparkline = useMemo(() => {
    const orders = telegramOrderRevenueBars.map((point) => point.primary);
    const revenue = telegramOrderRevenueBars.map((point) => point.secondary);
    return {
      labels: telegramOrderRevenueBars.map((point) => point.label),
      orders: buildSparkline(orders),
      revenue: buildSparkline(revenue),
    };
  }, [telegramOrderRevenueBars]);

  const telegramDailyUsersSparkline = useMemo(() => {
    const values = telegramDailyUsersBars.map((point) => point.value);
    return {
      labels: telegramDailyUsersBars.map((point) => point.label),
      geometry: buildSparkline(values),
    };
  }, [telegramDailyUsersBars]);

  const telegramNewUsers24h = telegramDailyUsersBars[telegramDailyUsersBars.length - 1]?.value ?? 0;
  const telegramNewUsers7d = telegramDailyUsersBars.slice(-7).reduce((sum, point) => sum + point.value, 0);
  const telegramActiveUsersCount = Math.max(0, (telegramStats?.totalUsers ?? 0) - (telegramStats?.blockedActive ?? 0));
  const telegramApplicationsStarted = telegramStats?.totalUsers ?? 0;
  const telegramApplicationsSubmitted = telegramApplicationsSummary.total;
  const telegramPaidBookings = telegramApplicationsSummary.paid;
  const telegramLegalAccepted = telegramStats?.acceptedTermsUsers ?? telegramUsersSummary.termsAccepted;
  const telegramReferralActivity = telegramStats?.referralsTotal ?? 0;
  const telegramFunnelConversion = telegramApplicationsStarted > 0 ? (telegramApplicationsSubmitted / telegramApplicationsStarted) * 100 : 0;
  const telegramPaidConversion = telegramApplicationsSubmitted > 0 ? (telegramPaidBookings / telegramApplicationsSubmitted) * 100 : 0;

  const landingWeekdayFlowBars = useMemo(() => {
    const submissions = landing?.weekdaySubmissions ?? [];
    const selectionsMap = new Map((landing?.weekdaySelections ?? []).map((item) => [item.label, item.count]));
    const points = submissions.map((item) => ({
      label: item.label,
      primary: item.count,
      secondary: selectionsMap.get(item.label) ?? 0,
    }));
    const max = Math.max(
      1,
      ...points.map((point) => point.primary),
      ...points.map((point) => point.secondary)
    );
    return points.map((point) => ({
      ...point,
      primaryHeight: normalizeHeight(point.primary, max),
      secondaryHeight: normalizeHeight(point.secondary, max),
    })) as DualTrendBar[];
  }, [landing?.weekdaySubmissions, landing?.weekdaySelections]);

  const landingGuestBars = useMemo(() => {
    const points = landing?.guestDistribution ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.label,
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [landing?.guestDistribution]);

  const landingLagBars = useMemo(() => {
    const points = landing?.selectionLagBuckets ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.label,
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [landing?.selectionLagBuckets]);

  const telegramHourlyRegistrationsBars = useMemo(() => {
    const points = telegramStats?.registrationsByHour ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.hour.slice(0, 2),
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [telegramStats?.registrationsByHour]);

  const telegramWeekdayBars = useMemo(() => {
    const points = telegramStats?.ordersByWeekday ?? [];
    const max = Math.max(1, ...points.map((point) => point.count));
    return points.map((point) => ({
      label: point.label,
      value: point.count,
      height: normalizeHeight(point.count, max),
    })) as SingleTrendBar[];
  }, [telegramStats?.ordersByWeekday]);

  const packageRevenueRows = useMemo(() => {
    const points = telegramStats?.revenueByPackage ?? [];
    const total = points.reduce((sum, item) => sum + item.value, 0);
    return points.map((item) => ({
      ...item,
      share: total > 0 ? (item.value / total) * 100 : 0,
    }));
  }, [telegramStats?.revenueByPackage]);

  const dinnerFillBandRows = useMemo(() => {
    const points = telegramStats?.dinnerFillBands ?? [];
    const total = points.reduce((sum, item) => sum + item.count, 0);
    return points.map((item) => ({
      ...item,
      share: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }, [telegramStats?.dinnerFillBands]);

  const landingWeekdaySparkline = useMemo(() => {
    const submissions = landingWeekdayFlowBars.map((point) => point.primary);
    const selections = landingWeekdayFlowBars.map((point) => point.secondary);
    return {
      labels: landingWeekdayFlowBars.map((point) => point.label),
      submissions: buildSparkline(submissions),
      selections: buildSparkline(selections),
    };
  }, [landingWeekdayFlowBars]);

  const telegramHourlySparkline = useMemo(() => {
    const values = telegramHourlyRegistrationsBars.map((point) => point.value);
    return {
      labels: telegramHourlyRegistrationsBars.map((point) => point.label),
      geometry: buildSparkline(values),
    };
  }, [telegramHourlyRegistrationsBars]);

  const dinnerCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === "") {
      return dinners;
    }
    return dinners.filter((item) => {
      const haystack = `${item.id} ${item.description} ${item.location}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [dinners, searchQuery]);

  const dishCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === "") {
      return dishes;
    }
    return dishes.filter((item) => {
      const haystack = `${item.id} ${item.dishType} ${item.nameEng} ${item.nameRus} ${item.nameArm}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [dishes, searchQuery]);

  const currentUsers = usersSource === "landing" ? landingUsers : telegramUsers;
  const currentBookingCount = bookingsSource === "landing" ? landingUsers.length : telegramApplications.length;
  const bookingStatusOptions =
    bookingsSource === "landing"
      ? [
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "completed", label: "Completed" },
        ]
      : [
          { value: "all", label: "All" },
          { value: "pending_application", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "waiting_payment", label: "Waiting payment" },
          { value: "paid", label: "Paid" },
          { value: "cancelled", label: "Cancelled" },
          { value: "rejected", label: "Rejected" },
          { value: "no_show", label: "No show" },
        ];
  const usersSummaryCards: MetricItem[] =
    usersSource === "landing"
      ? [
          { label: "Landing users total", value: `${landingUsersSummary.total}` },
          { label: "Completed", value: `${landingUsersSummary.completed}` },
          { label: "Open selections", value: `${landingUsersSummary.open}` },
        ]
      : [
          { label: "Telegram users total", value: `${telegramUsersSummary.total}` },
          { label: "Terms accepted", value: `${telegramUsersSummary.termsAccepted}` },
          { label: "Paying users", value: `${telegramUsersSummary.payingUsers}` },
          { label: "Blocked active", value: `${telegramUsersSummary.blockedActive}` },
        ];
  const userStatusOptions =
    usersSource === "landing"
      ? [
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "completed", label: "Completed" },
        ]
      : [
          { value: "all", label: "All" },
          { value: "paying", label: "Paying" },
          { value: "terms", label: "Terms accepted" },
          { value: "blocked", label: "Blocked" },
        ];

  const guestCrmRows = useMemo(() => {
    if (usersSource === "landing") {
      return landingUsers.map((item) => buildGuestCrmRowFromLandingUser(item));
    }
    return telegramUsers.map((item) => buildGuestCrmRowFromTelegramUser(item, guestTelegramApplications));
  }, [usersSource, landingUsers, telegramUsers, guestTelegramApplications]);

  const dinnersById = useMemo(() => new Map(dinners.map((item) => [item.id, item])), [dinners]);
  const bookingManageSections = useMemo(
    () => getTelegramBookingActionSections(telegramBookingActionOptions),
    []
  );
  const bookingManageDangerOptions = useMemo(
    () => getTelegramBookingDangerOptions(telegramBookingActionOptions),
    []
  );
  const bookingManageAuditLogs = useMemo(() => {
    if (!bookingManageTarget) {
      return [];
    }
    return auditLogs.filter((item) => {
      if (item.entityType !== "telegram_application") {
        return false;
      }
      const auditBookingCode = getAuditBookingCode(item);
      return (
        item.entityId === String(bookingManageTarget.packageInfoId) ||
        (auditBookingCode && auditBookingCode === (bookingManageTarget.publicCode || ""))
      );
    });
  }, [auditLogs, bookingManageTarget]);
  const bookingManageRequiresReason = useMemo(
    () => isRiskyTelegramOverride(bookingManageTarget?.status, bookingManageStatus),
    [bookingManageStatus, bookingManageTarget]
  );
  const query = searchQuery.trim().toLowerCase();
  const matches = (label: string) => (query === "" ? true : label.toLowerCase().includes(query));
  const filterItems = (items: MetricItem[]) => items.filter((item) => matches(item.label));

  useEffect(() => {
    if (!bookingManageTarget) {
      return;
    }

    bookingManagerLastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.setTimeout(() => {
      bookingManagerCloseRef.current?.focus();
    }, 0);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !applicationSaving[bookingManageTarget.packageInfoId]) {
        event.preventDefault();
        closeTelegramBookingManager();
        return;
      }

      if (event.key !== "Tab" || !bookingManagerRef.current) {
        return;
      }

      const focusable = bookingManagerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !bookingManagerRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !bookingManagerRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
      bookingManagerLastFocusRef.current?.focus();
    };
  }, [applicationSaving, bookingManageTarget]);

  const completionDonutStyle = {
    background: `conic-gradient(#d4af37 0 ${completionPercent}%, #1f7a5c ${completionPercent}% 100%)`,
  };

  const dinnerRegistrationsTotal = dinners.reduce((sum, item) => sum + item.alreadyRegistered, 0);
  const activeDinnersCount = dinners.filter((item) => !item.expired).length;
  const weekendSubmissions = (landing?.weekdaySubmissions ?? [])
    .filter((item) => item.label === "Sat" || item.label === "Sun")
    .reduce((sum, item) => sum + item.count, 0);
  const weekdaySubmissionsTotal = (landing?.weekdaySubmissions ?? []).reduce((sum, item) => sum + item.count, 0);
  const weekendShare = weekdaySubmissionsTotal > 0 ? (weekendSubmissions / weekdaySubmissionsTotal) * 100 : 0;
  const topRevenuePackage = packageRevenueRows[0]?.label ?? "—";
  const awaitingApprovalCount = telegramApplicationsSummary.pendingApplication;
  const awaitingPaymentCount = telegramApplicationsSummary.approved + telegramApplicationsSummary.waitingPayment;
  const paidGuestsCount = telegramStats?.usersWithPayments ?? telegramApplicationsSummary.paid;
  const upcomingDinnerCapacity = dinners
    .filter((item) => !item.expired)
    .reduce((sum, item) => sum + Math.max(item.places - item.alreadyRegistered, 0), 0);
  const attentionNeededCount =
    awaitingApprovalCount +
    awaitingPaymentCount +
    pendingSelections +
    telegramApplicationsSummary.rejected +
    telegramApplicationsSummary.cancelled +
    telegramApplicationsSummary.noShow +
    (telegramStats?.blockedActive ?? 0);
  const pageTitle = sectionLabels[activeSection];
  const pageSubtitle = sectionHints[activeSection];
  const lastUpdated = formatDateLabel(meta.generatedAt);

  const sectionMetrics: Record<AdminSection, MetricItem[]> = {
    overview: filterItems([
      { label: "Awaiting Approval", value: `${awaitingApprovalCount}`, description: "Telegram applications waiting for admin decision", trend: `${telegramApplicationsSummary.total} total telegram applications`, tone: awaitingApprovalCount > 0 ? "gold" : "emerald", icon: "01" },
      { label: "Awaiting Payment", value: `${awaitingPaymentCount}`, description: "Approved bookings still not fully settled", trend: `${telegramApplicationsSummary.waitingPayment} marked waiting payment`, tone: awaitingPaymentCount > 0 ? "gold" : "emerald", icon: "02" },
      { label: "Paid Guests", value: `${paidGuestsCount}`, description: "Guests or users with collected payment recorded", trend: `${telegramStats?.orders24h ?? 0} paid orders in 24h`, tone: "emerald", icon: "03" },
      { label: "Upcoming Dinner Capacity", value: `${upcomingDinnerCapacity}`, description: `${activeDinnersCount || landing?.activeDinners || 0} active dinners with seats remaining`, trend: `${dinnerRegistrationsTotal} booked seats synced`, tone: upcomingDinnerCapacity > 0 ? "default" : "danger", icon: "04" },
      { label: "Collected Revenue", value: formatCurrency(telegramStats?.revenueTotal ?? 0), description: "Revenue collected from Telegram bookings", trend: `${formatCurrency(telegramStats?.revenue24h ?? 0)} in last 24h`, tone: "gold", icon: "05" },
      { label: "Attention Needed", value: `${attentionNeededCount}`, description: "Queues, blocks, open landing work, or failed attendance states", trend: `${pendingSelections} landing package selection still open`, tone: attentionNeededCount > 0 ? "danger" : "emerald", icon: "06" },
    ]),
    analytics: filterItems([
      { label: "Applications", value: formatCompactNumber(landing?.totalUsers ?? 0), description: `${landing?.recent24h ?? 0} new today`, trend: `${(landing?.conversionPercent ?? 0).toFixed(1)}% application -> package rate`, tone: "gold", icon: "L1" },
      { label: "Package Selected", value: `${landing?.completedSelections ?? 0}`, description: "Users finished package and dinner selection", trend: `${landing?.recentSelections24h ?? 0} in last 24h`, tone: "emerald", icon: "L2" },
      { label: "Pending package selection", value: `${landing?.pendingSelections ?? 0}`, description: "Still need a final package choice", trend: `${(landing?.selectionP50Hours ?? 0).toFixed(1)}h median close time`, tone: "gold", icon: "L3" },
      { label: "Demand vs capacity", value: `${landing?.selectedDinners ?? 0}`, description: "Distinct dinners currently chosen", trend: `${landing?.activeDinners ?? 0} active dinners`, tone: "default", icon: "L4" },
      { label: "Guest count summary", value: `${landing?.totalGuests ?? 0}`, description: `${(landing?.avgGuestsPerUser ?? 0).toFixed(2)} guests per application`, trend: `${weekendShare.toFixed(1)}% weekend share`, tone: "default", icon: "L5" },
      { label: "Potential revenue", value: formatCurrency(landing?.potentialRevenue ?? 0), description: "Projected from current package picks", trend: formatDateLabel(landing?.latestApplicationAt), tone: "gold", icon: "L6" },
    ]),
    telegram: filterItems([
      { label: "Active users", value: `${telegramActiveUsersCount}`, description: `${telegramStats?.totalUsers ?? 0} total bot users minus blocked`, trend: `${telegramStats?.blockedActive ?? 0} blocked right now`, tone: telegramActiveUsersCount > 0 ? "emerald" : "default", icon: "T1" },
      { label: "New users", value: `${telegramNewUsers24h}`, description: "New Telegram users in the most recent day bucket", trend: `${telegramNewUsers7d} in the last 7 days`, tone: "gold", icon: "T2" },
      { label: "Legal accepted", value: `${telegramLegalAccepted}`, description: "Users who accepted legal terms in the bot", trend: `${(telegramStats?.termsAcceptancePct ?? 0).toFixed(1)}% acceptance`, tone: "emerald", icon: "T3" },
      { label: "Applications started", value: `${telegramApplicationsStarted}`, description: "Users created in Telegram bot records", trend: "Proxy for people entering the bot funnel", tone: "default", icon: "T4" },
      { label: "Applications submitted", value: `${telegramApplicationsSubmitted}`, description: "Telegram application records submitted", trend: `${telegramFunnelConversion.toFixed(1)}% started -> submitted`, tone: "gold", icon: "T5" },
      { label: "Paid bookings", value: `${telegramPaidBookings}`, description: "Submitted bookings marked paid", trend: `${telegramPaidConversion.toFixed(1)}% submitted -> paid`, tone: "emerald", icon: "T6" },
      { label: "Referral activity", value: `${telegramReferralActivity}`, description: "Referral records linked to Telegram users", trend: `${(telegramStats?.referralCoveragePct ?? 0).toFixed(1)}% referral coverage`, tone: "default", icon: "T7" },
      { label: "Blocked users", value: `${telegramStats?.blockedActive ?? 0}`, description: "Users currently blocked or throttled", trend: `${(telegramStats?.blockedRatePct ?? 0).toFixed(1)}% block rate`, tone: (telegramStats?.blockedActive ?? 0) > 0 ? "danger" : "emerald", icon: "T8" },
    ]),
    revenue: filterItems([
      { label: "Revenue today", value: formatCurrency(telegramStats?.revenue24h ?? 0), description: `${telegramStats?.orders24h ?? 0} paid orders in 24h`, tone: "gold", icon: "R1" },
      { label: "Revenue 7 days", value: formatCurrency((telegramStats?.dailyOrders ?? []).slice(-7).reduce((sum, item) => sum + item.revenue, 0)), description: "Trailing 7-day paid revenue", tone: "emerald", icon: "R2" },
      { label: "Revenue 30 days", value: formatCurrency(telegramStats?.revenueTotal ?? 0), description: "All persisted paid revenue currently available", tone: "gold", icon: "R3" },
      { label: "Average ticket", value: formatCurrency(telegramStats?.avgOrderValue ?? 0), description: "Average paid order value", tone: "default", icon: "R4" },
      { label: "Revenue per seat", value: formatCurrency(dinnerRegistrationsTotal > 0 ? (telegramStats?.revenueTotal ?? 0) / dinnerRegistrationsTotal : 0), description: "Revenue divided by total booked seats", tone: "default", icon: "R5" },
      { label: "Top package revenue", value: topRevenuePackage, description: "Current best grossing package family", tone: "gold", icon: "R6" },
    ]),
    guests: filterItems(usersSummaryCards),
    bookings: filterItems([
      { label: "Applications total", value: `${telegramApplicationsSummary.total}`, description: "All telegram booking records", trend: `${telegramApplicationsSummary.pendingApplication} pending`, tone: "gold", icon: "B1" },
      { label: "Paid bookings", value: `${telegramApplicationsSummary.paid}`, description: "Confirmed paid reservations", trend: `${telegramApplicationsSummary.waitingPayment} waiting payment`, tone: "emerald", icon: "B2" },
      { label: "Approved", value: `${telegramApplicationsSummary.approved}`, description: "Accepted but not yet paid or completed", trend: `${telegramApplicationsSummary.rejected} rejected`, tone: "default", icon: "B3" },
      { label: "Cancelled / no-show", value: `${telegramApplicationsSummary.cancelled + telegramApplicationsSummary.noShow}`, description: "Operational churn and attendance loss", trend: `${telegramApplicationsSummary.noShow} no-show`, tone: "danger", icon: "B4" },
      { label: "VIP share", value: `${telegramApplications.filter((item) => item.packageCode === "vip").length}`, description: "Applications with VIP as top package", trend: `${telegramApplications.filter((item) => item.packageCode === "gold").length} Gold`, tone: "gold", icon: "B5" },
      { label: "Guest count", value: `${telegramApplications.reduce((sum, item) => sum + item.guestCount, 0)}`, description: "Combined guests across visible applications", trend: `${telegramApplications.filter((item) => item.referralUsedCode).length} referral-sourced`, tone: "default", icon: "B6" },
    ]),
    audit: filterItems([
      { label: "Audit entries", value: `${auditLogs.length}`, description: "Recent admin actions loaded into the panel", tone: "gold", icon: "A1" },
      { label: "Risky actions", value: `${auditLogs.filter((item) => item.actionType.includes("deleted") || item.actionType.includes("updated")).length}`, description: "Mutations needing review", tone: "danger", icon: "A2" },
      { label: "Latest activity", value: auditLogs[0] ? formatDateLabel(auditLogs[0].createdAt) : "—", description: "Most recent admin change timestamp", tone: "default", icon: "A3" },
      { label: "Operations feed", value: `${auditLogs.filter((item) => item.entityType === "telegram_application").length}`, description: "Booking-related admin events", tone: "emerald", icon: "A4" },
    ]),
    operations: filterItems([
      { label: "Maintenance mode", value: settings.runtime.maintenanceMode ? "Enabled" : "Disabled", description: "Blocks join and selection traffic", tone: settings.runtime.maintenanceMode ? "danger" : "emerald", icon: "O1" },
      { label: "Join applications", value: settings.runtime.allowJoinApplications ? "Enabled" : "Disabled", description: "Landing step one applications", tone: settings.runtime.allowJoinApplications ? "emerald" : "danger", icon: "O2" },
      { label: "Join selections", value: settings.runtime.allowJoinSelections ? "Enabled" : "Disabled", description: "Landing step two package selection", tone: settings.runtime.allowJoinSelections ? "emerald" : "danger", icon: "O3" },
      { label: "Auto-refresh", value: `${settings.runtime.panelAutoRefreshSeconds ?? 0}s`, description: `${settings.runtime.adminUsersPageSize ?? USERS_PAGE_SIZE} rows per admin page`, tone: "default", icon: "O4" },
    ]),
    dinners: filterItems([
      { label: "Upcoming dinners", value: `${activeDinnersCount}`, description: `${dinners.length} total dinners`, trend: `${dinnerRegistrationsTotal} seats booked`, tone: "gold", icon: "D1" },
      { label: "Completed bookings", value: `${dinnerRegistrationsTotal}`, description: "Registrations synced from sources", trend: settings.telegramDatabaseConfigured ? "Telegram DB connected" : "Telegram DB missing", tone: settings.telegramDatabaseConfigured ? "emerald" : "danger", icon: "D2" },
      { label: "Average fill", value: `${dinners.length > 0 ? Math.round((dinnerRegistrationsTotal / Math.max(dinners.reduce((sum, item) => sum + item.places, 0), 1)) * 100) : 0}%`, description: "Booked seats vs published capacity", trend: `${dinners.filter((item) => item.expired).length} expired`, tone: "default", icon: "D3" },
      { label: "VIP inventory", value: `${dinners.filter((item) => (item.vipPrice ?? 0) > 0).length}`, description: "Dinners offering VIP pricing", trend: `${dinners.filter((item) => (item.goldPrice ?? 0) > 0).length} with Gold`, tone: "gold", icon: "D4" },
    ]),
    menu: filterItems([
      { label: "Dish types", value: `${dishTypes.length}`, description: "Available menu categories", tone: "gold", icon: "M1" },
      { label: "Selected type", value: dishType || "—", description: "Current editing category", tone: "default", icon: "M2" },
      { label: "Dishes loaded", value: `${dishes.length}`, description: "Visible within current category", tone: "emerald", icon: "M3" },
      { label: "Telegram DB configured", value: settings.telegramDatabaseConfigured ? "Yes" : "No", description: "Required for menu operations", tone: settings.telegramDatabaseConfigured ? "emerald" : "danger", icon: "M4" },
    ]),
    settings: filterItems([
      { label: "Admin user", value: meta.username ?? "—", description: "Current authenticated session", tone: "gold", icon: "S1" },
      { label: "Frontend origin", value: settings.frontendOrigin || "—", description: "CORS allowlist target", tone: "default", icon: "S2" },
      { label: "Cookie secure", value: settings.adminCookieSecure ? "Enabled" : "Disabled", description: `${settings.adminTokenTTLMinutes ?? 0} min token TTL`, tone: settings.adminCookieSecure ? "emerald" : "danger", icon: "S3" },
      { label: "Maintenance mode", value: settings.runtime.maintenanceMode ? "Enabled" : "Disabled", description: "Blocks join and selection traffic", tone: settings.runtime.maintenanceMode ? "danger" : "emerald", icon: "S4" },
      { label: "Join applications", value: settings.runtime.allowJoinApplications ? "Enabled" : "Disabled", description: "Step one applications", tone: settings.runtime.allowJoinApplications ? "emerald" : "danger", icon: "S5" },
      { label: "Join selections", value: settings.runtime.allowJoinSelections ? "Enabled" : "Disabled", description: "Step two package selection", tone: settings.runtime.allowJoinSelections ? "emerald" : "danger", icon: "S6" },
      { label: "Panel auto-refresh", value: `${settings.runtime.panelAutoRefreshSeconds ?? 0}s`, description: `${settings.runtime.adminUsersPageSize ?? USERS_PAGE_SIZE} users per page`, tone: "default", icon: "S7" },
      { label: "Telegram DB configured", value: settings.telegramDatabaseConfigured ? "Configured" : "Missing", description: settings.listenAddr || "Backend listen address unavailable", tone: settings.telegramDatabaseConfigured ? "emerald" : "danger", icon: "S8" },
    ]),
  };

  const bookingManagerModal =
    bookingManageTarget && typeof document !== "undefined"
      ? createPortal(
          <div
            className="admin-modal-backdrop admin-modal-backdrop--booking"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeTelegramBookingManager();
              }
            }}
          >
            <article
              ref={bookingManagerRef}
              className="admin-modal admin-modal--booking"
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-manager-title"
              aria-describedby="booking-manager-subtitle"
              tabIndex={-1}
            >
              <header className="admin-modal__header admin-modal__header--booking">
                <button
                  ref={bookingManagerCloseRef}
                  className="admin-modal__close"
                  type="button"
                  onClick={() => closeTelegramBookingManager()}
                  disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                  aria-label="Close booking manager"
                >
                  x
                </button>
                <p className="admin-modal__eyebrow">Telegram Booking Manager</p>
                <h3 id="booking-manager-title">{bookingManageTarget.publicCode || `#${bookingManageTarget.packageInfoId}`}</h3>
                <p id="booking-manager-subtitle" className="admin-modal__text">
                  {[
                    [bookingManageTarget.name, bookingManageTarget.surname].filter(Boolean).join(" ").trim() || formatTelegramUsername(bookingManageTarget.username),
                    bookingManageTarget.dinnerTitle,
                  ].join(" · ")}
                </p>

                <div className="admin-booking-manager__summary">
                  {getTelegramStatusSummary(bookingManageStatus || bookingManageTarget.status).map((group) => (
                    <AdminBadge key={group.key} tone={group.tone}>
                      {group.shortLabel}: {group.value}
                    </AdminBadge>
                  ))}
                </div>
              </header>

              <div className="admin-modal__body admin-modal__body--booking">
                {bookingManageError ? <p className="admin-auth__error admin-booking-manager__error">{bookingManageError}</p> : null}
                <div className="admin-booking-manager__grid">
                  <section className="admin-booking-manager__card">
                    <h4>Status Controls</h4>
                    {bookingManageSections.map((section) => (
                      <div key={section.key} className="admin-booking-manager__section">
                        <span className="admin-booking-manager__section-title">{section.label}</span>
                        <div className="admin-booking-manager__options">
                          {section.options.map((option) => {
                            const tone = getBookingActionTone(option.value);
                            const isActive = option.value === bookingManageStatus;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={`admin-booking-manager__option admin-booking-manager__option--${tone} ${isActive ? "admin-booking-manager__option--active" : ""}`}
                                onClick={() => setBookingManageStatus(option.value as AdminTelegramApplication["status"])}
                                disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                              >
                                <span className="admin-booking-manager__option-icon" aria-hidden="true">
                                  {getApplicationStatusIcon(option.value)}
                                </span>
                                <span className="admin-booking-manager__option-text">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>Admin Note</h4>
                    <textarea
                      className="admin-booking-manager__textarea"
                      value={bookingManageNote}
                      onChange={(event) => setBookingManageNote(event.target.value)}
                      rows={5}
                      placeholder="Add internal note for this booking"
                      disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                    />
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>{bookingManageRequiresReason ? "Override Reason Required" : "Override Reason"}</h4>
                    <textarea
                      className="admin-booking-manager__textarea admin-booking-manager__textarea--reason"
                      value={bookingManageReason}
                      onChange={(event) => setBookingManageReason(event.target.value)}
                      rows={3}
                      placeholder={
                        bookingManageRequiresReason
                          ? "Explain why this risky override is needed"
                          : "Optional audit reason for this change"
                      }
                      disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                      aria-required={bookingManageRequiresReason}
                    />
                    <p className="admin-booking-manager__hint">
                      {bookingManageRequiresReason
                        ? "A non-empty reason is required for cancelled, rejected, and no-show overrides."
                        : "This reason will appear in the admin audit timeline."}
                    </p>
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>Booking Details</h4>
                    <p className="admin-booking-manager__copy">Dinner: {bookingManageTarget.dinnerTitle}</p>
                    <p className="admin-booking-manager__copy">Date: {formatDateLabel(bookingManageTarget.dinnerDate)}</p>
                    <p className="admin-booking-manager__copy">Package: {bookingManageTarget.packageLabel}</p>
                    <p className="admin-booking-manager__copy">Guests: {bookingManageTarget.guestCount}</p>
                    <p className="admin-booking-manager__copy">Price: {formatCurrency(bookingManageTarget.price)}</p>
                    <p className="admin-booking-manager__copy">Phone: {bookingManageTarget.phone || "—"}</p>
                    <p className="admin-booking-manager__copy">Telegram: {formatTelegramUsername(bookingManageTarget.username)}</p>
                    <p className="admin-booking-manager__copy">Referral: {bookingManageTarget.referralUsedCode || "None"}</p>
                    <p className="admin-booking-manager__copy">Legal: {bookingManageTarget.legalVersion || "—"}</p>
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>Audit History</h4>
                    <AuditTimelineList
                      logs={bookingManageAuditLogs}
                      compact
                      emptyTitle="No booking audit history yet"
                      emptyDescription="Status decisions and overrides for this booking will appear here."
                    />
                  </section>
                </div>

                <section className="admin-booking-manager__card admin-booking-manager__card--danger">
                  <h4>Dangerous Actions</h4>
                  <div className="admin-booking-manager__options">
                    {bookingManageDangerOptions.map((option) => {
                      const tone = getBookingActionTone(option.value);
                      const isActive = option.value === bookingManageStatus;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`admin-booking-manager__option admin-booking-manager__option--${tone} ${isActive ? "admin-booking-manager__option--active" : ""}`}
                          onClick={() => setBookingManageStatus(option.value as AdminTelegramApplication["status"])}
                          disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                        >
                          <span className="admin-booking-manager__option-icon" aria-hidden="true">
                            {getApplicationStatusIcon(option.value)}
                          </span>
                          <span className="admin-booking-manager__option-text">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="admin-modal__actions admin-modal__actions--booking">
                <button
                  className="admin-toolbar__btn"
                  type="button"
                  onClick={() => closeTelegramBookingManager()}
                  disabled={Boolean(applicationSaving[bookingManageTarget.packageInfoId])}
                >
                  Close
                </button>
                <button
                  className="admin-toolbar__btn"
                  type="button"
                  onClick={() => void handleSaveTelegramBookingManager()}
                  disabled={
                    Boolean(applicationSaving[bookingManageTarget.packageInfoId]) ||
                    !bookingManageStatus ||
                    (bookingManageRequiresReason && !bookingManageReason.trim())
                  }
                >
                  {applicationSaving[bookingManageTarget.packageInfoId] ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </article>
          </div>,
          document.body
        )
      : null;

  return (
    <section className="admin-panel admin-dashboard">
      <div className="admin-dashboard__layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar__brand">
            <span className="admin-sidebar__dot" />
            <div>
              <strong>Secret Dinner</strong>
              <span className="admin-sidebar__brand-sub">Private Dining OS</span>
            </div>
          </div>

          <nav className="admin-sidebar__nav" aria-label="Admin navigation">
            {(Object.keys(sectionLabels) as AdminSection[]).map((section) => (
              <button
                key={section}
                className={`admin-sidebar__item ${activeSection === section ? "admin-sidebar__item--active" : ""}`}
                type="button"
                onClick={() => setActiveSection(section)}
                title={sectionHints[section]}
              >
                <span className="admin-sidebar__item-label">{sectionLabels[section]}</span>
                <span className="admin-sidebar__item-hint">{sectionEyebrows[section]}</span>
              </button>
            ))}
          </nav>

          <div className="admin-sidebar__footer">
            <AdminBadge tone="gold">{meta.username || "admin"}</AdminBadge>
            <p className="admin-sidebar__footer-text">Last sync {lastUpdated}</p>
          </div>
          <AdminButton className="admin-sidebar__logout" variant="ghost" onClick={handleLogout} type="button">
            Logout
          </AdminButton>
        </aside>

        <div className="admin-main">
          <AdminPageHeader
            eyebrow={sectionEyebrows[activeSection]}
            title={pageTitle}
            subtitle={pageSubtitle}
            meta={
              <>
                <AdminBadge tone="default">{dashboardDate}</AdminBadge>
                <AdminBadge tone="gold">Updated {lastUpdated}</AdminBadge>
              </>
            }
            actions={
              <>
                <div className="admin-topbar__search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="text"
                    placeholder={`Search ${sectionLabels[activeSection]}`}
                    aria-label="Search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    title="Search inside currently opened section."
                  />
                </div>
              </>
            }
          />

          <div className="admin-toolbar">
            <AdminButton
              className="admin-toolbar__btn"
              variant="secondary"
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing || dinnersLoading || dishesLoading}
              title="Reload the currently active section data."
            >
              {refreshing || dinnersLoading || dishesLoading ? "Refreshing..." : "Refresh"}
            </AdminButton>
            <AdminButton
              className="admin-toolbar__btn"
              variant="primary"
              type="button"
              onClick={handleExport}
              disabled={!data}
              title="Download full current panel snapshot as JSON."
            >
              Export Snapshot
            </AdminButton>
            {activeSection === "settings" ? (
              <AdminButton
                className="admin-toolbar__btn"
                variant="secondary"
                type="button"
                onClick={handleCopyFrontendOrigin}
                disabled={!data}
                title="Copy currently configured CORS frontend origin."
              >
                Copy Frontend Origin
              </AdminButton>
            ) : null}
            {activeSection === "dinners" ? (
              <>
                <AdminButton className="admin-toolbar__btn" variant="primary" type="button" onClick={handleStartCreateDinner} title="Create a new dinner visible in both systems.">
                  New Dinner
                </AdminButton>
                <AdminButton className="admin-toolbar__btn" variant="secondary" type="button" onClick={handleSyncDinners} title="Recalculate dinner registration counts from source data.">
                  Sync Registrations
                </AdminButton>
              </>
            ) : null}
            <span className="admin-toolbar__meta">Generated: {lastUpdated}</span>
            {infoMessage ? <span className="admin-toolbar__meta admin-toolbar__meta--info">{infoMessage}</span> : null}
          </div>

          {loading ? <p className="admin-dashboard__state">Loading dashboard...</p> : null}
          {error ? <p className="admin-auth__error admin-dashboard__state">{error}</p> : null}

          {!loading && !error ? (
            <div className="admin-dashboard__content">
              <section className="admin-kpis admin-kpis--dynamic">
                {sectionMetrics[activeSection].map((item) => {
                  const hint = item.hint ?? metricHints[item.label];
                  return (
                    <AdminKpiCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      description={item.description}
                      trend={item.trend}
                      tone={item.tone}
                      icon={item.icon}
                      hint={hint}
                    />
                  );
                })}
              </section>

              {activeSection === "analytics" ? (
                <section className="admin-widgets">
                  <AdminChartCard className="admin-widget admin-widget--bars" title="Package Demand" subtitle="Current landing package split">
                    <div
                      className="admin-bars"
                      role="img"
                      aria-label="Landing package choices"
                      style={{ gridTemplateColumns: `repeat(${landingBars.length}, minmax(0, 1fr))` }}
                    >
                      {landingBars.map((item) => (
                        <div key={item.label} className="admin-bars__group">
                          <div className="admin-bars__pair">
                            <span
                              className="admin-bars__bar admin-bars__bar--sales"
                              style={{ height: `${item.height}%` }}
                              data-tooltip={`${item.label}: ${item.value} package selected`}
                              title={`${item.label}: ${item.value}`}
                              tabIndex={0}
                              aria-label={`${item.label}: ${item.value} package selected`}
                            />
                          </div>
                          <span className="admin-bars__month">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </AdminChartCard>

                  <AdminChartCard className="admin-widget admin-widget--status" title="Application -> Package Rate" subtitle="Package selected vs open applications">
                    {completionPercent >= 100 || totalUsers <= 2 ? (
                      <div className="admin-completion-card">
                        <div className="admin-completion-card__value">{completionPercent}%</div>
                        <p className="admin-completion-card__copy">Applications converted into completed package selections.</p>
                        <div className="admin-completion-card__meta">
                          <AdminBadge tone="emerald">{completedSelections} package selected</AdminBadge>
                          <AdminBadge tone="gold">{pendingSelections} pending</AdminBadge>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-donut" style={completionDonutStyle} aria-hidden="true">
                          <div className="admin-donut__inner">
                            <strong>{completionPercent}%</strong>
                            <span>Package Selected</span>
                          </div>
                        </div>
                        <ul className="admin-legend">
                          <li>
                            <span className="admin-legend__dot admin-legend__dot--sales" />Package Selected <b>{completedSelections}</b>
                          </li>
                          <li>
                            <span className="admin-legend__dot admin-legend__dot--product" />Pending <b>{pendingSelections}</b>
                          </li>
                        </ul>
                      </>
                    )}
                  </AdminChartCard>
                </section>
              ) : null}

              {activeSection === "analytics" ? (
                <section className="admin-analytics-grid">
                  <AdminChartCard className="admin-widget admin-widget--fit" title="Applications vs Package Selection" subtitle="Daily applications and completed package selections">
                    {landingDailyTrendBars.length === 0 ? (
                      <AdminEmptyState
                        compact
                        title="No application flow data yet"
                        description="Daily application and package selection trends will appear here once guests start moving through the landing funnel."
                      />
                    ) : (
                      <>
                        <div className="admin-widget__explain">
                          <p>Each day has two lollipops: gold for applications, emerald for completed package selections.</p>
                        </div>
                        <div
                          className="admin-lollipop-chart"
                          role="img"
                          aria-label="Landing applications and package selections lollipop chart"
                          style={{ gridTemplateColumns: `repeat(${landingDailyTrendBars.length}, minmax(0, 1fr))` }}
                        >
                          {landingDailyTrendBars.map((point) => (
                            <div key={`flow-${point.label}`} className="admin-lollipop-chart__col">
                              <div className="admin-lollipop-chart__track">
                                <span
                                  className="admin-lollipop admin-lollipop--gold admin-tooltip-target"
                                  style={{ height: `${point.primaryHeight}%` }}
                                  data-tooltip={`${point.label}: ${point.primary} applications`}
                                  tabIndex={0}
                                />
                                <span
                                  className="admin-lollipop admin-lollipop--emerald admin-tooltip-target"
                                  style={{ height: `${point.secondaryHeight}%` }}
                                  data-tooltip={`${point.label}: ${point.secondary} package selected`}
                                  tabIndex={0}
                                />
                              </div>
                              <span className="admin-lollipop-chart__label">{point.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="admin-speed-grid">
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Total landing applications submitted during this 14-day window." tabIndex={0}>
                            <span>Applications</span>
                            <strong>{landingFlowSummary.submissions}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Users who completed dinner/package selection during this 14-day window." tabIndex={0}>
                            <span>Package Selected</span>
                            <strong>{landingFlowSummary.selections}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Completed package selections divided by applications in this chart period." tabIndex={0}>
                            <span>Application to Package Rate</span>
                            <strong>{landingFlowSummary.conversion.toFixed(1)}%</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </AdminChartCard>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>24h Application Pulse</h2>
                      <span>Live landing activity</span>
                    </div>
                    {landingHourlyBars.length === 0 ? (
                      <p className="admin-dashboard__state">No hourly data yet.</p>
                    ) : (
                      <div className="admin-pulse-card">
                        <div className="admin-pulse-card__hero">
                          <div className="admin-pulse-card__status">
                            <span className="admin-pulse-card__eyebrow">Current status</span>
                            <div className="admin-pulse-card__status-row">
                              <AdminBadge tone={landingPulseSummary.status.tone}>{landingPulseSummary.status.label}</AdminBadge>
                              <span className="admin-pulse-card__status-copy">{landingPulseSummary.status.detail}</span>
                            </div>
                          </div>
                          <div className="admin-pulse-card__latest">
                            <span className="admin-pulse-card__eyebrow">Last application</span>
                            <strong>{formatDateLabel(landing?.latestApplicationAt)}</strong>
                          </div>
                        </div>

                        <div className="admin-pulse-strip" role="img" aria-label="Last 24 hours of application activity">
                          <div
                            className="admin-pulse-strip__bars"
                            style={{ gridTemplateColumns: `repeat(${landingHourlyBars.length}, minmax(0, 1fr))` }}
                          >
                            {landingHourlyBars.map((point, index) => (
                              <span
                                key={`pulse-bar-${point.label}-${index}`}
                                className={`admin-pulse-strip__bar admin-tooltip-target ${point.label === landingPeakHour.slice(0, 2) ? "admin-pulse-strip__bar--peak" : ""}`}
                                data-tooltip={`${point.label}:00 - ${point.value} applications`}
                                tabIndex={0}
                                style={{ height: `${Math.max(point.height, 10)}%` }}
                              />
                            ))}
                          </div>
                          <svg className="admin-pulse-strip__line" viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                            <path className="admin-wave-chart__area admin-wave-chart__area--emerald" d={landingHourlySparkline.geometry.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--emerald" d={landingHourlySparkline.geometry.linePath} />
                          </svg>
                        </div>

                        <div className="admin-pulse-strip__labels">
                          {landingHourlySparkline.labels.map((label, index) => (
                            <span
                              key={`hour-label-${label}-${index}`}
                              className="admin-pulse-strip__label admin-tooltip-target"
                              data-tooltip={`${label}:00 - ${landingHourlyBars[index]?.value ?? 0} applications`}
                              tabIndex={0}
                            >
                              {index % 3 === 0 ? label : "•"}
                            </span>
                          ))}
                        </div>

                        <div className="admin-pulse-card__stats">
                          <div className="admin-pulse-stat admin-tooltip-target" data-tooltip="All landing applications recorded across the last 24 hourly buckets." tabIndex={0}>
                            <span>Total in 24h</span>
                            <strong>{landingPulseSummary.total24h}</strong>
                          </div>
                          <div className="admin-pulse-stat admin-tooltip-target" data-tooltip="Hour with the highest application count in the latest 24-hour window." tabIndex={0}>
                            <span>Peak hour</span>
                            <strong>{landingPeakHour}</strong>
                          </div>
                          <div className="admin-pulse-stat admin-tooltip-target" data-tooltip="Average number of applications per hour across this 24-hour activity strip." tabIndex={0}>
                            <span>Avg/hour</span>
                            <strong>{landingPulseSummary.avgPerHour.toFixed(1)}</strong>
                          </div>
                          <div className="admin-pulse-stat admin-tooltip-target" data-tooltip="Most recent landing application timestamp currently available in the dashboard." tabIndex={0}>
                            <span>Last seen</span>
                            <strong>{formatDateLabel(landing?.latestApplicationAt)}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Top Landing Dinners</h2>
                      <span>Demand and capacity fill</span>
                    </div>
                    {(landing?.topDinners?.length ?? 0) === 0 ? (
                      <p className="admin-dashboard__state">No dinner registration data yet.</p>
                    ) : (
                      <AdminTable className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Dinner</th>
                              <th colSpan={3}>Capacity Snapshot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(landing?.topDinners ?? []).map((item) => (
                              <tr key={`landing-${item.dinnerId}`}>
                                <td>#{item.dinnerId}</td>
                                <td>
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.description}</div>
                                    {renderSourceBadge("landing")}
                                  </div>
                                </td>
                                <td colSpan={3}>
                                  <DinnerCapacityInline registered={item.registrations} places={item.capacity} compact />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AdminTable>
                    )}
                  </article>
                </section>
              ) : null}

              {activeSection === "telegram" ? (
                <>
                  <section className="admin-widgets">
                    <article className="admin-widget admin-widget--status">
                      <div className="admin-widget__header">
                        <h2>Bot Health</h2>
                        <span>Service state, legal, reachability, and blocks</span>
                      </div>
                      {!telegram?.enabled ? (
                        <p className="admin-dashboard__state">Set `TELEGRAM_DATABASE_URL` to enable Telegram bot metrics.</p>
                      ) : null}
                      {telegram?.enabled && !telegram.available ? (
                        <p className="admin-auth__error admin-dashboard__state">{telegram.error ?? "Telegram stats unavailable"}</p>
                      ) : null}
                      {telegram?.enabled && telegram.available ? (
                        <div className="admin-speed-grid">
                          <div className="admin-speed-pill">
                            <span>Connection</span>
                            <strong>{telegram.available ? "Connected" : "Unavailable"}</strong>
                          </div>
                          <div className="admin-speed-pill">
                            <span>Users With Phone</span>
                            <strong>{telegramStats?.usersWithPhone ?? 0}</strong>
                          </div>
                          <div className="admin-speed-pill">
                            <span>Legal Acceptance</span>
                            <strong>{(telegramStats?.termsAcceptancePct ?? 0).toFixed(1)}%</strong>
                          </div>
                          <div className="admin-speed-pill">
                            <span>Blocked Users</span>
                            <strong>{telegramStats?.blockedActive ?? 0}</strong>
                          </div>
                          <div className="admin-speed-pill">
                            <span>Referral Coverage</span>
                            <strong>{(telegramStats?.referralCoveragePct ?? 0).toFixed(1)}%</strong>
                          </div>
                          <div className="admin-speed-pill">
                            <span>Active Dinners</span>
                            <strong>{telegramStats?.activeDinners ?? 0}</strong>
                          </div>
                        </div>
                      ) : null}
                    </article>

                    <article className="admin-widget admin-widget--status">
                      <div className="admin-widget__header">
                        <h2>Bot Funnel</h2>
                        <span>Operational flow, not revenue</span>
                      </div>
                      <div className="admin-funnel">
                        <div className="admin-funnel__row">
                          <div className="admin-funnel__label">Applications Started</div>
                          <div className="admin-funnel__value">{telegramApplicationsStarted}</div>
                        </div>
                        <div className="admin-funnel__row">
                          <div className="admin-funnel__label">Applications Submitted</div>
                          <div className="admin-funnel__value">{telegramApplicationsSubmitted}</div>
                        </div>
                        <div className="admin-funnel__row">
                          <div className="admin-funnel__label">Paid Bookings</div>
                          <div className="admin-funnel__value">{telegramPaidBookings}</div>
                        </div>
                        <div className="admin-funnel__progress" aria-hidden="true">
                          <span
                            className="admin-funnel__progress-fill"
                            style={{ width: `${Math.max(0, Math.min(100, telegramFunnelConversion))}%` }}
                          />
                        </div>
                        <p className="admin-funnel__hint">
                          Started {"->"} Submitted: {telegramFunnelConversion.toFixed(1)}% · Submitted {"->"} Paid: {telegramPaidConversion.toFixed(1)}%
                        </p>
                      </div>
                    </article>
                  </section>

                  <section className="admin-analytics-grid">
                    <article className="admin-widget admin-widget--fit">
                      <div className="admin-widget__header">
                        <h2>New Telegram Users</h2>
                        <span>Acquisition trend over the last 14 days</span>
                      </div>
                      {!telegram?.enabled ? (
                        <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                      ) : null}
                      {telegram?.enabled && telegram.available && telegramDailyUsersBars.length > 0 ? (
                        <>
                          <div className="admin-wave-chart admin-wave-chart--gold" role="img" aria-label="Telegram new users trend">
                            <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                              <path className="admin-wave-chart__area admin-wave-chart__area--emerald" d={telegramDailyUsersSparkline.geometry.areaPath} />
                              <path className="admin-wave-chart__line admin-wave-chart__line--emerald" d={telegramDailyUsersSparkline.geometry.linePath} />
                            </svg>
                          </div>
                          <div className="admin-wave-chart__labels">
                            {telegramDailyUsersSparkline.labels.map((label, index) => (
                              <span
                                key={`${label}-${index}`}
                                className="admin-wave-chart__label-chip admin-tooltip-target"
                                data-tooltip={`${label}: ${telegramDailyUsersBars[index]?.value ?? 0} new users`}
                                tabIndex={0}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </article>

                    <article className="admin-widget admin-widget--fit">
                      <div className="admin-widget__header">
                        <h2>Application Activity by Hour</h2>
                        <span>Recent Telegram registration momentum</span>
                      </div>
                      {!telegram?.enabled ? (
                        <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                      ) : null}
                      {telegram?.enabled && telegram.available && telegramHourlyRegistrationsBars.length > 0 ? (
                        <>
                          <div className="admin-wave-chart" role="img" aria-label="Telegram hourly application activity">
                            <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                              <path className="admin-wave-chart__area admin-wave-chart__area--gold" d={telegramHourlySparkline.geometry.areaPath} />
                              <path className="admin-wave-chart__line admin-wave-chart__line--gold" d={telegramHourlySparkline.geometry.linePath} />
                            </svg>
                          </div>
                          <div className="admin-wave-chart__labels">
                            {telegramHourlySparkline.labels.map((label, index) => (
                              <span
                                key={`${label}-${index}`}
                                className="admin-wave-chart__label-chip admin-tooltip-target"
                                data-tooltip={`${label}:00 application events ${telegramHourlyRegistrationsBars[index]?.value ?? 0}`}
                                tabIndex={0}
                              >
                                {index % 3 === 0 ? label : "•"}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </article>

                    <article className="admin-widget">
                      <div className="admin-widget__header">
                        <h2>Referral and Legal Snapshot</h2>
                        <span>User operations and trust signals</span>
                      </div>
                      <ul className="admin-metric-list">
                        <li>
                          Referral records
                          <b>{telegramReferralActivity}</b>
                        </li>
                        <li>
                          Legal accepted users
                          <b>{telegramLegalAccepted}</b>
                        </li>
                        <li>
                          Reachable users
                          <b>{telegramStats?.usersWithPhone ?? 0}</b>
                        </li>
                        <li>
                          Users with payments
                          <b>{telegramStats?.usersWithPayments ?? 0}</b>
                        </li>
                      </ul>
                    </article>
                  </section>

                  <section className="admin-widgets">
                    <article className="admin-widget admin-widget--full">
                      <div className="admin-widget__header">
                        <h2>Recent Bot Events</h2>
                        <span>Latest Telegram application activity and admin state changes</span>
                      </div>
                      <div className="admin-telegram-events">
                        <div className="admin-telegram-events__column">
                          <h3>Application Activity</h3>
                          {telegramRecentApplications.length === 0 ? (
                            <p className="admin-dashboard__state">No recent Telegram application events.</p>
                          ) : (
                            <div className="admin-telegram-events__list">
                              {telegramRecentApplications.map((item) => (
                                <article key={`event-${item.packageInfoId}`} className="admin-telegram-events__item">
                                  <div className="admin-telegram-events__head">
                                    <strong>{item.publicCode || `#${item.packageInfoId}`}</strong>
                                    <AdminBadge tone={getTelegramStatusSummary(item.status)[0]?.tone ?? "default"}>
                                      {formatApplicationStatus(item.status)}
                                    </AdminBadge>
                                  </div>
                                  <p>{[item.name, item.surname].filter(Boolean).join(" ").trim() || formatTelegramUsername(item.username)}</p>
                                  <p>{item.dinnerTitle}</p>
                                  <span>{formatDateLabel(item.updatedAt || item.createdAt)}</span>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="admin-telegram-events__column">
                          <h3>Recent Admin Actions</h3>
                          <AuditTimelineList
                            logs={auditLogs.filter((item) => item.entityType === "telegram_application").slice(0, 8)}
                            compact
                            emptyTitle="No recent Telegram admin actions"
                            emptyDescription="Booking overrides and status decisions will appear here."
                          />
                        </div>
                      </div>
                    </article>
                  </section>
                </>
              ) : null}

              {activeSection === "revenue" ? (
                <section className="admin-widgets">
                  <article className="admin-widget admin-widget--bars">
                    <div className="admin-widget__header">
                      <h2>Telegram Package Distribution</h2>
                      <span>From package_info</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Set `TELEGRAM_DATABASE_URL` to enable telegram metrics.</p>
                    ) : null}
                    {telegram?.enabled && !telegram.available ? (
                      <p className="admin-auth__error admin-dashboard__state">{telegram.error ?? "Telegram stats unavailable"}</p>
                    ) : null}
                    {telegram?.enabled && telegram.available ? (
                      <div
                        className="admin-bars"
                        role="img"
                        aria-label="Telegram package choices"
                        style={{ gridTemplateColumns: `repeat(${telegramBars.length}, minmax(0, 1fr))` }}
                      >
                        {telegramBars.map((item) => (
                          <div key={item.label} className="admin-bars__group">
                            <div className="admin-bars__pair">
                              <span
                                className="admin-bars__bar admin-bars__bar--views"
                                style={{ height: `${item.height}%` }}
                                data-tooltip={`${item.label}: ${item.value} orders`}
                                title={`${item.label}: ${item.value}`}
                                tabIndex={0}
                                aria-label={`${item.label}: ${item.value} orders`}
                              />
                            </div>
                            <span className="admin-bars__month">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>

                  <article className="admin-widget admin-widget--status">
                    <div className="admin-widget__header">
                      <h2>Telegram Service Health</h2>
                      <span>Status</span>
                    </div>
                    <ul className="admin-metric-list">
                      <li>
                        Connection status
                        <b>{!telegram?.enabled ? "Disabled" : telegram.available ? "Connected" : "Error"}</b>
                      </li>
                      <li>
                        Active dinners
                        <b>{telegramStats?.activeDinners ?? 0}</b>
                      </li>
                      <li>
                        Revenue total
                        <b>{(telegramStats?.revenueTotal ?? 0).toFixed(2)}</b>
                      </li>
                      <li>
                        Last dinner date
                        <b>{formatDateLabel(telegramStats?.lastDinnerDate)}</b>
                      </li>
                    </ul>
                  </article>
                </section>
              ) : null}

              {activeSection === "revenue" ? (
                <section className="admin-analytics-grid">
                  <article className="admin-widget admin-widget--fit">
                    <div className="admin-widget__header">
                      <h2>Telegram Orders and Revenue</h2>
                      <span>Daily trend (14d)</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Set `TELEGRAM_DATABASE_URL` to enable telegram metrics.</p>
                    ) : null}
                    {telegram?.enabled && !telegram.available ? (
                      <p className="admin-auth__error admin-dashboard__state">{telegram.error ?? "Telegram stats unavailable"}</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && telegramOrderRevenueBars.length > 0 ? (
                      <>
                        <div className="admin-chart-legend">
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--emerald" />Orders</span>
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--gold" />Revenue</span>
                        </div>
                        <div className="admin-wave-chart" role="img" aria-label="Telegram orders and revenue wave chart">
                          <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                            <path className="admin-wave-chart__area admin-wave-chart__area--emerald" d={telegramOrdersRevenueSparkline.orders.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--emerald" d={telegramOrdersRevenueSparkline.orders.linePath} />
                            <path className="admin-wave-chart__area admin-wave-chart__area--gold" d={telegramOrdersRevenueSparkline.revenue.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--gold" d={telegramOrdersRevenueSparkline.revenue.linePath} />
                          </svg>
                        </div>
                        <div className="admin-wave-chart__labels">
                          {telegramOrdersRevenueSparkline.labels.map((label, index) => (
                            <span
                              key={`${label}-${index}`}
                              className="admin-wave-chart__label-chip admin-tooltip-target"
                              data-tooltip={`${label}: ${telegramOrderRevenueBars[index]?.primary ?? 0} orders, ${(
                                telegramOrderRevenueBars[index]?.secondary ?? 0
                              ).toFixed(2)} revenue`}
                              tabIndex={0}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Telegram New Users</h2>
                      <span>Acquisition trend (14d)</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && telegramDailyUsersBars.length > 0 ? (
                      <>
                        <div className="admin-wave-chart admin-wave-chart--gold" role="img" aria-label="Telegram new users wave chart">
                          <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                            <path className="admin-wave-chart__area admin-wave-chart__area--emerald" d={telegramDailyUsersSparkline.geometry.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--emerald" d={telegramDailyUsersSparkline.geometry.linePath} />
                          </svg>
                        </div>
                        <div className="admin-wave-chart__labels">
                          {telegramDailyUsersSparkline.labels.map((label, index) => (
                            <span
                              key={`${label}-${index}`}
                              className="admin-wave-chart__label-chip admin-tooltip-target"
                              data-tooltip={`${label}: ${telegramDailyUsersBars[index]?.value ?? 0} new users`}
                              tabIndex={0}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Top Telegram Dinners</h2>
                      <span>Most booked events</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && (telegramStats?.topDinners?.length ?? 0) === 0 ? (
                      <p className="admin-dashboard__state">No dinner registration data yet.</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && (telegramStats?.topDinners?.length ?? 0) > 0 ? (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Dinner</th>
                              <th colSpan={3}>Capacity Snapshot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(telegramStats?.topDinners ?? []).map((item) => (
                              <tr key={`telegram-${item.dinnerId}`}>
                                <td>#{item.dinnerId}</td>
                                <td>
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.description}</div>
                                    {renderSourceBadge("telegram")}
                                  </div>
                                </td>
                                <td colSpan={3}>
                                  <DinnerCapacityInline registered={item.registrations} places={item.capacity} compact />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {activeSection === "overview" ? (
                <>
                  <section className="admin-widgets">
                    <article className="admin-widget admin-widget--status">
                      <div className="admin-widget__header">
                        <h2>Operational Queues</h2>
                        <span>What needs action now</span>
                      </div>
                      <ul className="admin-metric-list">
                        <li>
                          Awaiting approval
                          <b>{awaitingApprovalCount}</b>
                        </li>
                        <li>
                          Awaiting payment
                          <b>{awaitingPaymentCount}</b>
                        </li>
                        <li>
                          Open landing package selection
                          <b>{pendingSelections}</b>
                        </li>
                        <li>
                          Rejected / cancelled / no-show
                          <b>{telegramApplicationsSummary.rejected + telegramApplicationsSummary.cancelled + telegramApplicationsSummary.noShow}</b>
                        </li>
                      </ul>
                    </article>

                    <article className="admin-widget admin-widget--status">
                      <div className="admin-widget__header">
                        <h2>Collection Snapshot</h2>
                        <span>Money and guest readiness</span>
                      </div>
                      <ul className="admin-metric-list">
                        <li>
                          Collected revenue
                          <b>{formatCurrency(telegramStats?.revenueTotal ?? 0)}</b>
                        </li>
                        <li>
                          Revenue 24h
                          <b>{formatCurrency(telegramStats?.revenue24h ?? 0)}</b>
                        </li>
                        <li>
                          Paid guests
                          <b>{paidGuestsCount}</b>
                        </li>
                        <li>
                          Avg order value
                          <b>{formatCurrency(telegramStats?.avgOrderValue ?? 0)}</b>
                        </li>
                      </ul>
                    </article>
                  </section>

                  <section className="admin-analytics-grid">
                    <article className="admin-widget admin-widget--fit">
                      <div className="admin-widget__header">
                        <h2>Upcoming Dinner Capacity</h2>
                        <span>Seats remaining across active dinners</span>
                      </div>
                      {dinners.filter((item) => !item.expired).length === 0 ? (
                        <AdminEmptyState
                          compact
                          title="No active dinners loaded"
                          description="Upcoming dinner capacity will appear here once active dinners are available."
                        />
                      ) : (
                        <AdminTable className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Dinner</th>
                                <th>Date</th>
                                <th colSpan={3}>Capacity Snapshot</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dinners
                                .filter((item) => !item.expired)
                                .slice(0, 6)
                                .map((item) => {
                                  return (
                                    <tr key={`overview-dinner-${item.id}`}>
                                      <td>{item.description}</td>
                                      <td>{formatDateLabel(item.dinnerDate)}</td>
                                      <td colSpan={3}>
                                        <DinnerCapacityInline registered={item.alreadyRegistered} places={item.places} compact />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </AdminTable>
                      )}
                    </article>

                    <AdminAuditLogCard
                      title="Recent Admin Audit"
                      subtitle="Latest operational changes"
                      className="admin-widget admin-widget--fit"
                    >
                      <AuditTimelineList
                        logs={auditLogs.slice(0, 6)}
                        compact
                        emptyTitle="No recent admin actions"
                        emptyDescription="Overrides and operational changes will appear here once admins begin updating records."
                      />
                    </AdminAuditLogCard>
                  </section>
                </>
              ) : null}

              {activeSection === "analytics" ? (
                <section className="admin-insights-grid">
                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>Application to Package Rate Intelligence</h2>
                      <span>From first application to final dinner/package selection</span>
                    </div>
                    <div className="admin-funnel">
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Applications</div>
                        <div className="admin-funnel__value">{totalUsers}</div>
                      </div>
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Package Selected</div>
                        <div className="admin-funnel__value">{completedSelections}</div>
                      </div>
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Open package selection</div>
                        <div className="admin-funnel__value">{pendingSelections}</div>
                      </div>
                      <div className="admin-funnel__progress">
                        <span
                          className="admin-funnel__progress-fill"
                          style={{ width: `${completionPercent}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="admin-funnel__hint">Application to Package Rate: {completionPercent}%</p>
                    </div>
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Package Selection Speed</h2>
                      <span>How quickly users finish package selection</span>
                    </div>
                    <div className="admin-speed-grid">
                      <div className="admin-speed-pill admin-tooltip-target" data-tooltip={`Median completion time: ${(landing?.selectionP50Hours ?? 0).toFixed(1)} hours`} tabIndex={0}>
                        <span>P50</span>
                        <strong>{(landing?.selectionP50Hours ?? 0).toFixed(1)}h</strong>
                      </div>
                      <div className="admin-speed-pill admin-tooltip-target" data-tooltip={`90th percentile completion time: ${(landing?.selectionP90Hours ?? 0).toFixed(1)} hours`} tabIndex={0}>
                        <span>P90</span>
                        <strong>{(landing?.selectionP90Hours ?? 0).toFixed(1)}h</strong>
                      </div>
                      <div className="admin-speed-pill admin-tooltip-target" data-tooltip={`Average completion time: ${(landing?.avgSelectionHours ?? 0).toFixed(1)} hours`} tabIndex={0}>
                        <span>Average</span>
                        <strong>{(landing?.avgSelectionHours ?? 0).toFixed(1)}h</strong>
                      </div>
                    </div>
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Top Email Domains</h2>
                      <span>Audience profile from applications</span>
                    </div>
                    {(landing?.topEmailDomains?.length ?? 0) === 0 ? (
                      <p className="admin-dashboard__state">No domain data yet.</p>
                    ) : (
                      <ul className="admin-domain-list">
                        {(landing?.topEmailDomains ?? []).map((item) => (
                          <li key={item.label}>
                            <span>{item.label}</span>
                            <b>{item.count}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>Weekday Applications vs Package Selection</h2>
                      <span>Behavior by day of week</span>
                    </div>
                    {landingWeekdayFlowBars.length === 0 ? (
                      <p className="admin-dashboard__state">No weekday application flow data yet.</p>
                    ) : (
                      <>
                        <div className="admin-chart-legend">
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--gold" />Applications</span>
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--emerald" />Package Selected</span>
                        </div>
                        <div className="admin-wave-chart" role="img" aria-label="Weekday applications and package selection trend">
                          <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                            <path className="admin-wave-chart__area admin-wave-chart__area--gold" d={landingWeekdaySparkline.submissions.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--gold" d={landingWeekdaySparkline.submissions.linePath} />
                            <path className="admin-wave-chart__area admin-wave-chart__area--emerald" d={landingWeekdaySparkline.selections.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--emerald" d={landingWeekdaySparkline.selections.linePath} />
                          </svg>
                        </div>
                        <div className="admin-wave-chart__labels">
                          {landingWeekdaySparkline.labels.map((label, index) => (
                            <span
                              key={label}
                              className="admin-wave-chart__label-chip admin-tooltip-target"
                              data-tooltip={`${label}: ${landingWeekdayFlowBars[index]?.primary ?? 0} applications, ${landingWeekdayFlowBars[index]?.secondary ?? 0} package selected`}
                              tabIndex={0}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Guest Group Distribution</h2>
                      <span>Requested guests per application</span>
                    </div>
                    {landingGuestBars.length === 0 ? (
                      <p className="admin-dashboard__state">No guest distribution yet.</p>
                    ) : (
                      <ul className="admin-meter-list" role="img" aria-label="Guest distribution">
                        {landingGuestBars.map((point) => (
                          <li key={point.label}>
                            <div className="admin-meter-list__head">
                              <span>{point.label} guest{point.label === "1" ? "" : "s"}</span>
                              <b>{point.value}</b>
                            </div>
                            <div className="admin-meter-list__track">
                              <span
                                className="admin-meter-list__fill admin-tooltip-target"
                                style={{ width: `${point.height}%` }}
                                data-tooltip={`${point.label} guests: ${point.value} applications`}
                                tabIndex={0}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Package Selection Delay Buckets</h2>
                      <span>Time between application and package selection</span>
                    </div>
                    {landingLagBars.length === 0 ? (
                      <p className="admin-dashboard__state">No package selection delay data yet.</p>
                    ) : (
                      <ul className="admin-meter-list" role="img" aria-label="Package selection delay distribution">
                        {landingLagBars.map((point) => (
                          <li key={point.label}>
                            <div className="admin-meter-list__head">
                              <span>{point.label}</span>
                              <b>{point.value}</b>
                            </div>
                            <div className="admin-meter-list__track">
                              <span
                                className="admin-meter-list__fill admin-meter-list__fill--gold admin-tooltip-target"
                                style={{ width: `${point.height}%` }}
                                data-tooltip={`${point.label}: ${point.value} users`}
                                tabIndex={0}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>Telegram Revenue Mix and Capacity Risk</h2>
                      <span>Operational profitability + load balancing</span>
                    </div>
                    <div className="admin-widget__explain">
                      <p>
                        How to read: left side shows package revenue share from Telegram orders.
                        Right side shows dinner occupancy bands based on registrations divided by places.
                      </p>
                      <p>
                        Bands: Low {"<"}30%, Mid 30-70%, High 70-100%, Overbooked {">"}100%, Unknown means no valid capacity.
                      </p>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Set `TELEGRAM_DATABASE_URL` to enable telegram insights.</p>
                    ) : null}
                    {telegram?.enabled && !telegram.available ? (
                      <p className="admin-auth__error admin-dashboard__state">{telegram.error ?? "Telegram insights unavailable"}</p>
                    ) : null}
                    {telegram?.enabled && telegram.available ? (
                      <div className="admin-insights-split">
                        <div>
                          <p className="admin-split-title">Revenue by package</p>
                          {(packageRevenueRows.length === 0) ? (
                            <p className="admin-dashboard__state">No package revenue data yet.</p>
                          ) : (
                            <ul className="admin-ring-list">
                              {packageRevenueRows.map((item) => (
                                <li key={item.label}>
                                  <div
                                    className="admin-mini-ring admin-tooltip-target"
                                    style={{
                                      background: `conic-gradient(#d4af37 0 ${item.share.toFixed(1)}%, rgba(255,255,255,0.08) ${item.share.toFixed(1)}% 100%)`,
                                    }}
                                    data-tooltip={`${item.label}: ${item.value.toFixed(2)} revenue (${item.share.toFixed(1)}%)`}
                                    tabIndex={0}
                                  >
                                    <span>{item.share.toFixed(0)}%</span>
                                  </div>
                                  <div className="admin-ring-list__meta">
                                    <span>{item.label}</span>
                                    <b>{item.value.toFixed(2)}</b>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="admin-split-title">Dinner fill bands</p>
                          {(dinnerFillBandRows.length === 0) ? (
                            <p className="admin-dashboard__state">No fill-band data yet.</p>
                          ) : (
                            <ul className="admin-ring-list">
                              {dinnerFillBandRows.map((item) => (
                                <li key={item.label}>
                                  <div
                                    className="admin-mini-ring admin-mini-ring--emerald admin-tooltip-target"
                                    style={{
                                      background: `conic-gradient(#1f7a5c 0 ${item.share.toFixed(1)}%, rgba(255,255,255,0.08) ${item.share.toFixed(1)}% 100%)`,
                                    }}
                                    data-tooltip={`${item.label}: ${item.count} dinners (${item.share.toFixed(1)}%)`}
                                    tabIndex={0}
                                  >
                                    <span>{item.share.toFixed(0)}%</span>
                                  </div>
                                  <div className="admin-ring-list__meta">
                                    <span>{item.label}</span>
                                    <b>{item.count}</b>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Telegram Orders by Weekday</h2>
                      <span>Weekly demand rhythm</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && telegramWeekdayBars.length > 0 ? (
                      <div
                        className="admin-bars admin-bars--compact admin-bars--insight-columns"
                        role="img"
                        aria-label="Telegram weekday orders"
                        style={{ gridTemplateColumns: `repeat(${telegramWeekdayBars.length}, minmax(0, 1fr))` }}
                      >
                        {telegramWeekdayBars.map((point) => (
                          <div key={point.label} className="admin-bars__group">
                            <div className="admin-bars__pair">
                              <span
                                className="admin-bars__bar admin-bars__bar--views"
                                style={{ height: `${point.height}%` }}
                                data-tooltip={`${point.label} orders: ${point.value}`}
                                tabIndex={0}
                              />
                            </div>
                            <span className="admin-bars__month">{point.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Telegram Orders 24h Pulse</h2>
                      <span>Hourly registration momentum</span>
                    </div>
                    {!telegram?.enabled ? (
                      <p className="admin-dashboard__state">Telegram DB is disabled.</p>
                    ) : null}
                    {telegram?.enabled && telegram.available && telegramHourlyRegistrationsBars.length > 0 ? (
                      <>
                        <div className="admin-wave-chart admin-wave-chart--gold" role="img" aria-label="Telegram hourly orders trend">
                          <svg viewBox="0 0 560 180" preserveAspectRatio="none" aria-hidden="true">
                            <path className="admin-wave-chart__area admin-wave-chart__area--gold" d={telegramHourlySparkline.geometry.areaPath} />
                            <path className="admin-wave-chart__line admin-wave-chart__line--gold" d={telegramHourlySparkline.geometry.linePath} />
                          </svg>
                        </div>
                        <div className="admin-wave-chart__labels">
                          {telegramHourlySparkline.labels.map((label, index) => (
                            <span
                              key={`${label}-${index}`}
                              className="admin-wave-chart__label-chip admin-tooltip-target"
                              data-tooltip={`${label}:00 orders ${telegramHourlyRegistrationsBars[index]?.value ?? 0}`}
                              tabIndex={0}
                            >
                              {index % 3 === 0 ? label : "•"}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {activeSection === "guests" ? (
                <section className="admin-users-layout">
                  <article className="admin-widget admin-widget--fit">
                    <AdminFilterBar className="admin-users__controls">
                      <div className="admin-users__switch" role="tablist" aria-label="Users source">
                        <button
                          className={`admin-users__switch-btn admin-users__switch-btn--landing ${usersSource === "landing" ? "admin-users__switch-btn--active" : ""}`}
                          type="button"
                          onClick={() => {
                            setUsersSource("landing");
                            setUsersStatus("all");
                          }}
                        >
                          Landing Users
                        </button>
                        <button
                          className={`admin-users__switch-btn admin-users__switch-btn--telegram ${usersSource === "telegram" ? "admin-users__switch-btn--active" : ""}`}
                          type="button"
                          onClick={() => {
                            setUsersSource("telegram");
                            setUsersStatus("all");
                          }}
                        >
                          Telegram Users
                        </button>
                      </div>

                      <div className="admin-users__filter-group" role="group" aria-label="Users status filter">
                        <span className="admin-users__filter-group-label">Status</span>
                        <div className="admin-users__filter-buttons">
                          {userStatusOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`admin-users__filter-btn admin-users__filter-btn--${option.value} ${usersStatus === option.value ? "admin-users__filter-btn--active" : ""}`}
                              onClick={() => setUsersStatus(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </AdminFilterBar>
                    {usersError ? <p className="admin-auth__error">{usersError}</p> : null}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>{usersSource === "landing" ? "Landing Guest CRM" : "Telegram Guest CRM"}</h2>
                      <span>{guestCrmRows.length} guests loaded</span>
                    </div>

                    {usersLoading && currentUsers.length === 0 ? (
                      <p className="admin-dashboard__state">Loading guests...</p>
                    ) : null}

                    {!usersLoading && currentUsers.length === 0 ? (
                      <p className="admin-dashboard__state">No guests found for current filters.</p>
                    ) : null}

                    {usersSource === "landing" && guestCrmRows.length > 0 ? (
                      <div className="admin-landing-crm-list" role="list" aria-label="Landing guest CRM list">
                        {guestCrmRows.map((item) => {
                          const isExpanded = expandedGuestKey === item.key;
                          return (
                            <article
                              key={item.key}
                              className={isExpanded ? "admin-landing-crm-card admin-landing-crm-card--expanded" : "admin-landing-crm-card"}
                              role="listitem"
                            >
                              <div className="admin-landing-crm-card__summary">
                                <div className="admin-landing-crm-card__guest">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.name}</div>
                                  </div>
                                  <div className="admin-users__cell-sub">{item.phone}</div>
                                </div>

                                <div className="admin-landing-crm-card__meta">
                                  <div className="admin-landing-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Contact">Contact</span>
                                    <strong>{item.phone}</strong>
                                  </div>
                                  <div className="admin-landing-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Current Status">Current Status</span>
                                    <AdminBadge tone={item.statusLabel === "Completed" ? "emerald" : "gold"}>{item.statusLabel || "Open"}</AdminBadge>
                                  </div>
                                  <div className="admin-landing-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Payments">Payments</span>
                                    <AdminBadge>{item.paidStatusLabel || "Not tracked"}</AdminBadge>
                                  </div>
                                </div>

                                <div className="admin-landing-crm-card__activity">
                                  <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Last Activity">Last Activity</span>
                                  <strong>{formatDateLabel(item.lastActivityAt)}</strong>
                                  {item.createdAt ? <span className="admin-users__cell-sub">Created {formatDateLabel(item.createdAt)}</span> : null}
                                </div>

                                <div className="admin-landing-crm-card__action">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => setExpandedGuestKey((prev) => (prev === item.key ? null : item.key))}
                                    aria-expanded={isExpanded}
                                    aria-controls={`guest-crm-detail-${item.key}`}
                                  >
                                    {isExpanded ? "Close" : "View"}
                                  </button>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div className="admin-landing-crm-card__detail" id={`guest-crm-detail-${item.key}`}>
                                  <div className="admin-guest-crm__detail-grid">
                                    <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--guest">
                                      <h3>Guest details</h3>
                                      {item.detailTitle ? <p className="admin-guest-crm__detail-title">{item.detailTitle}</p> : null}
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--guest">
                                        {item.detailLines.map((line) => (
                                          <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                        ))}
                                      </div>
                                    </section>
                                    <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--timeline">
                                      <h3>Timeline</h3>
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                        {item.timelineLines.map((line) => (
                                          <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                        ))}
                                      </div>
                                    </section>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : null}

                    {usersSource === "telegram" && guestCrmRows.length > 0 ? (
                      <>
                      <AdminTable className="admin-table-wrap admin-guest-crm-table-shell">
                        <table className="admin-table admin-table--guest-crm">
                          <colgroup>
                            <col style={{ width: "220px" }} />
                            <col style={{ width: "156px" }} />
                            <col style={{ width: "164px" }} />
                            <col style={{ width: "118px" }} />
                            <col style={{ width: "88px" }} />
                            <col style={{ width: "116px" }} />
                            <col style={{ width: "132px" }} />
                            <col style={{ width: "104px" }} />
                            <col style={{ width: "82px" }} />
                            <col style={{ width: "188px" }} />
                            <col style={{ width: "148px" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="admin-guest-crm__col admin-guest-crm__col--guest admin-tooltip-target" data-tooltip="Guest">Guest</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--phone admin-tooltip-target" data-tooltip="Phone">Phone</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--username admin-tooltip-target" data-tooltip="Telegram Username">Telegram</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-guest-crm__col--applications admin-tooltip-target" data-tooltip="Applications">Applications</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-tooltip-target" data-tooltip="Paid Bookings">Paid</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-guest-crm__col--attendance admin-tooltip-target" data-tooltip="Attendance">Attendance</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--payments admin-tooltip-target" data-tooltip="Total Payments">Payments</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-guest-crm__col--referrals admin-tooltip-target" data-tooltip="Referrals">Referrals</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-tooltip-target" data-tooltip="Points">Points</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--activity admin-tooltip-target" data-tooltip="Last Activity">Last Activity</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--actions admin-tooltip-target" data-tooltip="View Timeline">Timeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestCrmRows.map((item) => {
                              const isExpanded = expandedGuestKey === item.key;
                              return (
                                <Fragment key={item.key}>
                              <tr className={isExpanded ? "admin-guest-crm__row admin-guest-crm__row--expanded" : "admin-guest-crm__row"}>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--guest" data-label="Guest">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.name}</div>
                                  </div>
                                  {item.statusLabel ? <div className="admin-users__cell-sub">{item.statusLabel}</div> : null}
                                </td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--phone" data-label="Phone">
                                  <div className="admin-users__cell-title">{item.phone}</div>
                                </td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--username" data-label="Telegram">
                                  <div className="admin-users__cell-title">{item.telegramUsername}</div>
                                </td>
                                <td className="admin-guest-crm__cell" data-label="Applications">{formatNullableCount(item.applicationsCount)}</td>
                                <td className="admin-guest-crm__cell" data-label="Paid">{formatNullableCount(item.paidBookingsCount)}</td>
                                <td className="admin-guest-crm__cell" data-label="Attendance">{formatNullableCount(item.attendanceCount)}</td>
                                <td className="admin-guest-crm__cell" data-label="Payments">
                                  {item.totalPayments === null ? "—" : formatCurrency(item.totalPayments)}
                                </td>
                                <td className="admin-guest-crm__cell" data-label="Referrals">{formatNullableCount(item.referralCount)}</td>
                                <td className="admin-guest-crm__cell" data-label="Points">{formatNullableCount(item.points)}</td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--activity" data-label="Last Activity">
                                  <div className="admin-users__cell-title">{formatDateLabel(item.lastActivityAt)}</div>
                                  {item.createdAt ? <div className="admin-users__cell-sub">Created {formatDateLabel(item.createdAt)}</div> : null}
                                </td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--actions" data-label="Timeline">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => setExpandedGuestKey((prev) => (prev === item.key ? null : item.key))}
                                    aria-expanded={isExpanded}
                                    aria-controls={`guest-crm-detail-${item.key}`}
                                  >
                                    {isExpanded ? "Hide timeline" : "View timeline"}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="admin-guest-crm__detail-row" id={`guest-crm-detail-${item.key}`}>
                                  <td colSpan={11} className="admin-guest-crm__detail-cell">
                                    <div className="admin-guest-crm__detail-grid">
                                      <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--guest">
                                        <h3>Guest details</h3>
                                        {item.detailTitle ? <p className="admin-guest-crm__detail-title">{item.detailTitle}</p> : null}
                                        <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--guest">
                                          {item.detailLines.map((line) => (
                                            <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                          ))}
                                        </div>
                                      </section>
                                      <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--timeline">
                                        <h3>Timeline</h3>
                                        <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                          {item.timelineLines.map((line) => (
                                            <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                          ))}
                                        </div>
                                      </section>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </AdminTable>
                      <div className="admin-guest-crm-card-list admin-guest-crm-card-list--telegram" role="list" aria-label="Telegram guest CRM list">
                        {guestCrmRows.map((item) => {
                          const isExpanded = expandedGuestKey === item.key;
                          return (
                            <article
                              key={`telegram-card-${item.key}`}
                              className={isExpanded ? "admin-guest-crm-card admin-guest-crm-card--expanded" : "admin-guest-crm-card"}
                              role="listitem"
                            >
                              <div className="admin-guest-crm-card__summary">
                                <div className="admin-guest-crm-card__guest">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.name}</div>
                                  </div>
                                  <div className="admin-users__cell-sub">{item.phone}</div>
                                  <div className="admin-users__cell-sub">{item.telegramUsername}</div>
                                </div>

                                <div className="admin-guest-crm-card__meta">
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Contact">Contact</span>
                                    <strong>{item.phone}</strong>
                                    <span>{item.telegramUsername}</span>
                                  </div>
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Current Status">Current Status</span>
                                    <AdminBadge tone={getTelegramStatusSummary(item.rawStatus)[0]?.tone ?? "default"}>
                                      {item.statusLabel || "No status"}
                                    </AdminBadge>
                                  </div>
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Payments">Payments</span>
                                    <strong>{item.totalPayments === null ? "—" : formatCurrency(item.totalPayments)}</strong>
                                    <span>{item.paidStatusLabel || "Unpaid"}</span>
                                  </div>
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Last Activity">Last Activity</span>
                                    <strong>{formatDateLabel(item.lastActivityAt)}</strong>
                                    {item.createdAt ? <span>Created {formatDateLabel(item.createdAt)}</span> : null}
                                  </div>
                                </div>

                                <div className="admin-landing-crm-card__action">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => setExpandedGuestKey((prev) => (prev === item.key ? null : item.key))}
                                    aria-expanded={isExpanded}
                                    aria-controls={`guest-crm-card-detail-${item.key}`}
                                  >
                                    {isExpanded ? "Hide timeline" : "View timeline"}
                                  </button>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div className="admin-landing-crm-card__detail" id={`guest-crm-card-detail-${item.key}`}>
                                  <div className="admin-guest-crm__detail-grid">
                                    <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--guest">
                                      <h3>Guest details</h3>
                                      {item.detailTitle ? <p className="admin-guest-crm__detail-title">{item.detailTitle}</p> : null}
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--guest">
                                        {item.detailLines.map((line) => (
                                          <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                        ))}
                                      </div>
                                    </section>
                                    <section className="admin-guest-crm__detail-card admin-guest-crm__detail-card--timeline">
                                      <h3>Timeline</h3>
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                        {item.timelineLines.map((line) => (
                                          <p key={line} className="admin-guest-crm__detail-copy">{line}</p>
                                        ))}
                                      </div>
                                    </section>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                      </>
                    ) : null}

                    <div className="admin-users__footer">
                      <button className="admin-toolbar__btn" type="button" onClick={handleLoadMoreUsers} disabled={!usersHasMore || usersLoading}>
                        {usersLoading ? "Loading..." : usersHasMore ? "Load more" : "No more users"}
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {activeSection === "bookings" ? (
                <section className="admin-users-layout">
                  <article className="admin-widget admin-widget--fit">
                    <AdminFilterBar className="admin-users__controls">
                      <div className="admin-users__switch" role="tablist" aria-label="Bookings source">
                        <button
                          className={`admin-users__switch-btn admin-users__switch-btn--telegram ${bookingsSource === "telegram" ? "admin-users__switch-btn--active" : ""}`}
                          type="button"
                          onClick={() => {
                            setBookingsSource("telegram");
                            setUsersStatus("all");
                          }}
                        >
                          Telegram Bookings
                        </button>
                        <button
                          className={`admin-users__switch-btn admin-users__switch-btn--landing ${bookingsSource === "landing" ? "admin-users__switch-btn--active" : ""}`}
                          type="button"
                          onClick={() => {
                            setBookingsSource("landing");
                            setUsersStatus("all");
                          }}
                        >
                          Landing Bookings
                        </button>
                      </div>

                      <div className="admin-users__filter-group" role="group" aria-label={`${bookingsSource === "landing" ? "Landing" : "Telegram"} booking status filter`}>
                        <span className="admin-users__filter-group-label">Booking status</span>
                        <div className="admin-users__filter-buttons">
                          {bookingStatusOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`admin-users__filter-btn admin-users__filter-btn--${option.value} ${usersStatus === option.value ? "admin-users__filter-btn--active" : ""}`}
                              onClick={() => setUsersStatus(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </AdminFilterBar>
                    {usersError ? <p className="admin-auth__error">{usersError}</p> : null}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>{bookingsSource === "landing" ? "Landing Applications & Bookings" : "Telegram Applications & Bookings"}</h2>
                      <span>{currentBookingCount} loaded</span>
                    </div>
                    {usersLoading && currentBookingCount === 0 ? <p className="admin-dashboard__state">Loading bookings...</p> : null}
                    {!usersLoading && currentBookingCount === 0 ? (
                      <AdminEmptyState
                        compact
                        title={`No ${bookingsSource === "landing" ? "landing" : "telegram"} applications for this filter`}
                        description={
                          bookingsSource === "landing"
                            ? "Landing applications and package selections will appear here with package picks and completion status."
                            : "Telegram booking records will appear here with real bot statuses, package selections, legal consent, points, and referral usage."
                        }
                      />
                    ) : null}
                    {bookingsSource === "telegram" && telegramApplications.length > 0 ? (
                      <div className="admin-telegram-booking-list" role="list" aria-label="Telegram bookings list">
                        {telegramApplications.map((item) => {
                          const statusSummary = getTelegramStatusSummary(item.status);
                          const dinnerCapacity = dinnersById.get(item.dinnerId);
                          const capacityDetail = getDinnerCapacityDetail(
                            dinnerCapacity?.alreadyRegistered,
                            dinnerCapacity?.places,
                            dinnerCapacity?.activeBookings
                          );
                          const guestName = [item.name, item.surname].filter(Boolean).join(" ").trim() || `@${item.username}`;
                          const isExpanded = expandedTelegramBookingId === item.packageInfoId;
                          const statusChipLabels = statusSummary.map((group) => ({
                            ...group,
                            text: formatTelegramStatusChipLabel(group),
                          }));
                          const mainStatus = statusChipLabels.find((group) => group.key === "payment" && group.value !== "Not Started")
                            ?? statusChipLabels.find((group) => group.key === "attendance" && group.value !== "Not Scheduled")
                            ?? statusChipLabels[0];
                          const contactSummary = item.phone || formatTelegramUsername(item.username);
                          const sourceSummary = item.referralUsedCode ? `Referral ${item.referralUsedCode}` : "Direct source";
                          return (
                            <article
                              key={item.packageInfoId}
                              className={`admin-telegram-booking-card ${isExpanded ? "admin-telegram-booking-card--expanded" : ""}`}
                              role="listitem"
                            >
                              <div className="admin-telegram-booking-card__line admin-telegram-booking-card__line--top">
                                <div className="admin-telegram-booking-card__identity">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{guestName}</div>
                                    {renderSourceBadge("telegram")}
                                  </div>
                                  <div className="admin-telegram-booking-card__header-meta">
                                    <span className="admin-telegram-booking-card__code">{item.publicCode || `#${item.packageInfoId}`}</span>
                                    <AdminBadge tone={mainStatus?.tone ?? "default"}>{mainStatus?.text ?? formatApplicationStatus(item.status)}</AdminBadge>
                                  </div>
                                </div>
                                <div className="admin-telegram-booking-card__header-action">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => openTelegramBookingManager(item)}
                                  >
                                    Manage
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle admin-guest-crm__toggle--ghost"
                                    onClick={() => toggleTelegramBookingExpanded(item.packageInfoId)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`telegram-booking-details-${item.packageInfoId}`}
                                  >
                                    {isExpanded ? "Hide details" : "Details"}
                                  </button>
                                  {applicationSaving[item.packageInfoId] ? <span className="admin-users__status-saving">Saving override...</span> : null}
                                </div>
                              </div>

                              <div className="admin-telegram-booking-card__line admin-telegram-booking-card__line--summary">
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Dinner</span>
                                  <strong>{[item.dinnerTitle, formatDateLabel(item.dinnerDate)].filter(Boolean).join(" · ")}</strong>
                                </div>
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Package</span>
                                  <strong>{item.packageLabel}</strong>
                                  <span>{`${item.guestCount} guests · ${formatCurrency(item.price)}`}</span>
                                </div>
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Guest contact</span>
                                  <strong>{contactSummary}</strong>
                                  <span>{sourceSummary}</span>
                                </div>
                              </div>

                              <div className="admin-telegram-booking-card__statuses" aria-label={`Booking status summary for ${item.publicCode || item.packageInfoId}`}>
                                {statusChipLabels.map((group) => (
                                  <AdminBadge key={group.key} tone={group.tone}>
                                    <span className="admin-telegram-bookings__summary-badge" title={`${group.fullLabel}: ${group.value}. ${group.description}`}>
                                      {group.text}
                                    </span>
                                  </AdminBadge>
                                ))}
                              </div>

                              <div
                                id={`telegram-booking-details-${item.packageInfoId}`}
                                className={`admin-telegram-booking-card__details ${isExpanded ? "admin-telegram-booking-card__details--open" : ""}`}
                              >
                                <div className="admin-telegram-booking-card__details-inner">
                                  <div className="admin-telegram-booking-card__body">
                                    <div className="admin-telegram-booking-card__block">
                                      <span className="admin-telegram-booking-card__label">Dinner details</span>
                                      <strong>{item.dinnerTitle}</strong>
                                      <span>{`${formatDateLabel(item.dinnerDate)} · Table ${formatTablePreference(item.tablePreference)}`}</span>
                                      <span>{dinnerCapacity?.location || "Location unavailable"}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block">
                                      <span className="admin-telegram-booking-card__label">Capacity</span>
                                      <strong>{capacityDetail.message}</strong>
                                      <span>{capacityDetail.available ? `Bookings: ${capacityDetail.activeBookings} · Guests: ${capacityDetail.occupiedGuests}` : "Bookings and guest counts unavailable"}</span>
                                      <span>{capacityDetail.supporting}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block admin-telegram-booking-card__block--note">
                                      <span className="admin-telegram-booking-card__label">Admin note</span>
                                      <strong>{item.adminNote ? "Saved note" : "No note yet"}</strong>
                                      <span>{item.adminNote || "No admin note saved for this booking."}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block admin-telegram-booking-card__block--meta">
                                      <span className="admin-telegram-booking-card__label">Additional metadata</span>
                                      <strong>{sourceSummary}</strong>
                                      <span>{`${formatTelegramUsername(item.username)} · ${item.phone || "No phone"}`}</span>
                                      <span>{`Legal ${item.legalVersion || "—"} · Points ${item.points} · Discount ${item.discount}%`}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}

                    {bookingsSource === "landing" && landingUsers.length > 0 ? (
                      <AdminTable className="admin-table-wrap">
                        <table className="admin-table admin-table--stack">
                          <thead>
                            <tr>
                              <th>Guest</th>
                              <th>Contact</th>
                              <th>Booking</th>
                              <th>Package</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {landingUsers.map((item) => (
                              <tr key={item.id}>
                                <td data-label="Guest">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.fullName}</div>
                                    {renderSourceBadge("landing")}
                                  </div>
                                  <div className="admin-users__cell-sub">ID: {item.id.slice(0, 8)}...</div>
                                  <div className="admin-users__cell-sub">{item.guestCount} guests</div>
                                </td>
                                <td data-label="Contact">
                                  <div className="admin-users__cell-title">{item.email}</div>
                                  <div className="admin-users__cell-sub">{item.phone}</div>
                                </td>
                                <td data-label="Booking">
                                  <div className="admin-users__cell-head">
                                    <div className="admin-users__cell-title">{item.dinnerTitle || "No dinner selected"}</div>
                                    {renderSourceBadge("landing")}
                                  </div>
                                  <div className="admin-users__cell-sub">Created {formatDateLabel(item.createdAt)}</div>
                                  {item.dinnerId ? (
                                    <DinnerCapacityInline
                                      registered={dinnersById.get(item.dinnerId)?.alreadyRegistered}
                                      places={dinnersById.get(item.dinnerId)?.places}
                                      compact
                                    />
                                  ) : null}
                                </td>
                                <td data-label="Package">
                                  {item.chosenPackage ? <AdminBadge tone={getPackageTone(item.chosenPackage)}>{item.chosenPackage}</AdminBadge> : <AdminBadge>Unselected</AdminBadge>}
                                  <div className="admin-users__cell-sub">{item.allergies || "No allergies noted"}</div>
                                </td>
                                <td data-label="Status">
                                  <AdminBadge tone={item.selectionStatus === "completed" ? "emerald" : "gold"}>
                                    {formatLandingSelectionStatus(item.selectionStatus)}
                                  </AdminBadge>
                                  <div className="admin-users__cell-sub">{item.hobbies || "No hobbies saved"}</div>
                                </td>
                                <td data-label="Actions">
                                  <BookingStatusDropdown
                                    value={item.selectionStatus}
                                    options={landingSelectionStatusOptions}
                                    disabled={Boolean(selectionStatusSaving[item.id])}
                                    busy={Boolean(selectionStatusSaving[item.id])}
                                    ariaLabel={`Update landing booking status for ${item.fullName}`}
                                    formatLabel={formatLandingSelectionStatus}
                                    getIcon={getLandingSelectionStatusIcon}
                                    onChange={(next) => void handleUpdateLandingUserStatus(item.id, next as AdminLandingUser["selectionStatus"])}
                                  />
                                  {selectionStatusSaving[item.id] ? <span className="admin-users__status-saving">Saving...</span> : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AdminTable>
                    ) : null}
                  </article>

                  <AdminAuditLogCard
                    title="Recent Admin Audit"
                    subtitle="Internal metadata, separate from bot flow"
                    className="admin-widget admin-widget--fit"
                  >
                    <AuditTimelineList
                      logs={auditLogs}
                      compact
                      emptyTitle="No recent admin audit entries"
                      emptyDescription="Manual overrides and operational changes will appear here once admins start updating synced records."
                    />
                  </AdminAuditLogCard>
                </section>
              ) : null}

              {activeSection === "menu" ? (
                <section className="admin-info-grid admin-info-grid--single">
                  <article className="admin-widget admin-widget--fit admin-info-card">
                    <div className="admin-widget__header">
                      <h2>Custom Menu Dishes</h2>
                      <span>Add dishes for Telegram custom menu</span>
                    </div>

                    {!data?.settings.telegramDatabaseConfigured ? (
                      <p className="admin-dashboard__state">Set `TELEGRAM_DATABASE_URL` in backend to manage dishes.</p>
                    ) : null}

                        {data?.settings.telegramDatabaseConfigured ? (
                      <>
                        <div className="admin-dinner-form">
                          <DishTypeSelect
                            value={dishType}
                            options={dishTypes}
                            placeholder={dishTypes.length === 0 ? "Loading dish types..." : "Choose dish type"}
                            disabled={dishTypes.length === 0}
                            onChange={(next) => {
                              setDishType(next);
                              setDishForm((prev) => ({ ...prev, dishType: next }));
                            }}
                          />
                        </div>

                        {dishesError ? <p className="admin-auth__error">{dishesError}</p> : null}

                        <div className="admin-table-wrap">
                          <table className="admin-table admin-table--stack">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>English</th>
                                <th>Russian</th>
                                <th>Armenian</th>
                                <th>Price (AMD)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dishesLoading ? (
                                <tr>
                                  <td colSpan={5}>Loading...</td>
                                </tr>
                              ) : null}
                              {!dishesLoading && dishCards.length === 0 ? (
                                <tr>
                                  <td colSpan={5}>No dishes found for this type.</td>
                                </tr>
                              ) : null}
                              {!dishesLoading
                                ? dishCards.map((item) => (
                                    <tr key={item.id}>
                                      <td data-label="ID">#{item.id}</td>
                                      <td data-label="English">{item.nameEng}</td>
                                      <td data-label="Russian">{item.nameRus}</td>
                                      <td data-label="Armenian">{item.nameArm}</td>
                                      <td data-label="Price">{item.price.toFixed(2)}</td>
                                    </tr>
                                  ))
                                : null}
                            </tbody>
                          </table>
                        </div>

                        <div className="admin-widget__header" style={{ marginTop: 18 }}>
                          <h2>Add new dish</h2>
                          <span>Visible in Telegram bot</span>
                        </div>
                        <div className="admin-dinner-form">
                          <DishTypeSelect
                            value={dishForm.dishType}
                            options={dishTypes}
                            placeholder="Dish type"
                            disabled={dishTypes.length === 0}
                            onChange={(next) => setDishForm((prev) => ({ ...prev, dishType: next }))}
                          />
                          <input
                            className="admin-dinner-input"
                            placeholder="Name (English)"
                            value={dishForm.nameEng}
                            onChange={(event) => setDishForm((prev) => ({ ...prev, nameEng: event.target.value }))}
                          />
                          <input
                            className="admin-dinner-input"
                            placeholder="Name (Russian)"
                            value={dishForm.nameRus}
                            onChange={(event) => setDishForm((prev) => ({ ...prev, nameRus: event.target.value }))}
                          />
                          <input
                            className="admin-dinner-input"
                            placeholder="Name (Armenian)"
                            value={dishForm.nameArm}
                            onChange={(event) => setDishForm((prev) => ({ ...prev, nameArm: event.target.value }))}
                          />
                          <input
                            className="admin-dinner-input"
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="Price (AMD)"
                            value={dishForm.price}
                            onChange={(event) => setDishForm((prev) => ({ ...prev, price: event.target.value }))}
                          />
                          <div className="admin-dinner-actions">
                            <button className="admin-toolbar__btn" type="button" onClick={handleCreateDish} disabled={dishSaving}>
                              {dishSaving ? "Saving..." : "Create dish"}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {activeSection === "dinners" ? (
                <section className="admin-info-grid admin-info-grid--single">
                  {dinnerFormOpen ? (
                    <article className="admin-widget admin-widget--fit admin-info-card">
                      <div className="admin-widget__header">
                        <h2>{dinnerForm.id ? `Edit Dinner #${dinnerForm.id}` : "Create Dinner"}</h2>
                        <span>Shared across Landing + Telegram</span>
                      </div>
                      <div className="admin-dinner-form">
                        <input
                          className="admin-dinner-input"
                          placeholder="Description"
                          value={dinnerForm.description}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, description: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          placeholder="Location"
                          value={dinnerForm.location}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, location: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="date"
                          value={dinnerForm.dinnerDate}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, dinnerDate: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={0}
                          placeholder="Places"
                          value={dinnerForm.places}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, places: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Silver price"
                          value={dinnerForm.silverPrice}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, silverPrice: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="Gold price"
                          value={dinnerForm.goldPrice}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, goldPrice: event.target.value }))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="VIP price"
                          value={dinnerForm.vipPrice}
                          onChange={(event) => setDinnerForm((prev) => ({ ...prev, vipPrice: event.target.value }))}
                        />
                        <label className="admin-dinner-checkbox">
                          <input
                            type="checkbox"
                            checked={dinnerForm.expired}
                            onChange={(event) => setDinnerForm((prev) => ({ ...prev, expired: event.target.checked }))}
                          />
                          Expired
                        </label>
                        {dinnerFormError ? <p className="admin-auth__error">{dinnerFormError}</p> : null}
                        <div className="admin-dinner-actions">
                          <button className="admin-toolbar__btn" type="button" onClick={() => setDinnerFormOpen(false)}>
                            Cancel
                          </button>
                          <button className="admin-toolbar__btn" type="button" onClick={handleSaveDinner} disabled={dinnerSaving}>
                            {dinnerSaving ? "Saving..." : dinnerForm.id ? "Update Dinner" : "Create Dinner"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ) : null}

                  <article className="admin-widget admin-widget--fit admin-info-card">
                    <div className="admin-widget__header">
                      <h2>Dinners List</h2>
                      <span>{dinners.length} total</span>
                    </div>
                    {dinnersLoading ? <p className="admin-dashboard__state">Loading dinners...</p> : null}
                    {dinnerFormError ? <p className="admin-auth__error">{dinnerFormError}</p> : null}
                    <div className="admin-dinner-list">
                      {dinnerCards.map((item) => (
                        <article key={item.id} className="admin-dinner-card">
                          <p className="admin-dinner-card__id">#{item.id}</p>
                          <h3 className="admin-dinner-card__title">{item.description}</h3>
                          <p className="admin-dinner-card__line">{item.location}</p>
                          <p className="admin-dinner-card__line">{formatDateLabel(item.dinnerDate)}</p>
                          <DinnerCapacityInline registered={item.alreadyRegistered} places={item.places} />
                          <p className="admin-dinner-card__line">
                            Prices: S {item.silverPrice ?? "—"} / G {item.goldPrice ?? "—"} / V {item.vipPrice ?? "—"}
                          </p>
                          <p className="admin-dinner-card__line">Status: {item.expired ? "Expired" : "Active"}</p>
                          <div className="admin-dinner-card__actions">
                            <button className="admin-toolbar__btn" type="button" onClick={() => handleStartEditDinner(item)}>
                              Edit
                            </button>
                            <button className="admin-toolbar__btn" type="button" onClick={() => handleDeleteDinner(item)}>
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                      {!dinnersLoading && dinnerCards.length === 0 ? <p className="admin-dashboard__state">No dinners found.</p> : null}
                    </div>
                  </article>
                </section>
              ) : null}

              {activeSection === "operations" || activeSection === "settings" ? (
                <section className="admin-info-grid">
                  <article className="admin-widget admin-info-card">
                    <div className="admin-widget__header">
                      <h2>{activeSection === "operations" ? "Operations Controls" : "Editable Runtime Controls"}</h2>
                      <span>{activeSection === "operations" ? "Revenue, capacity, and booking operations depend on these runtime switches." : "Apply instantly without restart"}</span>
                    </div>
                    {settingsForm ? (
                      <div className="admin-dinner-form">
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={5}
                          placeholder="Admin token TTL (minutes)"
                          value={settingsForm.adminTokenTTLMinutes}
                          onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, adminTokenTTLMinutes: event.target.value } : prev))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={1}
                          placeholder="Admin login limit per minute"
                          value={settingsForm.adminLoginPerMinute}
                          onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, adminLoginPerMinute: event.target.value } : prev))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={1}
                          placeholder="Join form limit per 20 min/IP"
                          value={settingsForm.joinFormPer20MinByIP}
                          onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, joinFormPer20MinByIP: event.target.value } : prev))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={1}
                          placeholder="Join selection limit per 20 min/IP"
                          value={settingsForm.joinSelectionPer20MinByIP}
                          onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, joinSelectionPer20MinByIP: event.target.value } : prev))}
                        />
                        <input
                          className="admin-dinner-input"
                          type="number"
                          min={500}
                          placeholder="Min join fill duration (ms)"
                          value={settingsForm.minJoinFormFillDurationMs}
                          onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, minJoinFormFillDurationMs: event.target.value } : prev))}
                        />

                        <label className="admin-dinner-checkbox">
                          <input
                            type="checkbox"
                            checked={settingsForm.maintenanceMode}
                            onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, maintenanceMode: event.target.checked } : prev))}
                          />
                          Maintenance mode
                        </label>
                        <label className="admin-dinner-checkbox">
                          <input
                            type="checkbox"
                            checked={settingsForm.allowJoinApplications}
                            onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, allowJoinApplications: event.target.checked } : prev))}
                          />
                          Allow join applications
                        </label>
                        <label className="admin-dinner-checkbox">
                          <input
                            type="checkbox"
                            checked={settingsForm.allowJoinSelections}
                            onChange={(event) => setSettingsForm((prev) => (prev ? { ...prev, allowJoinSelections: event.target.checked } : prev))}
                          />
                          Allow join selections
                        </label>

                        {settingsError ? <p className="admin-auth__error">{settingsError}</p> : null}
                        <div className="admin-dinner-actions">
                          <button className="admin-toolbar__btn" type="button" onClick={handleResetSettings} disabled={settingsSaving}>
                            Reset
                          </button>
                          <button className="admin-toolbar__btn" type="button" onClick={handleSaveSettings} disabled={settingsSaving}>
                            {settingsSaving ? "Saving..." : "Save Settings"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="admin-dashboard__state">Settings are loading...</p>
                    )}
                  </article>

                  <article className="admin-widget admin-info-card">
                    <div className="admin-widget__header">
                      <h2>{activeSection === "operations" ? "Operational Snapshot" : "Runtime Snapshot"}</h2>
                      <span>{activeSection === "operations" ? "Current environment and safety state" : "Current active values"}</span>
                    </div>
                    <ul className="admin-metric-list">
                      <li>
                        Cookie secure
                        <b>{settings.adminCookieSecure ? "Enabled" : "Disabled"}</b>
                      </li>
                      <li>
                        Token TTL
                        <b>{settings.adminTokenTTLMinutes} min</b>
                      </li>
                      <li>
                        Login limiter
                        <b>{settings.rateLimits.adminLoginPerMinute}/min</b>
                      </li>
                      <li>
                        Join form limiter
                        <b>{settings.rateLimits.joinFormPer20MinByIP}/20m</b>
                      </li>
                      <li>
                        Selection limiter
                        <b>{settings.rateLimits.joinSelectionPer20MinByIP}/20m</b>
                      </li>
                      <li>
                        Min fill duration
                        <b>{settings.runtime.minJoinFormFillDurationMs} ms</b>
                      </li>
                      <li>
                        Maintenance mode
                        <b>{settings.runtime.maintenanceMode ? "Enabled" : "Disabled"}</b>
                      </li>
                      <li>
                        Join applications
                        <b>{settings.runtime.allowJoinApplications ? "Enabled" : "Disabled"}</b>
                      </li>
                      <li>
                        Join selections
                        <b>{settings.runtime.allowJoinSelections ? "Enabled" : "Disabled"}</b>
                      </li>
                      <li>
                        Frontend origin
                        <b>{settings.frontendOrigin || "—"}</b>
                      </li>
                      <li>
                        Backend listen
                        <b>{settings.listenAddr || "—"}</b>
                      </li>
                      <li>
                        Telegram DB
                        <b>{settings.telegramDatabaseConfigured ? "Configured" : "Not configured"}</b>
                      </li>
                    </ul>
                  </article>
                </section>
              ) : null}

              {activeSection === "audit" ? (
                <section className="admin-info-grid admin-info-grid--single">
                  <AdminAuditLogCard
                    title="Audit Log"
                    subtitle="Every important admin action should be reviewable and attributable."
                    className="admin-widget admin-widget--fit"
                  >
                    <AuditTimelineList
                      logs={auditLogs}
                      emptyTitle="No audit activity yet"
                      emptyDescription="As admins update bookings, dinners, and runtime controls, the operational audit trail will appear here."
                    />
                  </AdminAuditLogCard>
                </section>
              ) : null}
            </div>
          ) : null}

          {dinnerDeleteTarget ? (
            <div
              className="admin-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm dinner deletion"
              onClick={(event) => {
                if (event.target === event.currentTarget && !dinnerDeleting) {
                  setDinnerDeleteTarget(null);
                }
              }}
            >
              <article className="admin-modal admin-modal--danger">
                <button
                  className="admin-modal__close"
                  type="button"
                  onClick={() => setDinnerDeleteTarget(null)}
                  disabled={dinnerDeleting}
                  aria-label="Close delete confirmation"
                >
                  x
                </button>
                <p className="admin-modal__eyebrow">Delete Dinner</p>
                <h3>Remove dinner #{dinnerDeleteTarget.id}?</h3>
                <p className="admin-modal__text">
                  This will permanently delete this dinner from both admin and shared selection flows.
                </p>
                <div className="admin-modal__detail">
                  <b>{dinnerDeleteTarget.description}</b>
                  <span>
                    {formatDateLabel(dinnerDeleteTarget.dinnerDate)} · {dinnerDeleteTarget.location}
                  </span>
                </div>
                <div className="admin-modal__actions">
                  <button
                    className="admin-toolbar__btn"
                    type="button"
                    onClick={() => setDinnerDeleteTarget(null)}
                    disabled={dinnerDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="admin-toolbar__btn admin-toolbar__btn--danger"
                    type="button"
                    onClick={confirmDeleteDinner}
                    disabled={dinnerDeleting}
                  >
                    {dinnerDeleting ? "Deleting..." : "Delete Dinner"}
                  </button>
                </div>
              </article>
            </div>
          ) : null}

        </div>
      </div>
      {bookingManagerModal}
    </section>
  );
}
