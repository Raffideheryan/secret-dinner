import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FormControl, MenuItem, Select, TextField } from "@mui/material";
import SeoHead from "../SEO/SeoHead";
import {
  adminLogout,
  createAdminDish,
  createAdminDinner,
  createEngagementCampaign,
  deleteAdminDish,
  deleteAdminDinner,
  cancelEngagementCampaign,
  getAdminDishesByType,
  getAdminDishTypes,
  getAdminAuditLogs,
  getEngagementCampaign,
  getEngagementCampaignLogs,
  getEngagementCampaignOptions,
  getEngagementCampaigns,
  getEngagementAnalytics,
  getEngagementUserEvents,
  getEngagementUserProfile,
  getEngagementUsers,
  addUserTag,
  removeUserTag,
  addUserNote,
  deleteUserNote,
  getSmartSegments,
  getAdminRecommendations,
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
  type EngagementAnalytics,
  type EngagementCampaignLog,
  type EngagementCampaignMessagePayload,
  type EngagementCampaignPayload,
  type EngagementCampaignRecord,
  type EngagementUserListItem,
  type EngagementUserProfile,
  type SmartSegmentResult,
  type AdminRecommendation,
  scheduleEngagementCampaign,
  testSendEngagementCampaign,
  updateAdminLandingUserStatus,
  updateAdminTelegramApplication,
  updateAdminDish,
  updateAdminSettings,
  updateAdminDinner,
  updateEngagementCampaign,
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

type AdminSection = "overview" | "guests" | "bookings" | "dinners" | "revenue" | "analytics" | "telegram" | "engagement" | "menu" | "operations" | "settings" | "audit";
type EngagementTab = "analytics" | "users" | "campaigns" | "segments" | "debug";
type EngagementProfileTab = "overview" | "journey" | "activity" | "referrals" | "revenue" | "notes" | "campaigns" | "events";
type EngagementUsersSource = "telegram" | "landing";
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
type AnalyticsTooltipState = {
  left: number;
  top: number;
  title: string;
  value: string;
};
type EngagementHeatmapCell = {
  key: string;
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  count: number;
  intensity: number;
};
type EngagementHeatmapWeek = {
  key: string;
  cells: EngagementHeatmapCell[];
};
type EngagementJourneyStageSummary = {
  key: string;
  label: string;
  completed: boolean;
  occurredAt?: string;
  delayLabel: string;
  detail: string;
  inferred?: boolean;
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
  noShowCount: number | null;
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
  snapshotLines: string[];
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

type EngagementFilterState = {
  startDate: string;
  endDate: string;
  source: "all" | "landing" | "telegram";
  dinnerId: string;
  package: string;
};
type CampaignStatusFilter = "all" | "draft" | "scheduled" | "sending" | "completed" | "cancelled";
type CampaignObjective = "awareness" | "engagement" | "conversion" | "retention";
type CampaignComposerTab = "content" | "audience" | "schedule" | "preview";
type CampaignComposerState = {
  id?: number;
  title: string;
  description: string;
  objective: CampaignObjective;
  status: "draft" | "scheduled";
  messageType: EngagementCampaignPayload["messageType"];
  audienceType: string;
  dinnerId: string;
  packageValue: string;
  selectedUsers: string;
  language: string;
  search: string;
  termsAccepted: "all" | "yes" | "no";
  includeBlocked: boolean;
  text: string;
  caption: string;
  parseMode: string;
  mediaKind: "url" | "file_id" | "data_url";
  mediaValue: string;
  mediaFileName: string;
  pollQuestion: string;
  pollOptions: string;
  allowsMultiple: boolean;
  isAnonymous: boolean;
  correctOptionIndex: string;
  pollExplanation: string;
  buttons: Array<{
    id: string;
    label: string;
    kind: "callback" | "link" | "cta";
    url: string;
    action: string;
    dinnerId: string;
  }>;
  scheduledFor: string;
  rateLimitPerMinute: string;
  maxRetries: string;
  confirmBulkSend: boolean;
};

const sectionLabels: Record<AdminSection, string> = {
  overview: "Overview",
  guests: "Guests",
  bookings: "Bookings",
  dinners: "Dinners",
  revenue: "Revenue",
  analytics: "Analytics",
  telegram: "Telegram",
  engagement: "Engagement",
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
  engagement: "Activity tracking foundation for lifecycle analytics, audience intelligence, and future campaign workflows.",
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
  engagement: "Lifecycle Intelligence",
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
const emptyCampaignComposerState: CampaignComposerState = {
  title: "",
  description: "",
  objective: "engagement",
  status: "draft",
  messageType: "text",
  audienceType: "all_users",
  dinnerId: "all",
  packageValue: "all",
  selectedUsers: "",
  language: "",
  search: "",
  termsAccepted: "all",
  includeBlocked: false,
  text: "",
  caption: "",
  parseMode: "HTML",
  mediaKind: "url",
  mediaValue: "",
  mediaFileName: "",
  pollQuestion: "",
  pollOptions: "Option 1\nOption 2",
  allowsMultiple: false,
  isAnonymous: false,
  correctOptionIndex: "",
  pollExplanation: "",
  buttons: [],
  scheduledFor: "",
  rateLimitPerMinute: "60",
  maxRetries: "3",
  confirmBulkSend: true,
};
const USERS_PAGE_SIZE = 30;
const auditEntityTypeOptions = [
  { value: "all", label: "All entities" },
  { value: "telegram_application", label: "Telegram bookings" },
  { value: "landing_user", label: "Landing guests" },
  { value: "dinner", label: "Dinners" },
  { value: "runtime_settings", label: "Settings" },
] as const;
const auditActionTypeOptions = [
  { value: "all", label: "All actions" },
  { value: "telegram_application_updated", label: "Booking updates" },
  { value: "landing_user_status_updated", label: "Landing status updates" },
  { value: "dinner_created", label: "Dinner created" },
  { value: "dinner_updated", label: "Dinner updated" },
  { value: "dinner_deleted", label: "Dinner deleted" },
  { value: "dinners_synced", label: "Dinners synced" },
  { value: "settings_updated", label: "Settings updated" },
] as const;
const auditReasonStateOptions = [
  { value: "all", label: "Any reason" },
  { value: "with_reason", label: "With reason" },
  { value: "without_reason", label: "No reason" },
] as const;
const engagementSourceOptions = [
  { value: "all", label: "Telegram + Landing" },
  { value: "telegram", label: "Telegram" },
  { value: "landing", label: "Landing" },
] as const;
const engagementUsersSourceOptions: Array<{ value: EngagementUsersSource; label: string }> = [
  { value: "telegram", label: "Telegram Users" },
  { value: "landing", label: "Landing Users" },
] as const;
const engagementTabOptions: Array<{ value: EngagementTab; label: string; description: string }> = [
  { value: "analytics", label: "Analytics", description: "Event model and measurement readiness" },
  { value: "users", label: "Users", description: "Identity stitching and session tracking" },
  { value: "campaigns", label: "Campaigns", description: "Future audience and activation workflows" },
  { value: "segments", label: "Segments & BI", description: "Smart audience segments and actionable recommendations" },
  { value: "debug", label: "Debug", description: "Analytics data quality report and widget-to-event mapping" },
] as const;
const engagementFieldSx = {
  minWidth: 170,
  "& .MuiInputBase-root": {
    minHeight: 46,
    color: "#f5f1e8",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "14px",
  },
  "& .MuiInputLabel-root": {
    color: "#a6afa8",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(212, 175, 55, 0.24)",
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(212, 175, 55, 0.42)",
  },
  "& .MuiSvgIcon-root": {
    color: "#f5f1e8",
  },
  "& .MuiSelect-select": {
    whiteSpace: "nowrap",
  },
};

function formatDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDefaultEngagementFilters(): EngagementFilterState {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 29);
  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate),
    source: "all",
    dinnerId: "all",
    package: "all",
  };
}

function parseDateInputValue(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getPreviousEngagementRange(startDateValue: string, endDateValue: string) {
  const currentStart = parseDateInputValue(startDateValue);
  const currentEnd = parseDateInputValue(endDateValue);
  const inclusiveDays = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1);
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (inclusiveDays - 1));
  return {
    startDate: formatDateInputValue(previousStart),
    endDate: formatDateInputValue(previousEnd),
  };
}

function buildCampaignButtonState() {
  return {
    id: `btn_${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    kind: "callback" as const,
    url: "",
    action: "menu",
    dinnerId: "",
  };
}

function humanizeLabel(value: string): string {
  const normalized = value.trim().replace(/[_-]+/g, " ");
  if (!normalized) {
    return "—";
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCampaignResponseTone(correct: boolean, messageType: string): "default" | "gold" | "emerald" | "danger" {
  if (messageType === "quiz") {
    return correct ? "emerald" : "danger";
  }
  return "gold";
}

function getRecommendationTone(priority: string): "default" | "gold" | "emerald" | "danger" {
  switch (priority) {
    case "high":
      return "danger";
    case "medium":
      return "gold";
    default:
      return "default";
  }
}

function getSegmentCountTone(count: number): "default" | "gold" | "emerald" | "danger" {
  if (count >= 10) {
    return "danger";
  }
  if (count > 0) {
    return "gold";
  }
  return "default";
}

function buildCampaignPayload(form: CampaignComposerState): EngagementCampaignPayload {
  const message: EngagementCampaignMessagePayload = {
    parseMode: form.parseMode || "HTML",
  };

  if (form.text.trim()) {
    message.text = form.text.trim();
  }
  if (form.caption.trim()) {
    message.caption = form.caption.trim();
  }
  if (form.mediaValue.trim()) {
    message.media = {
      kind: form.mediaKind,
      value: form.mediaValue.trim(),
      fileName: form.mediaFileName.trim() || undefined,
    };
  }
  const buttons = form.buttons
    .map((item) => ({
      id: item.id,
      label: item.label.trim(),
      kind: item.kind,
      url: item.url.trim() || undefined,
      action: item.action.trim() || undefined,
      dinnerId: item.dinnerId && item.dinnerId !== "all" ? Number(item.dinnerId) : undefined,
    }))
    .filter((item) => item.label);
  if (buttons.length > 0) {
    message.buttons = buttons;
  }
  if (form.messageType === "rating") {
    message.poll = {
      question: form.pollQuestion.trim() || "How would you rate your experience?",
      options: [],
      allowsMultiple: false,
      isAnonymous: false,
    };
  } else if (form.messageType === "poll" || form.messageType === "quiz") {
    const options = form.pollOptions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    message.poll = {
      question: form.pollQuestion.trim(),
      options,
      allowsMultiple: form.allowsMultiple,
      isAnonymous: form.isAnonymous,
      correctOptionIndex: form.correctOptionIndex.trim() ? Number(form.correctOptionIndex) : undefined,
      explanation: form.pollExplanation.trim() || undefined,
    };
  }

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    messageType: form.messageType,
    audience: {
      audienceType: form.audienceType,
      dinnerIds: form.dinnerId !== "all" ? [Number(form.dinnerId)] : undefined,
      packages: form.packageValue !== "all" ? [form.packageValue] : undefined,
      selectedUsers: form.selectedUsers
        .split(/[\n,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      language: form.language.trim() || undefined,
      search: form.search.trim() || undefined,
      termsAccepted: form.termsAccepted === "all" ? undefined : form.termsAccepted === "yes",
      includeBlocked: form.includeBlocked,
    },
    message,
    scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
    rateLimitPerMinute: Number(form.rateLimitPerMinute) || 60,
    maxRetries: Number(form.maxRetries) || 3,
    confirmBulkSend: form.confirmBulkSend,
  };
}

function buildCampaignComposerStateFromRecord(record: EngagementCampaignRecord): CampaignComposerState {
  return {
    id: record.id,
    title: record.title,
    description: record.description || "",
    objective: "engagement",
    status: record.status === "scheduled" ? "scheduled" : "draft",
    messageType: record.messageType as CampaignComposerState["messageType"],
    audienceType: record.audience.audienceType || "all_users",
    dinnerId: record.audience.dinnerIds?.[0] != null ? String(record.audience.dinnerIds[0]) : "all",
    packageValue: record.audience.packages?.[0] ?? "all",
    selectedUsers: (record.audience.selectedUsers ?? []).join("\n"),
    language: record.audience.language ?? "",
    search: record.audience.search ?? "",
    termsAccepted: record.audience.termsAccepted == null ? "all" : record.audience.termsAccepted ? "yes" : "no",
    includeBlocked: Boolean(record.audience.includeBlocked),
    text: record.message.text ?? "",
    caption: record.message.caption ?? "",
    parseMode: record.message.parseMode ?? "HTML",
    mediaKind: (record.message.media?.kind as CampaignComposerState["mediaKind"]) ?? "url",
    mediaValue: record.message.media?.value ?? "",
    mediaFileName: record.message.media?.fileName ?? "",
    pollQuestion: record.message.poll?.question ?? "",
    pollOptions: record.message.poll?.options?.join("\n") ?? "Option 1\nOption 2",
    allowsMultiple: Boolean(record.message.poll?.allowsMultiple),
    isAnonymous: record.message.poll?.isAnonymous ?? false,
    correctOptionIndex: record.message.poll?.correctOptionIndex != null ? String(record.message.poll.correctOptionIndex) : "",
    pollExplanation: record.message.poll?.explanation ?? "",
    buttons: (record.message.buttons ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      kind: item.kind,
      url: item.url ?? "",
      action: item.action ?? "menu",
      dinnerId: item.dinnerId != null ? String(item.dinnerId) : "",
    })),
    scheduledFor: record.scheduledFor ? record.scheduledFor.slice(0, 16) : "",
    rateLimitPerMinute: String(record.rateLimitPerMinute || 60),
    maxRetries: String(record.maxRetries || 3),
    confirmBulkSend: true,
  };
}

function isAdminSection(value: string): value is AdminSection {
  return [
    "overview",
    "guests",
    "bookings",
    "dinners",
    "revenue",
    "analytics",
    "telegram",
    "engagement",
    "menu",
    "operations",
    "settings",
    "audit",
  ].includes(value);
}

function getSectionFromSearch(search: string): AdminSection {
  const value = new URLSearchParams(search).get("section")?.trim().toLowerCase() ?? "";
  return isAdminSection(value) ? value : "overview";
}

function normalizeEngagementUsersSource(value?: string | null): EngagementUsersSource {
  return (value ?? "").trim().toLowerCase() === "landing" ? "landing" : "telegram";
}

function getEngagementTabFromSearch(search: string): EngagementTab {
  const value = new URLSearchParams(search).get("engagementTab")?.trim().toLowerCase() ?? "";
  return (["analytics", "users", "campaigns", "segments", "debug"] as const).includes(value as EngagementTab)
    ? (value as EngagementTab)
    : "analytics";
}

function getEngagementProfileTabFromSearch(search: string): EngagementProfileTab {
  const value = new URLSearchParams(search).get("tab")?.trim().toLowerCase() ?? "";
  return ([
    "overview",
    "journey",
    "activity",
    "referrals",
    "revenue",
    "notes",
    "campaigns",
    "events",
  ] as const).includes(value as EngagementProfileTab)
    ? (value as EngagementProfileTab)
    : "overview";
}

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

const landingReviewStatusOptions: Array<{
  value: AdminLandingUser["adminStatus"];
  label: string;
}> = [
  { value: "new", label: "New" },
  { value: "review", label: "In review" },
  { value: "contacted", label: "Contacted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
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

const telegramBookingAllowedTransitions: Record<AdminTelegramApplication["status"], AdminTelegramApplication["status"][]> = {
  draft: ["draft", "pending_application", "cancelled"],
  pending_application: ["pending_application", "contacted", "approved", "rejected", "cancelled"],
  contacted: ["contacted", "approved", "rejected", "cancelled"],
  approved: ["approved", "waiting_payment", "cancelled"],
  waiting_payment: ["waiting_payment", "paid", "cancelled"],
  paid: ["paid", "no_show", "cancelled"],
  rejected: ["rejected"],
  cancelled: ["cancelled"],
  no_show: ["no_show"],
};

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

function parseDateValue(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnlyLabel(value?: string | null) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatAccountAgeLabel(value?: string | null) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "—";
  }
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) {
    return "Today";
  }
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"}`;
  }
  const diffYears = Math.floor(diffMonths / 12);
  const remMonths = diffMonths % 12;
  if (remMonths === 0) {
    return `${diffYears} year${diffYears === 1 ? "" : "s"}`;
  }
  return `${diffYears}y ${remMonths}m`;
}

function formatStageDelayLabel(previous?: string, current?: string) {
  const prevDate = parseDateValue(previous);
  const currentDate = parseDateValue(current);
  if (!prevDate || !currentDate) {
    return "Awaiting signal";
  }
  const diffMs = currentDate.getTime() - prevDate.getTime();
  if (diffMs <= 0) {
    return "Same step window";
  }
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes} min later`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} later`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} later`;
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

function getTelegramApplicationsSummaryKey(status: AdminTelegramApplication["status"]) {
  switch (status) {
    case "pending_application":
      return "pendingApplication";
    case "approved":
      return "approved";
    case "waiting_payment":
      return "waitingPayment";
    case "paid":
      return "paid";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "rejected";
    case "no_show":
      return "noShow";
    default:
      return null;
  }
}

function adjustTelegramApplicationsSummary(
  summary: AdminTelegramApplicationsSummary,
  previousStatus: AdminTelegramApplication["status"],
  nextStatus: AdminTelegramApplication["status"]
): AdminTelegramApplicationsSummary {
  if (previousStatus === nextStatus) {
    return summary;
  }

  const nextSummary = { ...summary };
  const previousKey = getTelegramApplicationsSummaryKey(previousStatus);
  const nextKey = getTelegramApplicationsSummaryKey(nextStatus);

  if (previousKey) {
    nextSummary[previousKey] = Math.max(0, nextSummary[previousKey] - 1);
  }
  if (nextKey) {
    nextSummary[nextKey] += 1;
  }

  return nextSummary;
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

function formatLandingAdminStatus(status?: string) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "new":
      return "New";
    case "review":
      return "In review";
    case "contacted":
      return "Contacted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status || "—";
  }
}

function getLandingAdminStatusSummary(status?: string): BookingStatusSummaryBadge {
  switch ((status ?? "").trim().toLowerCase()) {
    case "review":
      return {
        key: "application",
        shortLabel: "Review",
        fullLabel: "Review",
        value: "In review",
        tone: "gold",
        description: "Landing application is currently under review.",
      };
    case "contacted":
      return {
        key: "application",
        shortLabel: "Review",
        fullLabel: "Review",
        value: "Contacted",
        tone: "default",
        description: "Guest has been contacted by the team.",
      };
    case "approved":
      return {
        key: "application",
        shortLabel: "Review",
        fullLabel: "Review",
        value: "Approved",
        tone: "emerald",
        description: "Landing application has been approved.",
      };
    case "rejected":
      return {
        key: "application",
        shortLabel: "Review",
        fullLabel: "Review",
        value: "Rejected",
        tone: "danger",
        description: "Landing application has been rejected.",
      };
    case "new":
    default:
      return {
        key: "application",
        shortLabel: "Review",
        fullLabel: "Review",
        value: "New",
        tone: "default",
        description: "Landing application is newly created and not yet reviewed.",
      };
  }
}

function getLandingSelectionSummary(status?: string): BookingStatusSummaryBadge {
  switch ((status ?? "").trim().toLowerCase()) {
    case "completed":
      return {
        key: "payment",
        shortLabel: "Selection",
        fullLabel: "Selection",
        value: "Completed",
        tone: "emerald",
        description: "Dinner and package selection have been completed.",
      };
    case "open":
    default:
      return {
        key: "payment",
        shortLabel: "Selection",
        fullLabel: "Selection",
        value: "Open",
        tone: "gold",
        description: "Dinner or package selection is still open.",
      };
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
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Cancelled", tone: "danger", description: "Booking was cancelled." },
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
      // no_show is only reachable from paid (enforced by backend transition rules),
      // so Payment: Paid is always accurate here.
      return [
        { key: "application", shortLabel: "App", fullLabel: "Application", value: "Approved", tone: "emerald", description: "Application had been approved." },
        { key: "payment", shortLabel: "Pay", fullLabel: "Payment", value: "Paid", tone: "emerald", description: "Payment was confirmed before the event." },
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

function getAllowedTelegramBookingActions(
  currentStatus?: AdminTelegramApplication["status"]
): BookingActionOption[] {
  const normalizedStatus = (currentStatus || "pending_application") as AdminTelegramApplication["status"];
  const allowedStatuses = telegramBookingAllowedTransitions[normalizedStatus] ?? [normalizedStatus];
  const lookup = new Map(telegramBookingActionOptions.map((option) => [option.value, option]));
  return allowedStatuses
    .map((value) => lookup.get(value))
    .filter((option): option is BookingActionOption => Boolean(option));
}

function getTelegramBookingActionSections(
  options: BookingActionOption[],
  currentStatus?: AdminTelegramApplication["status"]
): BookingActionSection[] {
  const allowedOptions = getAllowedTelegramBookingActions(currentStatus);
  const allowedValues = new Set(allowedOptions.map((option) => option.value));
  const lookup = new Map(options.map((option) => [option.value, option]));
  const sections: BookingActionSection[] = [
    {
      key: "application",
      label: "Application",
      options: ["pending_application", "contacted", "approved", "rejected"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option))
        .filter((option) => allowedValues.has(option.value)),
    },
    {
      key: "payment",
      label: "Payment",
      options: ["waiting_payment", "paid", "cancelled"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option))
        .filter((option) => allowedValues.has(option.value)),
    },
    {
      key: "attendance",
      label: "Attendance",
      options: ["no_show"]
        .map((value) => lookup.get(value))
        .filter((option): option is BookingActionOption => Boolean(option))
        .filter((option) => allowedValues.has(option.value)),
    },
  ];
  return sections.filter((section) => section.options.length > 0);
}

function getTelegramBookingDangerOptions(options: BookingActionOption[], currentStatus?: AdminTelegramApplication["status"]) {
  const allowedValues = new Set(getAllowedTelegramBookingActions(currentStatus).map((option) => option.value));
  const dangerValues = new Set(["rejected", "cancelled", "no_show"]);
  return options.filter((option) => dangerValues.has(option.value) && allowedValues.has(option.value));
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

function formatEngagementUserStatus(source: EngagementUsersSource, status?: string) {
  if (source === "landing") {
    return formatLandingAdminStatus(status);
  }
  if ((status ?? "").trim().toLowerCase() === "blocked") {
    return "Blocked";
  }
  return formatApplicationStatus(status);
}

function getEngagementScoreTone(score: number): "default" | "gold" | "emerald" | "danger" {
  if (score >= 75) {
    return "emerald";
  }
  if (score >= 45) {
    return "gold";
  }
  if (score >= 20) {
    return "default";
  }
  return "danger";
}

function getEngagementHealthCardTone(score: number) {
  if (score >= 75) {
    return "positive";
  }
  if (score >= 45) {
    return "opportunity";
  }
  return "risk";
}

function getEngagementRevenueCardTone(profile: EngagementUserProfile) {
  if ((profile.revenue.totalPayments || 0) > 0 || profile.revenue.paidBookings > 0) {
    return "positive";
  }
  if (profile.overview.applications > 0 || profile.behavioral.applicationsSent > 0) {
    return "warning";
  }
  return "info";
}

function getEngagementAttendanceCardTone(profile: EngagementUserProfile) {
  if (profile.attendance.noShowCount > 0 && profile.attendance.attendanceCount === 0) {
    return "risk";
  }
  if (profile.attendance.attendanceCount > 0 && profile.attendance.noShowCount === 0) {
    return "positive";
  }
  if (profile.attendance.attendanceCount > 0 || profile.attendance.noShowCount > 0) {
    return "warning";
  }
  return "info";
}

function getEngagementReferralCardTone(profile: EngagementUserProfile) {
  if (profile.referral.referralSuccesses > 0 || profile.referral.invitedUsers > 0) {
    return "opportunity";
  }
  return "info";
}

function getEngagementJourneyCardTone(profile: EngagementUserProfile) {
  if (profile.attendance.attendanceCount > 0 || profile.revenue.paidBookings > 0) {
    return "positive";
  }
  if (["cancelled", "blocked", "rejected", "no_show"].includes((profile.overview.status || "").toLowerCase())) {
    return "risk";
  }
  if (profile.overview.applications > 0) {
    return "warning";
  }
  return "info";
}

function getEngagementCampaignCardTone(profile: EngagementUserProfile) {
  return profile.campaignResponses.length > 0 ? "special" : "info";
}

function getEngagementCardToneClass(tone: "positive" | "opportunity" | "warning" | "risk" | "info" | "special") {
  return `admin-engagement-card--${tone}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function buildEngagementScoreBreakdown(profile: EngagementUserProfile) {
  const totalPayments = profile.revenue.totalPayments || profile.overview.payments || 0;
  const attended = profile.attendance.attendanceCount || 0;
  const noShows = profile.attendance.noShowCount || 0;
  const attendanceBase = attended + noShows;
  const attendanceScore = attendanceBase > 0 ? clampPercent((attended / attendanceBase) * 100) : 0;
  const spendingScore = totalPayments > 0 ? clampPercent((totalPayments / 250000) * 100) : 0;
  const engagementScore = clampPercent(profile.overview.engagementScore);
  const loyaltyScore = clampPercent(profile.overview.loyaltyScore || profile.loyaltyScore);
  const referralScore = clampPercent(profile.overview.referralScore || profile.referralScore);
  const healthScore = clampPercent(profile.overview.healthScore);

  return {
    healthScore,
    items: [
      { key: "engagement", label: "Engagement", value: engagementScore, hint: "Based on meaningful actions and recency." },
      { key: "loyalty", label: "Loyalty", value: loyaltyScore, hint: "Reflects repeat bookings and ongoing relationship depth." },
      { key: "referral", label: "Referral", value: referralScore, hint: "How strongly this guest drives new guests." },
      { key: "attendance", label: "Attendance", value: attendanceScore, hint: "Attendance reliability versus no-shows." },
      { key: "spending", label: "Spending", value: spendingScore, hint: "Commercial value normalized from tracked revenue." },
    ],
  };
}

function buildEngagementHeatmap(timeline: EngagementUserProfile["timeline"], windowDays = 56) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (windowDays - 1));

  const counts = new Map<string, number>();
  timeline.forEach((item) => {
    const parsed = parseDateValue(item.occurredAt);
    if (!parsed) {
      return;
    }
    parsed.setHours(0, 0, 0, 0);
    if (parsed < start || parsed > end) {
      return;
    }
    const key = parsed.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxCount = Math.max(...Array.from(counts.values()), 1);
  const weeks: EngagementHeatmapWeek[] = [];

  for (let weekIndex = 0; weekIndex < Math.ceil(windowDays / 7); weekIndex += 1) {
    const cells: EngagementHeatmapCell[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const offset = weekIndex * 7 + dayIndex;
      const current = new Date(start);
      current.setDate(start.getDate() + offset);
      const key = current.toISOString().slice(0, 10);
      const count = counts.get(key) ?? 0;
      const intensity = count <= 0 ? 0 : Math.max(1, Math.ceil((count / maxCount) * 4));
      cells.push({
        key,
        dateKey: key,
        shortLabel: weekdayLabels[current.getDay()],
        fullLabel: `${formatDateOnlyLabel(current.toISOString())} · ${count} event${count === 1 ? "" : "s"}`,
        count,
        intensity,
      });
    }
    weeks.push({ key: `week-${weekIndex}`, cells });
  }

  return weeks;
}

function buildEngagementHourBars(timeline: EngagementUserProfile["timeline"]) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  timeline.forEach((item) => {
    const parsed = parseDateValue(item.occurredAt);
    if (!parsed) {
      return;
    }
    counts[parsed.getHours()].count += 1;
  });
  const activeHours = counts.filter((item) => item.count > 0);
  const max = Math.max(...counts.map((item) => item.count), 1);
  return {
    bestHour: activeHours.slice().sort((a, b) => b.count - a.count)[0] ?? null,
    bars: activeHours
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item) => ({
        key: `${item.hour}`,
        label: `${item.hour.toString().padStart(2, "0")}:00`,
        value: item.count,
        percent: clampPercent((item.count / max) * 100),
      })),
  };
}

function buildEngagementJourneyStages(profile: EngagementUserProfile): EngagementJourneyStageSummary[] {
  const attendanceCount = profile.attendance.attendanceCount || 0;
  const paidBookings = profile.overview.paidBookings || 0;
  const approved = profile.journey.some((item) => ["approved", "paid", "no_show", "completed"].includes((item.status || "").toLowerCase())) || (profile.overview.status || "").toLowerCase() === "approved";

  const stageSignals = [
    {
      key: "viewed_dinner",
      label: "Viewed Dinner",
      completed: profile.behavioral.dinnerViews > 0,
      occurredAt: profile.dinnerInterest.find((item) => item.lastViewAt)?.lastViewAt || profile.timeline.find((item) => /dinner|view/i.test(`${item.title} ${item.description}`))?.occurredAt,
      detail: profile.behavioral.dinnerViews > 0 ? `${profile.behavioral.dinnerViews} dinner view${profile.behavioral.dinnerViews === 1 ? "" : "s"} tracked` : "No dinner views tracked yet",
      inferred: false,
    },
    {
      key: "selected_package",
      label: "Selected Package",
      completed: profile.behavioral.packageSelections > 0,
      occurredAt: profile.timeline.find((item) => /package|selection|ticket buy/i.test(`${item.title} ${item.description}`))?.occurredAt,
      detail: profile.behavioral.packageSelections > 0 ? `${profile.behavioral.packageSelections} package selections captured` : "No package intent captured yet",
      inferred: false,
    },
    {
      key: "started_application",
      label: "Started Application",
      completed: profile.behavioral.applicationStarts > 0 || profile.behavioral.applicationsSent > 0,
      occurredAt: profile.timeline.find((item) => /start|apply|application/i.test(`${item.title} ${item.description}`))?.occurredAt,
      detail: profile.behavioral.applicationStarts > 0
        ? `${profile.behavioral.applicationStarts} application start${profile.behavioral.applicationStarts === 1 ? "" : "s"} tracked`
        : profile.behavioral.applicationsSent > 0
          ? "Inferred from submitted application activity"
          : "No application start tracked yet",
      inferred: profile.behavioral.applicationStarts <= 0 && profile.behavioral.applicationsSent > 0,
    },
    {
      key: "submitted_application",
      label: "Submitted Application",
      completed: profile.behavioral.applicationsSent > 0 || profile.overview.applications > 0,
      occurredAt: profile.journey[0]?.occurredAt || profile.timeline.find((item) => /submitted|application|booking/i.test(`${item.title} ${item.description}`))?.occurredAt,
      detail: `${profile.overview.applications} submitted application${profile.overview.applications === 1 ? "" : "s"}`,
      inferred: false,
    },
    {
      key: "approved",
      label: "Approved",
      completed: approved,
      occurredAt: profile.journey.find((item) => ["approved", "paid", "no_show", "completed"].includes((item.status || "").toLowerCase()))?.occurredAt,
      detail: approved ? "Application reached approved or later status" : "No approval recorded yet",
      inferred: false,
    },
    {
      key: "paid",
      label: "Paid",
      completed: paidBookings > 0 || (profile.revenue.totalPayments || 0) > 0,
      occurredAt: profile.journey.find((item) => ["paid", "no_show", "completed"].includes((item.status || "").toLowerCase()))?.occurredAt || profile.revenue.latestPaymentAt,
      detail: paidBookings > 0 ? `${paidBookings} paid booking${paidBookings === 1 ? "" : "s"}` : "No completed payment tracked yet",
      inferred: false,
    },
    {
      key: "attended",
      label: "Attended",
      completed: attendanceCount > 0,
      occurredAt: profile.attendance.lastAttendance,
      detail: attendanceCount > 0 ? `${attendanceCount} attended dinner${attendanceCount === 1 ? "" : "s"}` : "No attendance recorded yet",
      inferred: false,
    },
  ];

  return stageSignals.map((stage, index) => ({
    ...stage,
    delayLabel: index === 0 ? "Starting point" : formatStageDelayLabel(stageSignals[index - 1].occurredAt, stage.occurredAt),
  }));
}

function groupEngagementTimelineItems(timeline: EngagementUserProfile["timeline"]) {
  const grouped: Array<EngagementUserProfile["timeline"][number] & { itemCount: number }> = [];
  timeline.forEach((item) => {
    const parsed = parseDateValue(item.occurredAt);
    const minuteKey = parsed ? `${parsed.getUTCFullYear()}-${parsed.getUTCMonth()}-${parsed.getUTCDate()}-${parsed.getUTCHours()}-${parsed.getUTCMinutes()}` : item.occurredAt;
    const previous = grouped[grouped.length - 1];
    if (
      previous &&
      previous.title === item.title &&
      previous.description === item.description &&
      parseDateValue(previous.occurredAt) &&
      minuteKey === (() => {
        const previousDate = parseDateValue(previous.occurredAt);
        if (!previousDate) {
          return previous.occurredAt;
        }
        return `${previousDate.getUTCFullYear()}-${previousDate.getUTCMonth()}-${previousDate.getUTCDate()}-${previousDate.getUTCHours()}-${previousDate.getUTCMinutes()}`;
      })()
    ) {
      previous.itemCount += 1;
      return;
    }
    grouped.push({ ...item, itemCount: 1 });
  });
  return grouped;
}

function buildTimelineFrequency(
  timeline: EngagementUserProfile["timeline"],
  matcher: (item: EngagementUserProfile["timeline"][number]) => string | null,
  limit = 8
) {
  const counts = new Map<string, number>();
  timeline.forEach((item) => {
    const label = matcher(item);
    if (!label) {
      return;
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  const rows = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = Math.max(...rows.map((item) => item.value), 1);
  return rows.map((item) => ({
    ...item,
    percent: clampPercent((item.value / max) * 100),
  }));
}

function buildDailyActivityRows(timeline: EngagementUserProfile["timeline"], days = 14) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  timeline.forEach((item) => {
    const parsed = parseDateValue(item.occurredAt);
    if (!parsed) {
      return;
    }
    parsed.setHours(0, 0, 0, 0);
    const key = parsed.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const rows: Array<{ key: string; label: string; value: number; percent: number }> = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(end);
    current.setDate(end.getDate() - index);
    const key = current.toISOString().slice(0, 10);
    rows.push({
      key,
      label: formatDateOnlyLabel(key),
      value: counts.get(key) ?? 0,
      percent: 0,
    });
  }
  const max = Math.max(...rows.map((item) => item.value), 1);
  return rows.map((item) => ({
    ...item,
    percent: clampPercent((item.value / max) * 100),
  }));
}

function getBookingToneByStatus(status?: string): "default" | "gold" | "emerald" | "danger" {
  switch ((status ?? "").trim().toLowerCase()) {
    case "approved":
    case "paid":
    case "completed":
      return "emerald";
    case "waiting_payment":
    case "contacted":
    case "review":
      return "gold";
    case "rejected":
    case "cancelled":
    case "no_show":
    case "blocked":
      return "danger";
    default:
      return "default";
  }
}

function getTimelineToneBadge(tone?: string): "default" | "gold" | "emerald" | "danger" {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "gold":
      return "gold";
    case "emerald":
      return "emerald";
    case "danger":
      return "danger";
    default:
      return "default";
  }
}

function matchesLandingBookingFilter(item: AdminLandingUser, filter: string) {
  const normalized = filter.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return true;
  }
  if (normalized === "open" || normalized === "completed") {
    return (item.selectionStatus ?? "").trim().toLowerCase() === normalized;
  }
  return (item.adminStatus ?? "").trim().toLowerCase() === normalized;
}

function buildGuestCrmRowFromLandingUser(item: AdminLandingUser): GuestCrmRow {
  return {
    key: `landing-${item.id}`,
    name: item.fullName,
    phone: item.phone || "—",
    telegramUsername: "—",
    source: "landing",
    rawStatus: item.adminStatus,
    applicationsCount: null,
    paidBookingsCount: null,
    attendanceCount: null,
    noShowCount: null,
    totalPayments: null,
    referralCount: null,
    points: null,
    lastActivityAt: item.updatedAt || item.createdAt,
    createdAt: item.createdAt,
    statusLabel: formatLandingAdminStatus(item.adminStatus),
    packageLabel: item.chosenPackage || "Unselected",
    paidStatusLabel: "Not tracked",
    detailTitle: item.dinnerTitle || "No dinner selected",
    detailLines: [
      `Email: ${item.email || "—"}`,
      `Guests: ${item.guestCount}`,
      `Package: ${item.chosenPackage || "Unselected"}`,
      `Selection: ${formatLandingSelectionStatus(item.selectionStatus)}`,
      `Review: ${formatLandingAdminStatus(item.adminStatus)}`,
      `Hobbies: ${item.hobbies || "—"}`,
      `Allergies: ${item.allergies || "—"}`,
    ],
    snapshotLines: [
      `Created: ${formatDateLabel(item.createdAt)}`,
      `Last updated: ${formatDateLabel(item.updatedAt)}`,
      item.dinnerTitle ? `Dinner: ${item.dinnerTitle}` : "Dinner: not selected",
      item.chosenPackage ? `Package: ${item.chosenPackage}` : "Package: not selected",
      `Review: ${formatLandingAdminStatus(item.adminStatus)}`,
      `Selection: ${formatLandingSelectionStatus(item.selectionStatus)}`,
    ],
  };
}

function buildTelegramGuestLastActivity(user: AdminTelegramUser): string {
  const candidates = [user.lastRegisteredAt, user.updatedAt, user.createdAt].filter(Boolean) as string[];
  return candidates.reduce((best, ts) => {
    if (!best) return ts;
    return new Date(ts).getTime() > new Date(best).getTime() ? ts : best;
  }, "");
}

function buildGuestCrmRowFromTelegramUser(item: AdminTelegramUser): GuestCrmRow {
  const fullName = [item.name, item.surname].filter(Boolean).join(" ").trim() || formatTelegramUsername(item.username);
  const lastActivityAt = buildTelegramGuestLastActivity(item);
  const paidCount = item.paidBookingsCount ?? 0;

  return {
    key: `telegram-${item.id}`,
    name: fullName,
    phone: item.phone || "—",
    telegramUsername: formatTelegramUsername(item.username),
    source: "telegram",
    rawStatus: item.lastApplicationStatus,
    applicationsCount: item.ordersCount ?? 0,
    paidBookingsCount: paidCount,
    attendanceCount: item.attendanceCount ?? 0,
    noShowCount: item.noShowCount ?? 0,
    totalPayments: item.totalPayments ?? 0,
    referralCount: item.friendsInvited ?? 0,
    points: item.points ?? 0,
    lastActivityAt,
    createdAt: item.createdAt,
    statusLabel: formatApplicationStatus(item.lastApplicationStatus),
    packageLabel: item.lastApplicationStatus ? formatApplicationStatus(item.lastApplicationStatus) : "No status",
    paidStatusLabel: paidCount > 0 ? `${paidCount} paid` : "Unpaid",
    detailTitle: item.lastApplicationStatus ? `Last status: ${formatApplicationStatus(item.lastApplicationStatus)}` : "No recent status",
    detailLines: [
      `Phone: ${item.phone || "—"}`,
      `Telegram: ${formatTelegramUsername(item.username)}`,
      `Language: ${item.language || "—"}`,
      `Terms: ${item.termsAccepted ? "Accepted" : "Pending"}`,
      `Table preference: ${formatTablePreference(item.lastTablePreference)}`,
      `Referral code: ${item.referralCode || "—"}`,
      `Used referral: ${item.referralUsedCode || "—"}`,
      `Points: ${item.points ?? 0}`,
      `Referrals sent: ${item.friendsInvited ?? 0}`,
      `Discount: ${item.discount ?? 0}%`,
    ],
    snapshotLines: [
      `Created: ${formatDateLabel(item.createdAt)}`,
      `Last updated: ${formatDateLabel(item.updatedAt)}`,
      `Last registration: ${formatDateLabel(item.lastRegisteredAt)}`,
      item.acceptedAt ? `Terms accepted: ${formatDateLabel(item.acceptedAt)}` : "Terms: not yet accepted",
      `Applications: ${item.ordersCount ?? 0}`,
      `Paid bookings: ${paidCount}`,
      `No-shows: ${item.noShowCount ?? 0}`,
      `Attendance (bot): ${item.attendanceCount ?? 0}`,
      `Revenue: ${formatCurrency(item.totalPayments ?? 0)}`,
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
  if (entityType === "landing_user") {
    const normalized = status.trim().toLowerCase();
    if (normalized === "open" || normalized === "completed") {
      return formatLandingSelectionStatus(status);
    }
    return formatLandingAdminStatus(status);
  }
  return formatApplicationStatus(status);
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
  groupEvents = true,
  onOpenGroup,
}: {
  logs: AdminAuditLogEntry[];
  emptyTitle: string;
  emptyDescription: string;
  compact?: boolean;
  groupEvents?: boolean;
  onOpenGroup?: (event: AuditTimelineEvent, sourceLogs: AdminAuditLogEntry[]) => void;
}) {
  const events = groupEvents
    ? buildAuditTimelineEvents(logs)
    : logs.map((item) => {
        const change = getAuditStatusChange(item);
        const entityMeta = getAuditBookingCode(item) ? `Booking code ${getAuditBookingCode(item)}` : undefined;
        return {
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
        } satisfies AuditTimelineEvent;
      });

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
              {event.itemCount > 1 ? (
                <button
                  type="button"
                  className="admin-audit-timeline__group-btn"
                  onClick={() => onOpenGroup?.(event, logs)}
                  title="Open this grouped audit history"
                >
                  <AdminBadge tone="gold">Grouped {event.itemCount} edits</AdminBadge>
                </button>
              ) : null}
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

function formatChartNumber(value: number) {
  return value >= 1000 ? value.toLocaleString() : `${value}`;
}

function buildLineGeometry(values: number[], width: number, height: number, paddingX = 18, paddingY = 18) {
  if (values.length === 0) {
    return { points: [] as Array<{ x: number; y: number }>, linePath: "", areaPath: "", maxValue: 1 };
  }

  const innerWidth = Math.max(1, width - paddingX * 2);
  const innerHeight = Math.max(1, height - paddingY * 2);
  const maxValue = Math.max(1, ...values);
  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: paddingX + stepX * index,
    y: paddingY + innerHeight - (value / maxValue) * innerHeight,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const baselineY = paddingY + innerHeight;
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? paddingX} ${baselineY} L ${points[0]?.x ?? paddingX} ${baselineY} Z`;
  return { points, linePath, areaPath, maxValue };
}

function AnalyticsTooltip({
  left,
  top,
  title,
  value,
}: {
  left: number;
  top: number;
  title: string;
  value: string;
}) {
  return (
    <div className="admin-custom-chart__tooltip" style={{ left, top }}>
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

function getChartTooltipPosition(
  event: React.MouseEvent<Element>,
  container: HTMLElement | null,
  title: string,
  value: string
): AnalyticsTooltipState {
  if (!container) {
    return { left: 12, top: 12, title, value };
  }

  const rect = container.getBoundingClientRect();
  const tooltipWidth = Math.min(220, Math.max(140, rect.width * 0.42));
  const tooltipHeight = 64;
  const padding = 10;
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  let left = localX + 14;
  let top = localY - tooltipHeight - 10;

  if (left + tooltipWidth > rect.width - padding) {
    left = rect.width - tooltipWidth - padding;
  }
  if (left < padding) {
    left = padding;
  }
  if (top < padding) {
    top = Math.min(rect.height - tooltipHeight - padding, localY + 14);
  }
  if (top + tooltipHeight > rect.height - padding) {
    top = rect.height - tooltipHeight - padding;
  }

  return { left, top, title, value };
}

function CustomMiniSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const safeValues = values.length > 1 ? values : [0, ...values];
  const { linePath, areaPath } = buildLineGeometry(safeValues, 140, 44, 4, 6);
  return (
    <svg viewBox="0 0 140 44" className="admin-engagement-kpi__sparkline" aria-hidden="true" preserveAspectRatio="none">
      <path d={areaPath} fill={`${color}20`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CustomStackedSourceBar({
  items,
}: {
  items: Array<{ key: string; label: string; value: number; color: string }>;
}) {
  const [hover, setHover] = useState<AnalyticsTooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div ref={containerRef} className="admin-custom-chart admin-custom-chart--stacked">
      <div className="admin-custom-chart__stacked-bar">
        {items.map((item) => {
          const width = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <button
              key={item.key}
              type="button"
              className="admin-custom-chart__stacked-segment"
              style={{ width: `${Math.max(width, width > 0 ? 12 : 0)}%`, background: item.color }}
              onMouseMove={(event) =>
                setHover(getChartTooltipPosition(event, containerRef.current, item.label, `${formatChartNumber(item.value)} users`))
              }
              onMouseLeave={() => setHover(null)}
            >
              <span>{width >= 16 ? `${Math.round(width)}%` : ""}</span>
            </button>
          );
        })}
      </div>
      <div className="admin-custom-chart__legend admin-custom-chart__legend--inline">
        {items.map((item) => (
          <div key={item.key} className="admin-custom-chart__legend-item">
            <span className="admin-custom-chart__legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{formatChartNumber(item.value)}</strong>
          </div>
        ))}
      </div>
      {hover ? <AnalyticsTooltip left={hover.left} top={hover.top} title={hover.title} value={hover.value} /> : null}
    </div>
  );
}

function CustomGroupedHistogram({
  points,
  firstLabel,
  secondLabel,
  firstColor,
  secondColor,
}: {
  points: Array<{ key: string; label: string; firstValue: number; secondValue: number }>;
  firstLabel: string;
  secondLabel: string;
  firstColor: string;
  secondColor: string;
}) {
  const [hover, setHover] = useState<AnalyticsTooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const maxValue = Math.max(1, ...points.flatMap((item) => [item.firstValue, item.secondValue]));

  return (
    <div ref={containerRef} className="admin-custom-chart">
      <div className="admin-custom-chart__legend admin-custom-chart__legend--inline">
        <div className="admin-custom-chart__legend-item">
          <span className="admin-custom-chart__legend-dot" style={{ background: firstColor }} />
          <span>{firstLabel}</span>
        </div>
        <div className="admin-custom-chart__legend-item">
          <span className="admin-custom-chart__legend-dot" style={{ background: secondColor }} />
          <span>{secondLabel}</span>
        </div>
      </div>
      <div className="admin-custom-chart__histogram">
        {points.map((point) => (
          <div key={point.key} className="admin-custom-chart__histogram-col">
            <div className="admin-custom-chart__histogram-track">
              <button
                type="button"
                className="admin-custom-chart__histogram-bar admin-custom-chart__histogram-bar--secondary"
                style={{ height: `${(point.secondValue / maxValue) * 100}%`, background: secondColor }}
                onMouseMove={(event) =>
                  setHover(getChartTooltipPosition(event, containerRef.current, `${point.label} active users`, `${formatChartNumber(point.secondValue)} users`))
                }
                onMouseLeave={() => setHover(null)}
              />
              <button
                type="button"
                className="admin-custom-chart__histogram-bar admin-custom-chart__histogram-bar--primary"
                style={{ height: `${(point.firstValue / maxValue) * 100}%`, background: firstColor }}
                onMouseMove={(event) =>
                  setHover(getChartTooltipPosition(event, containerRef.current, `${point.label} events`, `${formatChartNumber(point.firstValue)} events`))
                }
                onMouseLeave={() => setHover(null)}
              />
            </div>
            <span className="admin-custom-chart__column-label" title={point.label}>{point.label}</span>
          </div>
        ))}
      </div>
      {hover ? <AnalyticsTooltip left={hover.left} top={hover.top} title={hover.title} value={hover.value} /> : null}
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: routeUserId = "" } = useParams<{ userId?: string }>();
  const isEngagementUserProfileRoute = location.pathname.startsWith("/users/");
  const routeProfileSource = normalizeEngagementUsersSource(new URLSearchParams(location.search).get("source"));
  const [data, setData] = useState<AdminPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>(() => (location.pathname.startsWith("/users/") ? "engagement" : getSectionFromSearch(location.search)));
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
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [dishDeleteTarget, setDishDeleteTarget] = useState<AdminDishItem | null>(null);
  const [dishDeleting, setDishDeleting] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [usersSource, setUsersSource] = useState<UsersSource>("landing");
  const [bookingsSource, setBookingsSource] = useState<BookingsSource>("telegram");
  const [engagementTab, setEngagementTab] = useState<EngagementTab>(() => getEngagementTabFromSearch(location.search));
  const [engagementProfileTab, setEngagementProfileTab] = useState<EngagementProfileTab>(() => getEngagementProfileTabFromSearch(location.search));
  const [engagementFilters, setEngagementFilters] = useState<EngagementFilterState>(() => buildDefaultEngagementFilters());
  const [engagementAnalytics, setEngagementAnalytics] = useState<EngagementAnalytics | null>(null);
  const [engagementPreviousAnalytics, setEngagementPreviousAnalytics] = useState<EngagementAnalytics | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementError, setEngagementError] = useState("");
  const [engagementUsersSource, setEngagementUsersSource] = useState<EngagementUsersSource>(() => normalizeEngagementUsersSource(new URLSearchParams(location.search).get("engagementSource")));
  const [engagementUsersSearch, setEngagementUsersSearch] = useState("");
  const [engagementUsers, setEngagementUsers] = useState<EngagementUserListItem[]>([]);
  const [engagementUsersTotal, setEngagementUsersTotal] = useState(0);
  const [engagementUsersLoading, setEngagementUsersLoading] = useState(false);
  const [engagementUsersError, setEngagementUsersError] = useState("");
  const [selectedEngagementUserId, setSelectedEngagementUserId] = useState("");
  const [engagementProfile, setEngagementProfile] = useState<EngagementUserProfile | null>(null);
  const [engagementProfileLoading, setEngagementProfileLoading] = useState(false);
  const [engagementProfileError, setEngagementProfileError] = useState("");
  const [crmTagInput, setCrmTagInput] = useState("");
  const [crmTagSaving, setCrmTagSaving] = useState(false);
  const [crmTagError, setCrmTagError] = useState("");
  const [crmNoteInput, setCrmNoteInput] = useState("");
  const [crmNoteSaving, setCrmNoteSaving] = useState(false);
  const [crmNoteError, setCrmNoteError] = useState("");
  const [crmTagSearch, setCrmTagSearch] = useState("");
  const [engagementTimelinePageSize, setEngagementTimelinePageSize] = useState(20);
  const [engagementTimelinePage, setEngagementTimelinePage] = useState(1);
  const [engagementTimelineSearch, setEngagementTimelineSearch] = useState("");
  const [crmCopyFeedback, setCrmCopyFeedback] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<CampaignStatusFilter>("all");
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<EngagementCampaignRecord[]>([]);
  const [campaignsTotal, setCampaignsTotal] = useState(0);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState("");
  const [campaignOptions, setCampaignOptions] = useState<{ dinners: Array<{ value: string; label: string }>; packages: Array<{ value: string; label: string }> }>({
    dinners: [],
    packages: [],
  });
  const [campaignComposerOpen, setCampaignComposerOpen] = useState(false);
  const [campaignComposerLoading, setCampaignComposerLoading] = useState(false);
  const [campaignComposerSaving, setCampaignComposerSaving] = useState(false);
  const [campaignComposerError, setCampaignComposerError] = useState("");
  const [campaignComposer, setCampaignComposer] = useState<CampaignComposerState>(emptyCampaignComposerState);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<EngagementCampaignRecord | null>(null);
  const [campaignLogs, setCampaignLogs] = useState<EngagementCampaignLog[]>([]);
  const [campaignLogsLoading, setCampaignLogsLoading] = useState(false);
  const [campaignLogsError, setCampaignLogsError] = useState("");
  const [campaignComposerTab, setCampaignComposerTab] = useState<CampaignComposerTab>("content");
  const [campaignLogSearch, setCampaignLogSearch] = useState("");
  const [campaignPreviewRating, setCampaignPreviewRating] = useState(0);
  const [smartSegments, setSmartSegments] = useState<SmartSegmentResult[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState("");
  const [recommendations, setRecommendations] = useState<AdminRecommendation[]>([]);
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
    vipApplicationsCount: 0,
    goldApplicationsCount: 0,
    totalGuestCount: 0,
    referralSourcedCount: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState("all");
  const [auditActionTypeFilter, setAuditActionTypeFilter] = useState("all");
  const [auditAdminFilter, setAuditAdminFilter] = useState("");
  const [auditReasonStateFilter, setAuditReasonStateFilter] = useState<"all" | "with_reason" | "without_reason">("all");
  const [auditSearchInput, setAuditSearchInput] = useState("");
  const [auditEntityTypeDraft, setAuditEntityTypeDraft] = useState("all");
  const [auditActionTypeDraft, setAuditActionTypeDraft] = useState("all");
  const [auditAdminInput, setAuditAdminInput] = useState("");
  const [auditReasonStateDraft, setAuditReasonStateDraft] = useState<"all" | "with_reason" | "without_reason">("all");
  const [auditFocusedLogs, setAuditFocusedLogs] = useState<AdminAuditLogEntry[] | null>(null);
  const [auditFocusedLabel, setAuditFocusedLabel] = useState("");
  const [bookingsOffset, setBookingsOffset] = useState(0);
  const [bookingsHasMore, setBookingsHasMore] = useState(false);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectionStatusSaving, setSelectionStatusSaving] = useState<Record<string, boolean>>({});
  const [applicationSaving, setApplicationSaving] = useState<Record<number, boolean>>({});
  const [bookingManageTarget, setBookingManageTarget] = useState<AdminTelegramApplication | null>(null);
  const [bookingManageStatus, setBookingManageStatus] = useState<AdminTelegramApplication["status"] | "">("");
  const [bookingManageNote, setBookingManageNote] = useState("");
  const [bookingManageReason, setBookingManageReason] = useState("");
  const [bookingManageError, setBookingManageError] = useState("");
  const [landingBookingManageTarget, setLandingBookingManageTarget] = useState<AdminLandingUser | null>(null);
  const [landingBookingManageSelectionStatus, setLandingBookingManageSelectionStatus] = useState<AdminLandingUser["selectionStatus"] | "">("");
  const [landingBookingManageAdminStatus, setLandingBookingManageAdminStatus] = useState<AdminLandingUser["adminStatus"] | "">("");
  const [landingBookingManageError, setLandingBookingManageError] = useState("");
  const [expandedTelegramBookingId, setExpandedTelegramBookingId] = useState<number | null>(null);
  const [expandedLandingBookingId, setExpandedLandingBookingId] = useState<string | null>(null);
  const [expandedGuestKey, setExpandedGuestKey] = useState<string | null>(null);
  const [telegramRecentApplications, setTelegramRecentApplications] = useState<AdminTelegramApplication[]>([]);
  const bookingManagerRef = useRef<HTMLElement | null>(null);
  const bookingManagerCloseRef = useRef<HTMLButtonElement | null>(null);
  const bookingManagerLastFocusRef = useRef<HTMLElement | null>(null);
  const landingBookingManagerRef = useRef<HTMLElement | null>(null);
  const landingBookingManagerCloseRef = useRef<HTMLButtonElement | null>(null);
  const landingBookingManagerLastFocusRef = useRef<HTMLElement | null>(null);
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

  const loadEngagementAnalytics = async () => {
    setEngagementLoading(true);
    setEngagementError("");
    try {
      const previousRange = getPreviousEngagementRange(engagementFilters.startDate, engagementFilters.endDate);
      const [analytics, previousAnalytics] = await Promise.all([
        getEngagementAnalytics({
          startDate: engagementFilters.startDate,
          endDate: engagementFilters.endDate,
          source: engagementFilters.source,
          dinnerId: engagementFilters.dinnerId,
          package: engagementFilters.package,
        }),
        getEngagementAnalytics({
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
          source: engagementFilters.source,
          dinnerId: engagementFilters.dinnerId,
          package: engagementFilters.package,
        }),
      ]);
      setEngagementAnalytics(analytics);
      setEngagementPreviousAnalytics(previousAnalytics);
    } catch (err) {
      setEngagementError(err instanceof Error ? err.message : "failed to load engagement analytics");
    } finally {
      setEngagementLoading(false);
    }
  };

  const loadEngagementUsers = async () => {
    setEngagementUsersLoading(true);
    setEngagementUsersError("");
    try {
      const response = await getEngagementUsers({
        source: engagementUsersSource,
        search: engagementUsersSearch.trim(),
        limit: Math.max(20, Math.min(120, (data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE) * 4)),
        offset: 0,
      });
      setEngagementUsers(response.users);
      setEngagementUsersTotal(response.total);
      setSelectedEngagementUserId((previous) => {
        if (previous && response.users.some((item) => item.id === previous)) {
          return previous;
        }
        return response.users[0]?.id ?? "";
      });
    } catch (err) {
      setEngagementUsersError(err instanceof Error ? err.message : "failed to load engagement users");
    } finally {
      setEngagementUsersLoading(false);
    }
  };

  const loadEngagementUserProfile = async (userId: string, sourceOverride?: EngagementUsersSource) => {
    if (!userId) {
      setEngagementProfile(null);
      return;
    }
    setEngagementProfileLoading(true);
    setEngagementProfileError("");
    try {
      const profile = await getEngagementUserProfile(sourceOverride ?? engagementUsersSource, userId);
      setEngagementProfile(profile);
    } catch (err) {
      setEngagementProfileError(err instanceof Error ? err.message : "failed to load engagement profile");
    } finally {
      setEngagementProfileLoading(false);
    }
  };

  const loadEngagementUserEvents = async (userId: string, sourceOverride?: EngagementUsersSource) => {
    if (!userId) {
      return;
    }
    try {
      const eventsPage = await getEngagementUserEvents(sourceOverride ?? engagementUsersSource, userId, {
        limit: engagementTimelinePageSize,
        offset: Math.max(0, (engagementTimelinePage - 1) * engagementTimelinePageSize),
        search: engagementTimelineSearch.trim(),
      });
      setEngagementProfile((prev) => prev && prev.overview.id === userId ? { ...prev, eventsPage } : prev);
    } catch (err) {
      setEngagementProfileError(err instanceof Error ? err.message : "failed to load engagement events");
    }
  };

  const handleAddCrmTag = async () => {
    if (!engagementProfile || !crmTagInput.trim()) return;
    setCrmTagSaving(true);
    setCrmTagError("");
    try {
      const tags = await addUserTag(engagementProfile.overview.source, engagementProfile.overview.id, crmTagInput.trim());
      setEngagementProfile((prev) => prev ? { ...prev, tags } : prev);
      setCrmTagInput("");
    } catch (err) {
      setCrmTagError(err instanceof Error ? err.message : "failed to add tag");
    } finally {
      setCrmTagSaving(false);
    }
  };

  const handleRemoveCrmTag = async (tag: string) => {
    if (!engagementProfile) return;
    try {
      const tags = await removeUserTag(engagementProfile.overview.source, engagementProfile.overview.id, tag);
      setEngagementProfile((prev) => prev ? { ...prev, tags } : prev);
    } catch (err) {
      setCrmTagError(err instanceof Error ? err.message : "failed to remove tag");
    }
  };

  const handleAddCrmNote = async () => {
    if (!engagementProfile || !crmNoteInput.trim()) return;
    setCrmNoteSaving(true);
    setCrmNoteError("");
    try {
      const note = await addUserNote(engagementProfile.overview.source, engagementProfile.overview.id, crmNoteInput.trim());
      setEngagementProfile((prev) => prev ? { ...prev, notes: [note, ...(prev.notes ?? [])] } : prev);
      setCrmNoteInput("");
    } catch (err) {
      setCrmNoteError(err instanceof Error ? err.message : "failed to add note");
    } finally {
      setCrmNoteSaving(false);
    }
  };

  const handleDeleteCrmNote = async (noteId: number) => {
    if (!engagementProfile) return;
    try {
      await deleteUserNote(engagementProfile.overview.source, engagementProfile.overview.id, noteId);
      setEngagementProfile((prev) => prev ? { ...prev, notes: (prev.notes ?? []).filter((n) => n.id !== noteId) } : prev);
    } catch (err) {
      setCrmNoteError(err instanceof Error ? err.message : "failed to delete note");
    }
  };

  const handleCopyCrmField = async (label: string, value?: string | null) => {
    const normalized = (value ?? "").trim();
    if (!normalized) {
      return;
    }
    try {
      await navigator.clipboard.writeText(normalized);
      setCrmCopyFeedback(`${label} copied`);
    } catch {
      setCrmCopyFeedback(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const openFullEngagementProfile = (userId: string, source: EngagementUsersSource) => {
    navigate(`/users/${encodeURIComponent(userId)}?source=${source}&tab=overview`);
  };

  const closeFullEngagementProfile = () => {
    navigate(`/admin?section=engagement&engagementTab=users&engagementSource=${routeProfileSource}`);
  };

  useEffect(() => {
    if (!crmCopyFeedback) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCrmCopyFeedback(""), 1800);
    return () => window.clearTimeout(timer);
  }, [crmCopyFeedback]);

  useEffect(() => {
    setEngagementTimelinePage(1);
  }, [selectedEngagementUserId, engagementTimelinePageSize, engagementTimelineSearch]);

  useEffect(() => {
    if (!selectedEngagementUserId || !engagementProfile) {
      return;
    }
    void loadEngagementUserEvents(selectedEngagementUserId, engagementProfile.overview.source);
  }, [selectedEngagementUserId, engagementProfile?.overview.source, engagementTimelinePage, engagementTimelinePageSize, engagementTimelineSearch]);

  const loadCampaignOptions = async () => {
    try {
      const options = await getEngagementCampaignOptions();
      setCampaignOptions(options);
    } catch (err) {
      setCampaignsError(err instanceof Error ? err.message : "failed to load campaign options");
    }
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    setCampaignsError("");
    try {
      const response = await getEngagementCampaigns({
        limit: Math.max(12, Math.min(60, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE)),
        offset: 0,
        search: campaignSearchQuery.trim(),
        status: campaignStatusFilter,
      });
      setCampaigns(response.campaigns);
      setCampaignsTotal(response.total);
      setSelectedCampaignId((previous) => {
        if (previous && response.campaigns.some((item) => item.id === previous)) {
          return previous;
        }
        return response.campaigns[0]?.id ?? null;
      });
    } catch (err) {
      setCampaignsError(err instanceof Error ? err.message : "failed to load campaigns");
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadCampaignDetail = async (campaignId: number) => {
    setCampaignLogsLoading(true);
    setCampaignLogsError("");
    try {
      const [campaign, logsResponse] = await Promise.all([
        getEngagementCampaign(campaignId),
        getEngagementCampaignLogs(campaignId, { limit: 40, offset: 0 }),
      ]);
      setSelectedCampaign(campaign);
      setCampaignLogs(logsResponse.logs);
    } catch (err) {
      setCampaignLogsError(err instanceof Error ? err.message : "failed to load campaign details");
    } finally {
      setCampaignLogsLoading(false);
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

  const loadTelegramApplications = async (append = false) => {
    setUsersLoading(true);
    setUsersError("");
    const pageSize = Math.max(5, Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE));
    const nextOffset = append ? bookingsOffset : 0;
    try {
      const response = await getAdminTelegramApplications({
        search: searchQuery.trim(),
        status: usersStatus === "all" ? "" : usersStatus,
        limit: pageSize,
        offset: nextOffset,
      });
      setTelegramApplications((prev) => (append ? [...prev, ...response.applications] : response.applications));
      setTelegramApplicationsSummary(response.summary);
      setBookingsHasMore(response.applications.length === pageSize);
      setBookingsOffset(nextOffset + response.applications.length);
      const logs = await getAdminAuditLogs({ limit: 12, offset: 0 });
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
      const logs = await getAdminAuditLogs({ limit: 12, offset: 0 });
      setAuditLogs(logs);
    } catch {
      // Keep overview resilient even if telegram booking storage is unavailable.
    }
  };

  const loadLandingBookings = async (append = false) => {
    setUsersLoading(true);
    setUsersError("");
    const pageSize = Math.max(5, Math.min(200, data?.settings?.runtime?.adminUsersPageSize ?? USERS_PAGE_SIZE));
    const nextOffset = append ? bookingsOffset : 0;
    try {
      const response = await getAdminLandingUsers({
        search: searchQuery.trim(),
        status: usersStatus === "all" ? "" : usersStatus,
        limit: pageSize,
        offset: nextOffset,
      });
      setLandingUsers((prev) => (append ? [...prev, ...response.users] : response.users));
      setLandingUsersSummary(response.summary);
      setBookingsHasMore(response.users.length === pageSize);
      setBookingsOffset(nextOffset + response.users.length);
      const logs = await getAdminAuditLogs({ limit: 12, offset: 0 });
      setAuditLogs(logs);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load landing applications");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAuditLogs = async (append = false) => {
    setAuditLoading(true);
    try {
      const pageSize = 24;
      const nextOffset = append ? auditOffset : 0;
      const useAuditFilters = activeSection === "audit";
      const logs = await getAdminAuditLogs({
        limit: pageSize,
        offset: nextOffset,
        search: useAuditFilters ? auditSearchQuery.trim() : "",
        entityType: useAuditFilters && auditEntityTypeFilter !== "all" ? auditEntityTypeFilter : "",
        actionType: useAuditFilters && auditActionTypeFilter !== "all" ? auditActionTypeFilter : "",
        adminUsername: useAuditFilters ? auditAdminFilter.trim() : "",
        reasonState: useAuditFilters ? auditReasonStateFilter : "all",
      });
      setAuditLogs((prev) => (append ? [...prev, ...logs] : logs));
      setAuditHasMore(logs.length === pageSize);
      setAuditOffset(nextOffset + logs.length);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "failed to load admin audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    void loadPanel();
  }, []);

  useEffect(() => {
    const nextSection = isEngagementUserProfileRoute ? "engagement" : getSectionFromSearch(location.search);
    setActiveSection((current) => (current === nextSection ? current : nextSection));
  }, [location.search, isEngagementUserProfileRoute]);

  useEffect(() => {
    if (!isEngagementUserProfileRoute) {
      return;
    }
    setEngagementProfileTab(getEngagementProfileTabFromSearch(location.search));
  }, [isEngagementUserProfileRoute, location.search]);

  useEffect(() => {
    if (isEngagementUserProfileRoute || getSectionFromSearch(location.search) !== "engagement") {
      return;
    }
    setEngagementTab(getEngagementTabFromSearch(location.search));
    setEngagementUsersSource(normalizeEngagementUsersSource(new URLSearchParams(location.search).get("engagementSource")));
  }, [isEngagementUserProfileRoute, location.search]);

  useEffect(() => {
    if (isEngagementUserProfileRoute) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const currentSection = params.get("section")?.trim().toLowerCase() ?? "";
    if (currentSection === activeSection) {
      return;
    }
    params.set("section", activeSection);
    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
      },
      { replace: true }
    );
  }, [activeSection, location.pathname, location.search, navigate, isEngagementUserProfileRoute]);

  useEffect(() => {
    if (!isEngagementUserProfileRoute) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const currentTab = params.get("tab")?.trim().toLowerCase() ?? "";
    const currentSource = normalizeEngagementUsersSource(params.get("source"));
    if (currentTab === engagementProfileTab && currentSource === routeProfileSource) {
      return;
    }
    params.set("tab", engagementProfileTab);
    params.set("source", routeProfileSource);
    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
      },
      { replace: true }
    );
  }, [engagementProfileTab, isEngagementUserProfileRoute, location.pathname, location.search, navigate, routeProfileSource]);

  useEffect(() => {
    if (isEngagementUserProfileRoute || activeSection !== "engagement") {
      return;
    }
    const params = new URLSearchParams(location.search);
    const currentTab = getEngagementTabFromSearch(location.search);
    const currentSource = normalizeEngagementUsersSource(params.get("engagementSource"));
    if (currentTab === engagementTab && currentSource === engagementUsersSource) {
      return;
    }
    params.set("engagementTab", engagementTab);
    params.set("engagementSource", engagementUsersSource);
    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
      },
      { replace: true }
    );
  }, [activeSection, engagementTab, engagementUsersSource, isEngagementUserProfileRoute, location.pathname, location.search, navigate]);

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
    if (activeSection !== "engagement" || engagementTab !== "analytics") {
      return;
    }
    void loadEngagementAnalytics();
  }, [activeSection, engagementTab, engagementFilters.startDate, engagementFilters.endDate, engagementFilters.source, engagementFilters.dinnerId, engagementFilters.package]);

  useEffect(() => {
    if (isEngagementUserProfileRoute || activeSection !== "engagement" || engagementTab !== "users") {
      return;
    }
    void loadEngagementUsers();
  }, [activeSection, engagementTab, engagementUsersSource, engagementUsersSearch, data?.settings?.runtime?.adminUsersPageSize, isEngagementUserProfileRoute]);

  useEffect(() => {
    if (isEngagementUserProfileRoute || activeSection !== "engagement" || engagementTab !== "users" || !selectedEngagementUserId) {
      return;
    }
    setEngagementProfile(null);
  }, [activeSection, engagementTab, engagementUsersSource, selectedEngagementUserId, isEngagementUserProfileRoute]);

  useEffect(() => {
    if (!isEngagementUserProfileRoute || !routeUserId) {
      return;
    }
    void loadEngagementUserProfile(routeUserId, routeProfileSource);
  }, [isEngagementUserProfileRoute, routeUserId, routeProfileSource]);

  useEffect(() => {
    if (activeSection !== "engagement" || engagementTab !== "campaigns") {
      return;
    }
    void loadCampaignOptions();
    void loadCampaigns();
  }, [activeSection, engagementTab, campaignStatusFilter, campaignSearchQuery, data?.settings?.runtime?.adminUsersPageSize]);

  useEffect(() => {
    if (activeSection !== "engagement" || engagementTab !== "campaigns" || selectedCampaignId == null) {
      return;
    }
    void loadCampaignDetail(selectedCampaignId);
  }, [activeSection, engagementTab, selectedCampaignId]);

  useEffect(() => {
    if (activeSection !== "engagement" || engagementTab !== "segments") {
      return;
    }
    setSegmentsLoading(true);
    setSegmentsError("");
    Promise.all([getSmartSegments(), getAdminRecommendations()])
      .then(([segs, recs]) => {
        setSmartSegments(segs);
        setRecommendations(recs);
      })
      .catch((err) => setSegmentsError(err instanceof Error ? err.message : "failed to load segments"))
      .finally(() => { setSegmentsLoading(false); });
  }, [activeSection, engagementTab]);

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
    if (activeSection !== "audit") {
      return;
    }
    setAuditSearchInput(auditSearchQuery);
    setAuditEntityTypeDraft(auditEntityTypeFilter);
    setAuditActionTypeDraft(auditActionTypeFilter);
    setAuditAdminInput(auditAdminFilter);
    setAuditReasonStateDraft(auditReasonStateFilter);
    void loadAuditLogs();
  }, [auditSearchQuery, auditEntityTypeFilter, auditActionTypeFilter, auditAdminFilter, auditReasonStateFilter]);

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
      if (activeSection === "engagement" && engagementTab === "analytics") {
        void loadEngagementAnalytics();
        return;
      }
      if (activeSection === "engagement" && engagementTab === "users") {
        if (isEngagementUserProfileRoute && routeUserId) {
          void loadEngagementUserProfile(routeUserId, routeProfileSource);
        } else {
          void loadEngagementUsers();
        }
        return;
      }
      if (activeSection === "engagement" && engagementTab === "campaigns") {
        void loadCampaigns();
        if (selectedCampaignId != null) {
          void loadCampaignDetail(selectedCampaignId);
        }
        return;
      }
      if (activeSection === "audit" || activeSection === "operations") {
        void loadAuditLogs();
        return;
      }
      void loadPanel(true);
    }, intervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [data?.settings.runtime.panelAutoRefreshSeconds, activeSection, usersSource, bookingsSource, usersStatus, searchQuery, engagementTab, engagementFilters.startDate, engagementFilters.endDate, engagementFilters.source, engagementFilters.dinnerId, engagementFilters.package, engagementUsersSource, engagementUsersSearch, selectedEngagementUserId, campaignStatusFilter, campaignSearchQuery, selectedCampaignId, isEngagementUserProfileRoute, routeUserId, routeProfileSource]);

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
    if (activeSection === "engagement" && engagementTab === "analytics") {
      await loadEngagementAnalytics();
      return;
    }
    if (activeSection === "engagement" && engagementTab === "users") {
      if (isEngagementUserProfileRoute && routeUserId) {
        await loadEngagementUserProfile(routeUserId, routeProfileSource);
      } else {
        await loadEngagementUsers();
      }
      return;
    }
    if (activeSection === "engagement" && engagementTab === "campaigns") {
      await loadCampaigns();
      if (selectedCampaignId != null) {
        await loadCampaignDetail(selectedCampaignId);
      }
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
    if (activeSection === "overview") {
      await Promise.all([loadPanel(true), loadOverviewOperations(), loadDinners()]);
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

  const handleLoadMoreBookings = async () => {
    if (usersLoading || !bookingsHasMore) {
      return;
    }
    if (bookingsSource === "landing") {
      await loadLandingBookings(true);
      return;
    }
    await loadTelegramApplications(true);
  };

  const handleLoadMoreAuditLogs = async () => {
    if (auditLoading || !auditHasMore) {
      return;
    }
    await loadAuditLogs(true);
  };

  const handleOpenNewCampaign = () => {
    setCampaignComposerError("");
    setCampaignComposer(emptyCampaignComposerState);
    setCampaignComposerTab("content");
    setCampaignComposerOpen(true);
  };

  const handleEditCampaign = async (campaignId: number) => {
    setCampaignComposerLoading(true);
    setCampaignComposerError("");
    try {
      const campaign = await getEngagementCampaign(campaignId);
      setCampaignComposer(buildCampaignComposerStateFromRecord(campaign));
      setCampaignComposerTab("content");
      setCampaignComposerOpen(true);
    } catch (err) {
      setCampaignComposerError(err instanceof Error ? err.message : "failed to load campaign");
    } finally {
      setCampaignComposerLoading(false);
    }
  };

  const handleSaveCampaign = async () => {
    setCampaignComposerSaving(true);
    setCampaignComposerError("");
    try {
      const payload = buildCampaignPayload(campaignComposer);
      let saved: EngagementCampaignRecord;
      if (campaignComposer.id != null) {
        saved = await updateEngagementCampaign(campaignComposer.id, payload);
      } else {
        saved = await createEngagementCampaign(payload);
      }
      setCampaignComposerOpen(false);
      setSelectedCampaignId(saved.id);
      await loadCampaigns();
      await loadCampaignDetail(saved.id);
      setInfoMessage(`Campaign ${saved.title} saved.`);
    } catch (err) {
      setCampaignComposerError(err instanceof Error ? err.message : "failed to save campaign");
    } finally {
      setCampaignComposerSaving(false);
    }
  };

  const handleScheduleCampaign = async (campaignId: number, sendNow = false) => {
    try {
      const campaign = await scheduleEngagementCampaign(campaignId, {
        sendNow,
        scheduledFor: sendNow ? undefined : campaignComposer.scheduledFor ? new Date(campaignComposer.scheduledFor).toISOString() : undefined,
      });
      setSelectedCampaignId(campaign.id);
      setSelectedCampaign(campaign);
      await loadCampaigns();
      await loadCampaignDetail(campaign.id);
      setInfoMessage(sendNow ? `Campaign ${campaign.title} is now sending.` : `Campaign ${campaign.title} scheduled.`);
    } catch (err) {
      setCampaignComposerError(err instanceof Error ? err.message : "failed to schedule campaign");
    }
  };

  const handleCancelCampaign = async (campaignId: number) => {
    if (!window.confirm("Cancel this campaign and stop any remaining queued sends?")) {
      return;
    }
    try {
      const campaign = await cancelEngagementCampaign(campaignId);
      setSelectedCampaign(campaign);
      await loadCampaigns();
      await loadCampaignDetail(campaign.id);
      setInfoMessage(`Campaign ${campaign.title} cancelled.`);
    } catch (err) {
      setCampaignComposerError(err instanceof Error ? err.message : "failed to cancel campaign");
    }
  };

  const handleTestSendCampaign = async (campaignId: number) => {
    const userId = window.prompt("Telegram user ID for test send");
    if (!userId) {
      return;
    }
    try {
      const campaign = await testSendEngagementCampaign(campaignId, userId);
      setSelectedCampaign(campaign);
      await loadCampaignDetail(campaign.id);
      setInfoMessage(`Test send queued for campaign ${campaign.title}.`);
    } catch (err) {
      setCampaignComposerError(err instanceof Error ? err.message : "failed to queue test send");
    }
  };

  const handleOpenAuditGroup = (event: AuditTimelineEvent, sourceLogs: AdminAuditLogEntry[]) => {
    const groupLogs = sourceLogs.filter((item) => event.itemIds.includes(item.id));
    setAuditFocusedLogs(groupLogs);
    setAuditFocusedLabel(`${event.actionLabel} · ${event.itemCount} edits`);
    setActiveSection("audit");
  };

  const handleClearAuditFocus = () => {
    setAuditFocusedLogs(null);
    setAuditFocusedLabel("");
  };

  const handleApplyAuditFilters = () => {
    setAuditFocusedLogs(null);
    setAuditFocusedLabel("");
    const nextSearch = auditSearchInput.trim();
    const nextEntity = auditEntityTypeDraft;
    const nextAction = auditActionTypeDraft;
    const nextAdmin = auditAdminInput.trim();
    const nextReason = auditReasonStateDraft;
    const unchanged =
      nextSearch === auditSearchQuery &&
      nextEntity === auditEntityTypeFilter &&
      nextAction === auditActionTypeFilter &&
      nextAdmin === auditAdminFilter &&
      nextReason === auditReasonStateFilter;

    setAuditSearchQuery(nextSearch);
    setAuditEntityTypeFilter(nextEntity);
    setAuditActionTypeFilter(nextAction);
    setAuditAdminFilter(nextAdmin);
    setAuditReasonStateFilter(nextReason);

    if (unchanged && activeSection === "audit") {
      void loadAuditLogs();
    }
  };

  const handleResetAuditFilters = () => {
    setAuditFocusedLogs(null);
    setAuditFocusedLabel("");
    setAuditSearchInput("");
    setAuditEntityTypeDraft("all");
    setAuditActionTypeDraft("all");
    setAuditAdminInput("");
    setAuditReasonStateDraft("all");
    setAuditSearchQuery("");
    setAuditEntityTypeFilter("all");
    setAuditActionTypeFilter("all");
    setAuditAdminFilter("");
    setAuditReasonStateFilter("all");
  };

  const handleUpdateLandingUserStatus = async (
    userID: string,
    payload: {
      selectionStatus?: AdminLandingUser["selectionStatus"];
      adminStatus?: AdminLandingUser["adminStatus"];
    }
  ) => {
    setSelectionStatusSaving((prev) => ({ ...prev, [userID]: true }));
    setUsersError("");
    if (landingBookingManageTarget?.id === userID) {
      setLandingBookingManageError("");
    }
    try {
      const updated = await updateAdminLandingUserStatus(userID, payload);
      setLandingUsers((prev) =>
        prev
          .map((user) => (user.id === userID ? updated : user))
          .filter((user) => {
            if (bookingsSource !== "landing") {
              return true;
            }
            return matchesLandingBookingFilter(user, usersStatus);
          })
      );
      if (landingBookingManageTarget?.id === updated.id) {
        setLandingBookingManageTarget(updated);
        setLandingBookingManageSelectionStatus(updated.selectionStatus);
        setLandingBookingManageAdminStatus(updated.adminStatus);
      }
      setInfoMessage("User status updated");
      window.setTimeout(() => setInfoMessage(""), 1500);
      if (activeSection === "bookings") {
        const logs = await getAdminAuditLogs({ limit: 12, offset: 0 });
        setAuditLogs(logs);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update user status";
      if (landingBookingManageTarget?.id === userID) {
        setLandingBookingManageError(message);
      } else {
        setUsersError(message);
      }
      return false;
    } finally {
      setSelectionStatusSaving((prev) => {
        const next = { ...prev };
        delete next[userID];
        return next;
      });
    }
  };

  const openLandingBookingManager = (user: AdminLandingUser) => {
    setLandingBookingManageTarget(user);
    setLandingBookingManageSelectionStatus(user.selectionStatus);
    setLandingBookingManageAdminStatus(user.adminStatus);
    setLandingBookingManageError("");
  };

  const closeLandingBookingManager = (force = false) => {
    if (!force && landingBookingManageTarget && selectionStatusSaving[landingBookingManageTarget.id]) {
      return;
    }
    setLandingBookingManageTarget(null);
    setLandingBookingManageSelectionStatus("");
    setLandingBookingManageAdminStatus("");
    setLandingBookingManageError("");
  };

  const toggleLandingBookingExpanded = (userID: string) => {
    setExpandedLandingBookingId((current) => (current === userID ? null : userID));
  };

  const handleSaveLandingBookingManager = async () => {
    if (!landingBookingManageTarget) {
      return;
    }
    const saved = await handleUpdateLandingUserStatus(landingBookingManageTarget.id, {
      selectionStatus: landingBookingManageSelectionStatus || undefined,
      adminStatus: landingBookingManageAdminStatus || undefined,
    });
    if (saved) {
      closeLandingBookingManager(true);
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
      setTelegramApplications((prev) => {
        const nextItems = prev
          .map((item) => (item.packageInfoId === updated.packageInfoId ? updated : item))
          .filter((item) => {
            if (bookingsSource !== "telegram" || usersStatus === "all") {
              return true;
            }
            return item.status === usersStatus;
          });
        return nextItems;
      });
      setTelegramRecentApplications((prev) =>
        prev.map((item) => (item.packageInfoId === updated.packageInfoId ? updated : item))
      );
      setTelegramApplicationsSummary((prev) =>
        adjustTelegramApplicationsSummary(prev, application.status, updated.status)
      );
      if (bookingManageTarget?.packageInfoId === updated.packageInfoId) {
        setBookingManageTarget(updated);
        setBookingManageStatus(updated.status);
        setBookingManageNote(updated.adminNote || "");
        setBookingManageReason("");
      }
      setInfoMessage(`Application ${updated.publicCode || `#${updated.packageInfoId}`} updated`);
      window.setTimeout(() => setInfoMessage(""), 1800);
      // Reload dinners/capacity and audit logs after every status change so that
      // the capacity bars and summary cards reflect the new booking state.
      const [logs] = await Promise.all([
        getAdminAuditLogs({ limit: 12, offset: 0 }),
        loadDinners(),
      ]);
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
      const payload = {
        dishType: dishForm.dishType,
        nameEng: dishForm.nameEng.trim(),
        nameRus: dishForm.nameRus.trim(),
        nameArm: dishForm.nameArm.trim(),
        price,
      };
      const saved = editingDishId
        ? await updateAdminDish(editingDishId, payload)
        : await createAdminDish(payload);
      setInfoMessage(editingDishId ? "Dish updated" : "Dish created");
      window.setTimeout(() => setInfoMessage(""), 1500);
      if (saved.dishType === dishType) {
        setDishes((prev) => {
          if (editingDishId) {
            return prev.map((item) => (item.id === saved.id ? saved : item));
          }
          return [saved, ...prev];
        });
      } else if (dishType) {
        await loadDishes(dishType);
      }
      setDishForm((prev) => ({ ...emptyDishForm, dishType: prev.dishType || dishType }));
      setEditingDishId(null);
    } catch (err) {
      setDishesError(err instanceof Error ? err.message : `failed to ${editingDishId ? "update" : "create"} dish`);
    } finally {
      setDishSaving(false);
    }
  };

  const handleEditDish = (item: AdminDishItem) => {
    setEditingDishId(item.id);
    setDishForm({
      dishType: item.dishType,
      nameEng: item.nameEng,
      nameRus: item.nameRus,
      nameArm: item.nameArm,
      price: item.price.toFixed(2),
    });
    setDishesError("");
  };

  const handleCancelDishEdit = () => {
    setEditingDishId(null);
    setDishForm({ ...emptyDishForm, dishType: dishType || dishForm.dishType });
    setDishesError("");
  };

  const confirmDeleteDish = async () => {
    if (!dishDeleteTarget) {
      return;
    }
    setDishDeleting(true);
    setDishesError("");
    try {
      await deleteAdminDish(dishDeleteTarget.id);
      setDishes((prev) => prev.filter((item) => item.id !== dishDeleteTarget.id));
      if (editingDishId === dishDeleteTarget.id) {
        setEditingDishId(null);
        setDishForm((prev) => ({ ...emptyDishForm, dishType: prev.dishType || dishType }));
      }
      setDishDeleteTarget(null);
      setInfoMessage("Dish deleted");
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch (err) {
      setDishesError(err instanceof Error ? err.message : "failed to delete dish");
    } finally {
      setDishDeleting(false);
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
          { value: "new", label: "New" },
          { value: "review", label: "In review" },
          { value: "contacted", label: "Contacted" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "open", label: "Open" },
          { value: "completed", label: "Completed" },
        ]
      : [
          { value: "all", label: "All" },
          { value: "draft", label: "Draft" },
          { value: "pending_application", label: "Pending" },
          { value: "contacted", label: "Contacted" },
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
  const landingSelectionFilterOptions = [
    { value: "all", label: "All" },
    { value: "open", label: "Open" },
    { value: "completed", label: "Completed" },
  ];
  const landingReviewFilterOptions = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "review", label: "In review" },
    { value: "contacted", label: "Contacted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];
  const userStatusOptions =
    usersSource === "landing"
      ? landingSelectionStatusOptions
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
    return telegramUsers.map((item) => buildGuestCrmRowFromTelegramUser(item));
  }, [usersSource, landingUsers, telegramUsers]);

  const dinnersById = useMemo(() => new Map(dinners.map((item) => [item.id, item])), [dinners]);
  const bookingManageSections = useMemo(
    () => getTelegramBookingActionSections(telegramBookingActionOptions, bookingManageTarget?.status),
    [bookingManageTarget?.status]
  );
  const bookingManageDangerOptions = useMemo(
    () => getTelegramBookingDangerOptions(telegramBookingActionOptions, bookingManageTarget?.status),
    [bookingManageTarget?.status]
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

  useEffect(() => {
    if (!landingBookingManageTarget) {
      return;
    }

    landingBookingManagerLastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.setTimeout(() => {
      landingBookingManagerCloseRef.current?.focus();
    }, 0);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !selectionStatusSaving[landingBookingManageTarget.id]) {
        event.preventDefault();
        closeLandingBookingManager();
        return;
      }

      if (event.key !== "Tab" || !landingBookingManagerRef.current) {
        return;
      }

      const focusable = landingBookingManagerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !landingBookingManagerRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !landingBookingManagerRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
      landingBookingManagerLastFocusRef.current?.focus();
    };
  }, [landingBookingManageTarget, selectionStatusSaving]);

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
  const paidGuestsCount = telegramApplicationsSummary.paid;
  const upcomingDinnerCapacity = dinners
    .filter((item) => !item.expired)
    .reduce((sum, item) => sum + Math.max(item.places - item.alreadyRegistered, 0), 0);
  const attentionNeededCount =
    awaitingApprovalCount +
    awaitingPaymentCount +
    pendingSelections +
    (telegramStats?.blockedActive ?? 0);
  const pageTitle = isEngagementUserProfileRoute
    ? engagementProfile?.overview.name || "User Intelligence Profile"
    : sectionLabels[activeSection];
  const pageSubtitle = isEngagementUserProfileRoute
    ? "Dedicated CRM profile with guest analytics, journey intelligence, notes, and raw event history."
    : sectionHints[activeSection];
  const lastUpdated = formatDateLabel(meta.generatedAt);

  const engagementSummary = engagementAnalytics?.summary;
  const selectedEngagementListItem = engagementUsers.find((item) => item.id === selectedEngagementUserId) ?? null;
  const engagementProfileScoreBreakdown = useMemo(
    () => (engagementProfile ? buildEngagementScoreBreakdown(engagementProfile) : null),
    [engagementProfile]
  );
  const engagementProfileHeatmapWeeks = useMemo(
    () => (engagementProfile ? buildEngagementHeatmap(engagementProfile.timeline) : []),
    [engagementProfile]
  );
  const engagementProfileHourActivity = useMemo(
    () => (engagementProfile ? buildEngagementHourBars(engagementProfile.timeline) : { bestHour: null, bars: [] as Array<{ key: string; label: string; value: number; percent: number }> }),
    [engagementProfile]
  );
  const engagementProfileJourneyStages = useMemo(
    () => (engagementProfile ? buildEngagementJourneyStages(engagementProfile) : []),
    [engagementProfile]
  );
  const engagementGroupedTimeline = useMemo(
    () => (engagementProfile ? groupEngagementTimelineItems(engagementProfile.eventsPage?.events ?? []) : []),
    [engagementProfile]
  );
  const engagementTimelineTotalPages = Math.max(1, Math.ceil((engagementProfile?.eventsPage?.total ?? 0) / engagementTimelinePageSize));
  const engagementTimelineCurrentPage = Math.min(engagementTimelinePage, engagementTimelineTotalPages);
  const engagementVisibleTimeline = engagementGroupedTimeline;
  const filteredCrmPresets = useMemo(() => {
    const presets = ["vip", "influencer", "investor", "partner", "student", "media", "referral_leader", "inactive"];
    const query = crmTagSearch.trim().toLowerCase();
    if (!query) {
      return presets;
    }
    return presets.filter((preset) => preset.replace(/_/g, " ").includes(query));
  }, [crmTagSearch]);
  useEffect(() => {
    setEngagementTimelinePage((previous) => Math.min(previous, engagementTimelineTotalPages));
  }, [engagementTimelineTotalPages]);
  const engagementDailyActivity = useMemo(
    () => (engagementProfile ? buildDailyActivityRows(engagementProfile.timeline) : []),
    [engagementProfile]
  );
  const engagementButtonClickRows = useMemo(
    () => (
      engagementProfile
        ? buildTimelineFrequency(engagementProfile.timeline, (item) => {
            const title = `${item.title} ${item.description}`.toLowerCase();
            if (!/(click|button|back|profile|invite|apply|package)/.test(title)) {
              return null;
            }
            return item.title.replace(/[_-]+/g, " ").trim() || "Interaction";
          })
        : []
    ),
    [engagementProfile]
  );
  const engagementPackageInterestRows = useMemo(
    () => (
      engagementProfile
        ? buildTimelineFrequency(engagementProfile.timeline, (item) => {
            const combined = `${item.title} ${item.description}`;
            if (!/package/i.test(combined)) {
              return null;
            }
            const match = combined.match(/package[^a-z0-9]*([a-z0-9_ -]+)/i);
            return match?.[1]?.trim() || item.title.trim();
          }, 6)
        : []
    ),
    [engagementProfile]
  );
  const engagementReferralNetworkRows = useMemo(() => {
    if (!engagementProfile) {
      return [];
    }
    return [
      { label: "Invited users", value: engagementProfile.referral.invitedUsers, percent: clampPercent((engagementProfile.referral.invitedUsers / Math.max(engagementProfile.referral.invitedUsers, engagementProfile.referral.referralClicks, engagementProfile.referral.referralSuccesses, 1)) * 100) },
      { label: "Referral clicks", value: engagementProfile.referral.referralClicks, percent: clampPercent((engagementProfile.referral.referralClicks / Math.max(engagementProfile.referral.invitedUsers, engagementProfile.referral.referralClicks, engagementProfile.referral.referralSuccesses, 1)) * 100) },
      { label: "Successful referrals", value: engagementProfile.referral.referralSuccesses, percent: clampPercent((engagementProfile.referral.referralSuccesses / Math.max(engagementProfile.referral.invitedUsers, engagementProfile.referral.referralClicks, engagementProfile.referral.referralSuccesses, 1)) * 100) },
    ];
  }, [engagementProfile]);
  const engagementProfileTabs: Array<{ key: EngagementProfileTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "journey", label: "Journey" },
    { key: "activity", label: "Activity Analytics" },
    { key: "referrals", label: "Referrals" },
    { key: "revenue", label: "Revenue & Attendance" },
    { key: "notes", label: "Notes & CRM" },
    { key: "campaigns", label: "Campaign Interactions" },
    { key: "events", label: "Raw Events" },
  ];
  const engagementSourceLabel = engagementSourceOptions.find((option) => option.value === engagementFilters.source)?.label ?? "Telegram + Landing";
  const engagementDinnerLabel =
    engagementFilters.dinnerId === "all"
      ? "All dinners"
      : engagementAnalytics?.filterOptions.dinners.find((option) => option.value === engagementFilters.dinnerId)?.label ?? "Selected dinner";
  const engagementPackageLabel =
    engagementFilters.package === "all"
      ? "All packages"
      : engagementAnalytics?.filterOptions.packages.find((option) => option.value === engagementFilters.package)?.label ?? "Selected package";
  const engagementFilterChips = [
    engagementSourceLabel,
    engagementDinnerLabel,
    engagementPackageLabel,
    `${engagementFilters.startDate} - ${engagementFilters.endDate}`,
  ];
  const previousEngagementSummary = engagementPreviousAnalytics?.summary;
  const currentFunnel = engagementAnalytics?.funnel ?? [];
  const previousFunnel = engagementPreviousAnalytics?.funnel ?? [];
  const engagementConversions = engagementAnalytics?.conversions;
  const previousEngagementConversions = engagementPreviousAnalytics?.conversions;
  const submittedApplications = currentFunnel.find((item) => item.key === "submitted_application")?.users ?? 0;
  const previousSubmittedApplications = previousFunnel.find((item) => item.key === "submitted_application")?.users ?? 0;
  const paidUsers = currentFunnel.find((item) => item.key === "paid")?.users ?? 0;
  const previousPaidUsers = previousFunnel.find((item) => item.key === "paid")?.users ?? 0;
  const currentConversionRate = engagementConversions?.displayRate ?? 0;
  const previousConversionRate = previousEngagementConversions?.displayRate ?? 0;
  const sourcePerformance = engagementAnalytics?.sourcePerformance ?? [];
  const sourceUsersTotal = sourcePerformance.reduce((sum, item) => sum + item.users, 0);
  const hourlyActivity = engagementAnalytics?.hourlyActivity ?? [];
  const bestEngagementHour = hourlyActivity.slice().sort((a, b) => {
    if (b.events !== a.events) return b.events - a.events;
    return b.activeUsers - a.activeUsers;
  })[0] ?? null;
  const dinnerPerformance = engagementAnalytics?.dinnerPerformance ?? [];
  const packageSelections = engagementAnalytics?.packageSelections ?? [];
  const buttonPerformance = engagementAnalytics?.buttonPerformance ?? [];
  const biggestDropOff = currentFunnel
    .slice(1)
    .sort((a, b) => b.dropOff - a.dropOff)[0] ?? null;

  const buildEngagementTrendLabel = (currentValue: number, previousValue: number) => {
    const diff = currentValue - previousValue;
    if (previousValue <= 0) {
      if (currentValue <= 0) {
        return { text: "→ No change", tone: "default" as const };
      }
      return { text: "↑ +100%", tone: "emerald" as const };
    }
    const percent = (diff / previousValue) * 100;
    if (Math.abs(percent) < 0.1) {
      return { text: "→ No change", tone: "default" as const };
    }
    return {
      text: `${percent >= 0 ? "↑" : "↓"} ${percent >= 0 ? "+" : ""}${percent.toFixed(0)}%`,
      tone: percent >= 0 ? ("emerald" as const) : ("danger" as const),
    };
  };

  const buildEngagementKpiNote = (key: string, value: number) => {
    switch (key) {
      case "returning-users":
        return value === 0 ? "No returning users yet" : "Users who came back";
      case "paid-users":
        return engagementConversions?.landingPaymentTracked === false
          ? value === 0
            ? "0 Telegram paid users"
            : "Telegram paid users only"
          : value === 0
            ? "0 paid users"
            : "Users who reached payment";
      case "applications":
        return value === 0 ? "No applications submitted yet" : "Submitted applications";
      case "conversion-rate":
        if (!engagementConversions) {
          return "No conversion data yet";
        }
        if (!engagementConversions.overallAvailable) {
          return `Landing payment tracking unavailable · Telegram ${engagementConversions.telegramPaidUsers}/${engagementConversions.telegramSubmittedUsers}`;
        }
        return `${engagementConversions.overallPaidUsers}/${engagementConversions.overallSubmittedUsers} applications converted`;
      case "active-users":
        return value === 0 ? "No active users yet" : "Users with meaningful engagement";
      case "total-events":
        return value === 0 ? "No tracked events yet" : "Tracked activity in this window";
      default:
        return "No data yet";
    }
  };

  const engagementKpiCards = engagementSummary
    ? [
        {
          key: "total-events",
          label: "Total Events",
          value: formatCompactNumber(engagementSummary.totalEvents),
          trend: buildEngagementTrendLabel(engagementSummary.totalEvents, previousEngagementSummary?.totalEvents ?? 0),
          note: buildEngagementKpiNote("total-events", engagementSummary.totalEvents),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => item.events),
        },
        {
          key: "active-users",
          label: "Active Users",
          value: formatCompactNumber(engagementSummary.activeUsers),
          trend: buildEngagementTrendLabel(engagementSummary.activeUsers, previousEngagementSummary?.activeUsers ?? 0),
          note: buildEngagementKpiNote("active-users", engagementSummary.activeUsers),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => item.activeUsers),
        },
        {
          key: "returning-users",
          label: "Returning Users",
          value: formatCompactNumber(engagementSummary.returningUsers),
          trend: buildEngagementTrendLabel(engagementSummary.returningUsers, previousEngagementSummary?.returningUsers ?? 0),
          note: buildEngagementKpiNote("returning-users", engagementSummary.returningUsers),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => item.returningUsers),
        },
        {
          key: "conversion-rate",
          label: engagementConversions?.displayLabel ?? "Conversion Rate",
          value: `${currentConversionRate.toFixed(1)}%`,
          trend: buildEngagementTrendLabel(currentConversionRate, previousConversionRate),
          note: buildEngagementKpiNote("conversion-rate", currentConversionRate),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => Math.round(item.conversionRate)),
        },
        {
          key: "applications",
          label: "Applications",
          value: formatCompactNumber(submittedApplications),
          trend: buildEngagementTrendLabel(submittedApplications, previousSubmittedApplications),
          note: buildEngagementKpiNote("applications", submittedApplications),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => item.applications),
        },
        {
          key: "paid-users",
          label: "Paid Users",
          value: formatCompactNumber(paidUsers),
          trend: buildEngagementTrendLabel(paidUsers, previousPaidUsers),
          note: buildEngagementKpiNote("paid-users", paidUsers),
          sparkline: (engagementAnalytics?.timeline ?? []).map((item) => item.paidUsers),
        },
      ]
    : [];

  const engagementKeyInsights = [
    {
      label: "Top traffic source",
      value: sourcePerformance[0]?.label ?? "Not enough data yet",
      detail: sourcePerformance[0] ? `${formatCompactNumber(sourcePerformance[0].users)} users in the selected range` : "Tracking is working, but this slice is still too small.",
    },
    {
      label: "Most popular dinner",
      value: dinnerPerformance[0]?.label ?? "Not enough data yet",
      detail: dinnerPerformance[0] ? `${formatCompactNumber(dinnerPerformance[0].views)} views and ${dinnerPerformance[0].conversionRate.toFixed(1)}% conversion` : "Need more dinner view activity to identify demand.",
    },
    {
      label: "Highest package intent",
      value: packageSelections[0]?.label ?? "Not enough data yet",
      detail: packageSelections[0] ? `${formatCompactNumber(packageSelections[0].value)} selections in this slice` : "Package intent has not formed yet.",
    },
    {
      label: "Largest drop-off",
      value: biggestDropOff?.label ?? "Not enough data yet",
      detail: biggestDropOff ? `${biggestDropOff.dropOff.toFixed(1)}% drop from the previous stage` : "Funnel needs more volume before drop-off patterns are reliable.",
    },
    {
      label: "Best engagement hour",
      value: bestEngagementHour?.label ?? "Not enough data yet",
      detail: bestEngagementHour ? `${formatCompactNumber(bestEngagementHour.events)} events from ${formatCompactNumber(bestEngagementHour.activeUsers)} active users` : "Need more hourly activity before the page can highlight a peak.",
    },
  ];
  const sectionMetrics: Record<AdminSection, MetricItem[]> = {
    overview: filterItems([
      { label: "Awaiting Approval", value: `${awaitingApprovalCount}`, description: "Telegram applications waiting for admin decision", trend: `${telegramApplicationsSummary.total} total telegram applications`, tone: awaitingApprovalCount > 0 ? "gold" : "emerald", icon: "01" },
      { label: "Awaiting Payment", value: `${awaitingPaymentCount}`, description: "Approved + waiting-payment bookings not yet settled", trend: `${telegramApplicationsSummary.waitingPayment} marked waiting payment`, tone: awaitingPaymentCount > 0 ? "gold" : "emerald", icon: "02" },
      { label: "Paid Bookings", value: `${paidGuestsCount}`, description: "Telegram bookings confirmed as paid", trend: `${telegramStats?.orders24h ?? 0} new bookings in last 24h`, tone: "emerald", icon: "03" },
      { label: "Available Seats", value: `${upcomingDinnerCapacity}`, description: "Remaining open seats across upcoming dinners", trend: `${dinnerRegistrationsTotal} seats currently booked`, tone: upcomingDinnerCapacity > 0 ? "default" : "danger", icon: "04" },
      { label: "Paid Revenue", value: formatCurrency(telegramStats?.revenueTotal ?? 0), description: "Total revenue from paid Telegram bookings only", trend: `${formatCurrency(telegramStats?.revenue24h ?? 0)} paid in last 24h`, tone: "gold", icon: "05" },
      { label: "Attention Needed", value: `${attentionNeededCount}`, description: "Pending approvals, unsettled payments, open landing selections, and blocked users", trend: `${pendingSelections} landing package selections still open`, tone: attentionNeededCount > 0 ? "danger" : "emerald", icon: "06" },
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
    engagement: filterItems([
      { label: "Active users", value: `${engagementSummary?.activeUsers ?? 0}`, description: "Users with deeper engagement in the selected period", trend: `${engagementSummary?.totalEvents ?? 0} tracked events`, tone: "emerald", icon: "E1" },
      { label: "Passive users", value: `${engagementSummary?.passiveUsers ?? 0}`, description: "Light-touch visitors and low-intent users", trend: "1-2 events in range", tone: "default", icon: "E2" },
      { label: "New users", value: `${engagementSummary?.newUsers ?? 0}`, description: "First-seen users entering the funnel", trend: `${engagementSummary?.returningUsers ?? 0} returning`, tone: "gold", icon: "E3" },
      { label: "Returning users", value: `${engagementSummary?.returningUsers ?? 0}`, description: "Known users who came back in the selected period", trend: "Relationship depth and retention signal", tone: "default", icon: "E4" },
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
      { label: "VIP share", value: `${telegramApplicationsSummary.vipApplicationsCount}`, description: "All applications with VIP as top package", trend: `${telegramApplicationsSummary.goldApplicationsCount} Gold`, tone: "gold", icon: "B5" },
      { label: "Guest count", value: `${telegramApplicationsSummary.totalGuestCount}`, description: "Combined guests across all applications", trend: `${telegramApplicationsSummary.referralSourcedCount} referral-sourced`, tone: "default", icon: "B6" },
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

  const landingBookingManagerModal =
    landingBookingManageTarget && typeof document !== "undefined"
      ? createPortal(
          <div
            className="admin-modal-backdrop admin-modal-backdrop--booking"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeLandingBookingManager();
              }
            }}
          >
            <article
              ref={landingBookingManagerRef}
              className="admin-modal admin-modal--booking"
              role="dialog"
              aria-modal="true"
              aria-labelledby="landing-booking-manager-title"
              aria-describedby="landing-booking-manager-subtitle"
              tabIndex={-1}
            >
              <header className="admin-modal__header admin-modal__header--booking">
                <button
                  ref={landingBookingManagerCloseRef}
                  className="admin-modal__close"
                  type="button"
                  onClick={() => closeLandingBookingManager()}
                  disabled={Boolean(selectionStatusSaving[landingBookingManageTarget.id])}
                  aria-label="Close booking manager"
                >
                  x
                </button>
                <p className="admin-modal__eyebrow">Booking Manager</p>
                <h3 id="landing-booking-manager-title">{landingBookingManageTarget.fullName || `Lead ${landingBookingManageTarget.id.slice(0, 8)}`}</h3>
                <p id="landing-booking-manager-subtitle" className="admin-modal__text">
                  {[
                    landingBookingManageTarget.dinnerTitle || "No dinner selected",
                    landingBookingManageTarget.chosenPackage || "No package selected",
                  ].join(" · ")}
                </p>

                <div className="admin-booking-manager__summary">
                  <AdminBadge tone={getLandingAdminStatusSummary(landingBookingManageAdminStatus || landingBookingManageTarget.adminStatus).tone}>
                    Review: {formatLandingAdminStatus(landingBookingManageAdminStatus || landingBookingManageTarget.adminStatus)}
                  </AdminBadge>
                  <AdminBadge tone={getLandingSelectionSummary(landingBookingManageSelectionStatus || landingBookingManageTarget.selectionStatus).tone}>
                    Selection: {formatLandingSelectionStatus(landingBookingManageSelectionStatus || landingBookingManageTarget.selectionStatus)}
                  </AdminBadge>
                </div>
              </header>

              <div className="admin-modal__body admin-modal__body--booking">
                {landingBookingManageError ? <p className="admin-auth__error admin-booking-manager__error">{landingBookingManageError}</p> : null}
                <div className="admin-booking-manager__grid">
                  <section className="admin-booking-manager__card">
                    <h4>Review Status</h4>
                    <div className="admin-booking-manager__options">
                      {landingReviewStatusOptions.map((option) => {
                        const tone = getBookingActionTone(option.value);
                        const isActive = option.value === landingBookingManageAdminStatus;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`admin-booking-manager__option admin-booking-manager__option--${tone} ${isActive ? "admin-booking-manager__option--active" : ""}`}
                            onClick={() => setLandingBookingManageAdminStatus(option.value)}
                            disabled={Boolean(selectionStatusSaving[landingBookingManageTarget.id])}
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

                  <section className="admin-booking-manager__card">
                    <h4>Selection Status</h4>
                    <div className="admin-booking-manager__options">
                      {landingSelectionStatusOptions.map((option) => {
                        const tone = getBookingActionTone(option.value);
                        const isActive = option.value === landingBookingManageSelectionStatus;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`admin-booking-manager__option admin-booking-manager__option--${tone} ${isActive ? "admin-booking-manager__option--active" : ""}`}
                            onClick={() => setLandingBookingManageSelectionStatus(option.value)}
                            disabled={Boolean(selectionStatusSaving[landingBookingManageTarget.id])}
                          >
                            <span className="admin-booking-manager__option-icon" aria-hidden="true">
                              {getLandingSelectionStatusIcon(option.value)}
                            </span>
                            <span className="admin-booking-manager__option-text">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>Booking Details</h4>
                    <p className="admin-booking-manager__copy">Dinner: {landingBookingManageTarget.dinnerTitle || "—"}</p>
                    <p className="admin-booking-manager__copy">Package: {landingBookingManageTarget.chosenPackage || "Unselected"}</p>
                    <p className="admin-booking-manager__copy">Guests: {landingBookingManageTarget.guestCount}</p>
                    <p className="admin-booking-manager__copy">Email: {landingBookingManageTarget.email || "—"}</p>
                    <p className="admin-booking-manager__copy">Phone: {landingBookingManageTarget.phone || "—"}</p>
                    <p className="admin-booking-manager__copy">Hobbies: {landingBookingManageTarget.hobbies || "—"}</p>
                    <p className="admin-booking-manager__copy">Allergies: {landingBookingManageTarget.allergies || "—"}</p>
                  </section>

                  <section className="admin-booking-manager__card">
                    <h4>Timeline</h4>
                    <p className="admin-booking-manager__copy">Created: {formatDateLabel(landingBookingManageTarget.createdAt)}</p>
                    <p className="admin-booking-manager__copy">Last updated: {formatDateLabel(landingBookingManageTarget.updatedAt)}</p>
                    <p className="admin-booking-manager__copy">
                      Review: {formatLandingAdminStatus(landingBookingManageAdminStatus || landingBookingManageTarget.adminStatus)}
                    </p>
                    <p className="admin-booking-manager__copy">
                      Selection: {formatLandingSelectionStatus(landingBookingManageSelectionStatus || landingBookingManageTarget.selectionStatus)}
                    </p>
                  </section>
                </div>
              </div>

              <div className="admin-modal__actions admin-modal__actions--booking">
                <button
                  className="admin-toolbar__btn"
                  type="button"
                  onClick={() => closeLandingBookingManager()}
                  disabled={Boolean(selectionStatusSaving[landingBookingManageTarget.id])}
                >
                  Close
                </button>
                <button
                  className="admin-toolbar__btn"
                  type="button"
                  onClick={() => void handleSaveLandingBookingManager()}
                  disabled={
                    Boolean(selectionStatusSaving[landingBookingManageTarget.id]) ||
                    !landingBookingManageSelectionStatus ||
                    !landingBookingManageAdminStatus
                  }
                >
                  {selectionStatusSaving[landingBookingManageTarget.id] ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </article>
          </div>,
          document.body
        )
      : null;

  return (
    <section className="admin-panel admin-dashboard">
      <SeoHead
        title="Admin"
        description="Private admin area."
        noindex
      />
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
                onClick={() => {
                  if (isEngagementUserProfileRoute) {
                    navigate(`/admin?section=${section}`);
                    return;
                  }
                  setActiveSection(section);
                }}
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
            eyebrow={isEngagementUserProfileRoute ? "User Intelligence" : sectionEyebrows[activeSection]}
            title={pageTitle}
            subtitle={pageSubtitle}
            meta={
              <>
                <AdminBadge tone="default">{dashboardDate}</AdminBadge>
                {isEngagementUserProfileRoute && engagementProfile ? (
                  <AdminBadge tone={getBookingToneByStatus(engagementProfile.overview.status)}>
                    {formatEngagementUserStatus(engagementProfile.overview.source, engagementProfile.overview.status)}
                  </AdminBadge>
                ) : null}
              </>
            }
            actions={
              <>
                {isEngagementUserProfileRoute ? (
                  <div className="admin-engagement-profile-header__actions">
                    <AdminButton type="button" variant="ghost" onClick={closeFullEngagementProfile}>
                      Back To Users
                    </AdminButton>
                  </div>
                ) : (
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
                )}
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
                                  <div className="admin-telegram-events__body">
                                    <p className="admin-telegram-events__primary">
                                      {[item.name, item.surname].filter(Boolean).join(" ").trim() || formatTelegramUsername(item.username)}
                                    </p>
                                    <p className="admin-telegram-events__secondary">{item.dinnerTitle}</p>
                                  </div>
                                  <span className="admin-telegram-events__time">{formatDateLabel(item.updatedAt || item.createdAt)}</span>
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
                        onOpenGroup={handleOpenAuditGroup}
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
                        <li style={{ opacity: 0.55, fontSize: "0.85em" }}>
                          Rejected (closed)
                          <b>{telegramApplicationsSummary.rejected}</b>
                        </li>
                        <li style={{ opacity: 0.55, fontSize: "0.85em" }}>
                          Cancelled (closed)
                          <b>{telegramApplicationsSummary.cancelled}</b>
                        </li>
                        <li style={{ opacity: 0.55, fontSize: "0.85em" }}>
                          No-show (closed)
                          <b>{telegramApplicationsSummary.noShow}</b>
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
                          Paid revenue
                          <b>{formatCurrency(telegramStats?.revenueTotal ?? 0)}</b>
                        </li>
                        <li>
                          Paid revenue 24h
                          <b>{formatCurrency(telegramStats?.revenue24h ?? 0)}</b>
                        </li>
                        <li>
                          Paid bookings
                          <b>{paidGuestsCount}</b>
                        </li>
                        <li>
                          Avg paid order value
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
                      ) : (() => {
                        const upcomingDinners = dinners.filter((item) => !item.expired);
                        const shown = upcomingDinners.slice(0, 6);
                        return (
                          <>
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
                                  {shown.map((item) => (
                                    <tr key={`overview-dinner-${item.id}`}>
                                      <td>{item.description}</td>
                                      <td>{formatDateLabel(item.dinnerDate)}</td>
                                      <td colSpan={3}>
                                        <DinnerCapacityInline registered={item.alreadyRegistered} places={item.places} compact />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </AdminTable>
                            {upcomingDinners.length > 6 ? (
                              <p style={{ margin: "6px 0 0", fontSize: "0.78em", opacity: 0.5, textAlign: "right" }}>
                                Showing 6 of {upcomingDinners.length} — view all in Dinners section
                              </p>
                            ) : null}
                          </>
                        );
                      })()}
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
                        onOpenGroup={handleOpenAuditGroup}
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

              {activeSection === "engagement" ? (
                <section className="admin-users-layout">
                  <article className="admin-widget admin-widget--fit">
                    <AdminFilterBar className="admin-users__controls">
                      <div className="admin-users__switch" role="tablist" aria-label="Engagement tabs">
                        {engagementTabOptions.map((tab) => (
                          <button
                            key={tab.value}
                            className={`admin-users__switch-btn ${engagementTab === tab.value ? "admin-users__switch-btn--active" : ""}`}
                            type="button"
                            role="tab"
                            aria-selected={engagementTab === tab.value}
                            onClick={() => setEngagementTab(tab.value)}
                            title={tab.description}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <span className="admin-toolbar__meta">
                        {engagementTab === "analytics"
                          ? "Read behavioral demand, conversion pressure, and funnel friction across Telegram and Landing."
                          : engagementTab === "users"
                            ? "Inspect relationships, activity timelines, and journey quality across channels."
                            : engagementTab === "campaigns"
                              ? "Compose Telegram campaigns with targeting, safety controls, delivery logs, and post-send business outcomes."
                              : engagementTab === "segments"
                                ? "Auto-computed audience segments and actionable business intelligence recommendations."
                                : "Data quality report — verify every metric is backed by correct collection logic."}
                      </span>
                    </AdminFilterBar>
                  </article>

                  {isEngagementUserProfileRoute ? (
                    <section className="admin-engagement-profile-route">
                      <article className="admin-widget admin-widget--fit">
                        <div className="admin-users__controls admin-engagement-profile-route__tabs" role="tablist" aria-label="User profile sections">
                          {engagementProfileTabs.map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              role="tab"
                              aria-selected={engagementProfileTab === tab.key}
                              className={`admin-users__switch-btn ${engagementProfileTab === tab.key ? "admin-users__switch-btn--active" : ""}`}
                              onClick={() => setEngagementProfileTab(tab.key)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        {engagementProfileError ? <p className="admin-auth__error">{engagementProfileError}</p> : null}
                        {engagementProfileLoading && !engagementProfile ? <p className="admin-dashboard__state">Loading full user profile...</p> : null}
                        {!engagementProfileLoading && !engagementProfile ? (
                          <AdminEmptyState
                            compact
                            title="User profile not available"
                            description="This guest profile could not be loaded. Try going back to Users and reopening it."
                          />
                        ) : null}
                        {engagementProfile ? (
                          <div className="admin-engagement-profile">
                            <section className="admin-engagement-crm-header">
                              <div className="admin-engagement-crm-header__identity">
                                <div className="admin-engagement-crm-header__title-row">
                                  <p className="admin-modal__eyebrow">{engagementProfile.overview.source === "telegram" ? "Telegram Guest Intelligence" : "Landing Guest Intelligence"}</p>
                                  <div className="admin-booking-manager__summary">
                                    <AdminBadge tone={getBookingToneByStatus(engagementProfile.overview.status)}>
                                      {formatEngagementUserStatus(engagementProfile.overview.source, engagementProfile.overview.status)}
                                    </AdminBadge>
                                    <AdminBadge tone={getEngagementScoreTone(engagementProfileScoreBreakdown?.healthScore ?? 0)}>
                                      Health {engagementProfileScoreBreakdown?.healthScore ?? 0}
                                    </AdminBadge>
                                  </div>
                                </div>
                                <h3>{engagementProfile.overview.name}</h3>
                                <div className="admin-engagement-crm-header__contact-line">
                                  <span>{engagementProfile.overview.username ? formatTelegramUsername(engagementProfile.overview.username) : "No username"}</span>
                                  <span>{engagementProfile.overview.phone || "No phone"}</span>
                                  <span>{engagementProfile.overview.language || "No language"}</span>
                                </div>
                                <div className="admin-engagement-crm-header__chips">
                                  <span className="admin-engagement-crm-header__chip">
                                    <strong>{engagementProfile.overview.source === "telegram" ? "Telegram ID" : "Profile ID"}</strong>
                                    <span>{engagementProfile.overview.id}</span>
                                  </span>
                                  <span className="admin-engagement-crm-header__chip">
                                    <strong>Referral Code</strong>
                                    <span>{engagementProfile.referral.referralCode || "—"}</span>
                                  </span>
                                  <span className="admin-engagement-crm-header__chip">
                                    <strong>First Seen</strong>
                                    <span>{formatDateLabel(engagementProfile.overview.firstSeenAt || engagementProfile.overview.createdAt)}</span>
                                  </span>
                                  <span className="admin-engagement-crm-header__chip">
                                    <strong>Last Activity</strong>
                                    <span>{formatDateLabel(engagementProfile.overview.lastActivityAt || engagementProfile.overview.createdAt)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="admin-engagement-crm-header__actions">
                                <div className="admin-engagement-crm-header__copy-grid">
                                  <button type="button" className="admin-engagement-copy-button" onClick={() => void handleCopyCrmField(engagementProfile.overview.source === "telegram" ? "Telegram ID" : "Profile ID", engagementProfile.overview.id)}>
                                    Copy ID
                                  </button>
                                  <button type="button" className="admin-engagement-copy-button" onClick={() => void handleCopyCrmField("Username", engagementProfile.overview.username ? formatTelegramUsername(engagementProfile.overview.username) : "")} disabled={!engagementProfile.overview.username}>
                                    Copy Username
                                  </button>
                                  <button type="button" className="admin-engagement-copy-button" onClick={() => void handleCopyCrmField("Phone", engagementProfile.overview.phone)} disabled={!engagementProfile.overview.phone}>
                                    Copy Phone
                                  </button>
                                  <button type="button" className="admin-engagement-copy-button" onClick={() => void handleCopyCrmField("Referral code", engagementProfile.referral.referralCode)} disabled={!engagementProfile.referral.referralCode}>
                                    Copy Referral
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-engagement-copy-button"
                                    onClick={() => {
                                      if (!engagementProfile.overview.username) return;
                                      window.open(`https://t.me/${engagementProfile.overview.username}`, "_blank", "noopener,noreferrer");
                                    }}
                                    disabled={!engagementProfile.overview.username}
                                  >
                                    Open Telegram
                                  </button>
                                </div>
                                <div className="admin-engagement-crm-header__health">
                                  <span>Guest Health Score</span>
                                  <strong>{engagementProfileScoreBreakdown?.healthScore ?? 0}</strong>
                                  <p>{engagementProfile.overview.engagementReason}</p>
                                  {crmCopyFeedback ? <em>{crmCopyFeedback}</em> : null}
                                </div>
                              </div>
                              <div className="admin-engagement-crm-header__stats">
                                {[
                                  { label: "Applications", value: `${engagementProfile.overview.applications}` },
                                  { label: "Paid Bookings", value: `${engagementProfile.overview.paidBookings}` },
                                  { label: "Attendance", value: `${engagementProfile.overview.attendanceCount}` },
                                  { label: "Total Spend", value: formatCurrency(engagementProfile.overview.payments) },
                                  { label: "Referral Count", value: `${engagementProfile.overview.referrals}` },
                                  { label: "Account Age", value: formatAccountAgeLabel(engagementProfile.overview.firstSeenAt || engagementProfile.overview.createdAt) },
                                ].map((item) => (
                                  <article key={item.label} className="admin-engagement-crm-stat">
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                  </article>
                                ))}
                              </div>
                            </section>

                            {engagementProfileTab === "overview" ? (
                              <section className="admin-engagement-profile__priority-grid">
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--identity admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Identity & Contact</h2>
                                    <span>Critical identity fields and support shortcuts</span>
                                  </div>
                                  <div className="admin-engagement-detail-grid">
                                    {[
                                      { label: engagementProfile.overview.source === "telegram" ? "Telegram ID" : "Profile ID", value: engagementProfile.overview.id, copyable: true },
                                      { label: "Username", value: engagementProfile.overview.username ? formatTelegramUsername(engagementProfile.overview.username) : "—", copyable: Boolean(engagementProfile.overview.username) },
                                      { label: "Full Name", value: engagementProfile.overview.name || "—", copyable: Boolean(engagementProfile.overview.name) },
                                      { label: "Phone", value: engagementProfile.overview.phone || "—", copyable: Boolean(engagementProfile.overview.phone) },
                                      { label: "Language", value: engagementProfile.overview.language || "—" },
                                      { label: "Referral Code", value: engagementProfile.referral.referralCode || "—", copyable: Boolean(engagementProfile.referral.referralCode) },
                                      { label: "First Seen", value: formatDateLabel(engagementProfile.overview.firstSeenAt || engagementProfile.overview.createdAt) },
                                      { label: "Last Seen", value: formatDateLabel(engagementProfile.behavioral.lastSeenAt || engagementProfile.overview.lastActivityAt || engagementProfile.overview.createdAt) },
                                      { label: "Account Age", value: formatAccountAgeLabel(engagementProfile.overview.firstSeenAt || engagementProfile.overview.createdAt) },
                                      { label: "Legal", value: engagementProfile.overview.termsAccepted ? `Accepted${engagementProfile.overview.legalVersion ? ` · ${engagementProfile.overview.legalVersion}` : ""}` : "Not accepted" },
                                    ].map((field) => (
                                      <article key={field.label} className="admin-engagement-detail-row">
                                        <div>
                                          <span>{field.label}</span>
                                          <strong>{field.value}</strong>
                                        </div>
                                        {field.copyable ? <button type="button" className="admin-engagement-inline-copy" onClick={() => void handleCopyCrmField(field.label, field.value)}>Copy</button> : null}
                                      </article>
                                    ))}
                                  </div>
                                </article>
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementJourneyCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Overview</h2>
                                    <span>Business performance snapshot</span>
                                  </div>
                                  <div className="admin-engagement-kpi-grid">
                                    {[
                                      { label: "Applications", value: `${engagementProfile.overview.applications}`, hint: `${engagementProfile.behavioral.applicationsSent} submitted events tracked` },
                                      { label: "Approved", value: engagementProfileJourneyStages.find((item) => item.key === "approved")?.completed ? "Yes" : "No", hint: "Current progression checkpoint" },
                                      { label: "Paid", value: `${engagementProfile.overview.paidBookings}`, hint: formatCurrency(engagementProfile.revenue.totalPayments) },
                                      { label: "Attended", value: `${engagementProfile.attendance.attendanceCount}`, hint: engagementProfile.attendance.attendanceQuality },
                                      { label: "No-shows", value: `${engagementProfile.attendance.noShowCount}`, hint: "Reliability signal" },
                                      { label: "Avg booking", value: formatCurrency(engagementProfile.revenue.averageBooking), hint: "Average paid booking value" },
                                    ].map((item) => (
                                      <article key={item.label} className="admin-engagement-kpi-tile">
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                        <small>{item.hint}</small>
                                      </article>
                                    ))}
                                  </div>
                                </article>
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementHealthCardTone(engagementProfileScoreBreakdown?.healthScore ?? 0))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Guest Health</h2>
                                    <span>How healthy and valuable this relationship looks</span>
                                  </div>
                                  <div className="admin-engagement-score-panel">
                                    <div className="admin-engagement-score-panel__hero">
                                      <strong>{engagementProfileScoreBreakdown?.healthScore ?? 0}</strong>
                                      <span>Overall health</span>
                                    </div>
                                    <div className="admin-engagement-score-panel__bars">
                                      {engagementProfileScoreBreakdown?.items.map((item) => (
                                        <article key={item.key} className="admin-engagement-score-bar">
                                          <div className="admin-engagement-score-bar__head">
                                            <span>{item.label}</span>
                                            <strong>{Math.round(item.value)}/100</strong>
                                          </div>
                                          <div className="admin-engagement-score-bar__track">
                                            <span style={{ width: `${Math.max(item.value, 4)}%` }} />
                                          </div>
                                          <small>{item.hint}</small>
                                        </article>
                                      ))}
                                    </div>
                                  </div>
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "journey" ? (
                              <section className="admin-engagement-profile__main-grid">
                                <article className={`admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--journey ${getEngagementCardToneClass(getEngagementJourneyCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Guest Journey</h2>
                                    <span>How guests move from interest to attendance</span>
                                  </div>
                                  <div className="admin-engagement-journey-flow">
                                    {engagementProfileJourneyStages.map((item) => (
                                      <article key={item.key} className={`admin-engagement-journey-step ${item.completed ? "admin-engagement-journey-step--done" : ""}`}>
                                        <div className="admin-engagement-journey-step__index"><span>{item.label.slice(0, 1)}</span></div>
                                        <div className="admin-engagement-journey-step__copy">
                                          <div className="admin-engagement-journey-step__head">
                                            <strong>{item.label}</strong>
                                            <AdminBadge tone={item.completed ? "emerald" : "default"}>{item.completed ? "Completed" : "Waiting"}</AdminBadge>
                                          </div>
                                          <span>{item.detail}</span>
                                          <div className="admin-engagement-journey-step__meta">
                                            <b>{item.occurredAt ? formatDateLabel(item.occurredAt) : "No timestamp yet"}</b>
                                            <span>{item.delayLabel}</span>
                                            {item.inferred ? <em>Inferred from later activity</em> : null}
                                          </div>
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </article>
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Dinner Interest</h2>
                                    <span>Viewed dinners, applied dinners, and strongest preference signals</span>
                                  </div>
                                  {engagementProfile.dinnerInterest.length > 0 ? (
                                    <div className="admin-engagement-interest-list">
                                      {engagementProfile.dinnerInterest.slice().sort((a, b) => b.viewCount - a.viewCount).map((item, _index, list) => {
                                        const maxViews = Math.max(...list.map((row) => row.viewCount), 1);
                                        return (
                                          <article key={item.dinnerId} className="admin-engagement-interest-item">
                                            <div className="admin-engagement-interest-item__head">
                                              <strong>{item.dinnerName}</strong>
                                              <span>{item.viewCount} views{item.applied ? " · applied" : ""}</span>
                                            </div>
                                            <div className="admin-engagement-interest-item__track">
                                              <span style={{ width: `${Math.max(clampPercent((item.viewCount / maxViews) * 100), 6)}%` }} />
                                            </div>
                                            <small>Last touched {formatDateLabel(item.lastViewAt)}</small>
                                          </article>
                                        );
                                      })}
                                    </div>
                                  ) : <AdminEmptyState compact title="No dinner interest tracked" description="Dinner interest will appear here once the guest browses or applies." />}
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "activity" ? (
                              <section className="admin-engagement-profile__secondary-grid">
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Activity Heatmap</h2>
                                    <span>Active days and session density</span>
                                  </div>
                                  <div className="admin-engagement-heatmap">
                                    {engagementProfileHeatmapWeeks.map((week) => (
                                      <div key={week.key} className="admin-engagement-heatmap__week">
                                        {week.cells.map((cell) => (
                                          <span key={cell.key} className={`admin-engagement-heatmap__cell admin-engagement-heatmap__cell--${cell.intensity}`} title={cell.fullLabel} />
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="admin-engagement-heatmap__legend">
                                    <span>Less active</span>
                                    <div>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`admin-engagement-heatmap__cell admin-engagement-heatmap__cell--${level}`} />)}</div>
                                    <span>More active</span>
                                  </div>
                                </article>
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Hourly Activity</h2>
                                    <span>When this guest engages most</span>
                                  </div>
                                  <div className="admin-engagement-hour-bars">
                                    {engagementProfileHourActivity.bars.length > 0 ? engagementProfileHourActivity.bars.map((item) => (
                                      <article key={item.key} className="admin-engagement-hour-bar">
                                        <div className="admin-engagement-hour-bar__head">
                                          <span>{item.label}</span>
                                          <strong>{item.value}</strong>
                                        </div>
                                        <div className="admin-engagement-hour-bar__track"><span style={{ width: `${Math.max(item.percent, 8)}%` }} /></div>
                                      </article>
                                    )) : <AdminEmptyState compact title="No hourly pattern yet" description="More tracked activity is needed before hourly behavior becomes readable." />}
                                  </div>
                                </article>
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Daily Activity</h2>
                                    <span>Recent activity volume by day</span>
                                  </div>
                                  <div className="admin-engagement-interest-list">
                                    {engagementDailyActivity.map((item) => (
                                      <article key={item.key} className="admin-engagement-interest-item">
                                        <div className="admin-engagement-interest-item__head">
                                          <strong>{item.label}</strong>
                                          <span>{item.value} events</span>
                                        </div>
                                        <div className="admin-engagement-interest-item__track"><span style={{ width: `${Math.max(item.percent, 6)}%` }} /></div>
                                      </article>
                                    ))}
                                  </div>
                                </article>
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Button Clicks</h2>
                                    <span>Most repeated interaction patterns</span>
                                  </div>
                                  <div className="admin-engagement-interest-list">
                                    {engagementButtonClickRows.length > 0 ? engagementButtonClickRows.map((item) => (
                                      <article key={item.label} className="admin-engagement-interest-item">
                                        <div className="admin-engagement-interest-item__head">
                                          <strong>{item.label}</strong>
                                          <span>{item.value} clicks</span>
                                        </div>
                                        <div className="admin-engagement-interest-item__track"><span style={{ width: `${Math.max(item.percent, 6)}%` }} /></div>
                                      </article>
                                    )) : <AdminEmptyState compact title="No click clusters yet" description="Button click patterns will appear when enough interactive actions are captured." />}
                                  </div>
                                </article>
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementReferralCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Package Interest</h2>
                                    <span>Observed package-related interactions</span>
                                  </div>
                                  <div className="admin-engagement-interest-list">
                                    {engagementPackageInterestRows.length > 0 ? engagementPackageInterestRows.map((item) => (
                                      <article key={item.label} className="admin-engagement-interest-item">
                                        <div className="admin-engagement-interest-item__head">
                                          <strong>{item.label}</strong>
                                          <span>{item.value} interactions</span>
                                        </div>
                                        <div className="admin-engagement-interest-item__track"><span style={{ width: `${Math.max(item.percent, 6)}%` }} /></div>
                                      </article>
                                    )) : <AdminEmptyState compact title="No package pattern yet" description="Package intent needs more interactions before it can be charted." />}
                                  </div>
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "referrals" ? (
                              <section className="admin-engagement-profile__secondary-grid">
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementReferralCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Referral Analytics</h2>
                                    <span>Invitation performance and network value</span>
                                  </div>
                                  <div className="admin-engagement-kpi-grid admin-engagement-kpi-grid--compact">
                                    {[
                                      { label: "Invited Users", value: `${engagementProfile.referral.invitedUsers}` },
                                      { label: "Referral Events", value: `${engagementProfile.referral.referralEvents}` },
                                      { label: "Referral Clicks", value: `${engagementProfile.referral.referralClicks}` },
                                      { label: "Successful Referrals", value: `${engagementProfile.referral.referralSuccesses}` },
                                    ].map((item) => (
                                      <article key={item.label} className="admin-engagement-kpi-tile">
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                      </article>
                                    ))}
                                  </div>
                                  <ul className="admin-metric-list">
                                    <li><span>Referral code</span><b>{engagementProfile.referral.referralCode || "—"}</b></li>
                                    <li><span>Used referral</span><b>{engagementProfile.referral.usedReferralCode || "—"}</b></li>
                                    <li><span>Referral score</span><b>{engagementProfile.referralScore}/100</b></li>
                                  </ul>
                                </article>
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementRevenueCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Referral Network</h2>
                                    <span>Simple performance ladder for this guest’s network effect</span>
                                  </div>
                                  <div className="admin-engagement-interest-list">
                                    {engagementReferralNetworkRows.map((item) => (
                                      <article key={item.label} className="admin-engagement-interest-item">
                                        <div className="admin-engagement-interest-item__head">
                                          <strong>{item.label}</strong>
                                          <span>{item.value}</span>
                                        </div>
                                        <div className="admin-engagement-interest-item__track"><span style={{ width: `${Math.max(item.percent, 6)}%` }} /></div>
                                      </article>
                                    ))}
                                  </div>
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "revenue" ? (
                              !engagementProfile.revenue.tracked && !engagementProfile.attendance.tracked ? (
                                <section className="admin-engagement-profile__secondary-grid">
                                  <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info" style={{ gridColumn: "1 / -1" }}>
                                    <div className="admin-widget__header">
                                      <h2>Revenue &amp; Attendance</h2>
                                      <span>Not available for this guest</span>
                                    </div>
                                    <AdminEmptyState
                                      title="Revenue and attendance are not tracked for Landing users"
                                      description="Payment and attendance data is only available for Telegram guests who have completed a booking. This guest was sourced from the landing form and has no associated payment or event records."
                                    />
                                  </article>
                                </section>
                              ) : (
                                <section className="admin-engagement-profile__secondary-grid">
                                  <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementRevenueCardTone(engagementProfile))}`}>
                                    <div className="admin-widget__header">
                                      <h2>Revenue Analytics</h2>
                                      <span>Commercial value, booking outcomes, and payment depth</span>
                                    </div>
                                    <div className="admin-engagement-dual-metrics">
                                      <article className="admin-engagement-dual-metrics__card">
                                        <span>Lifetime value</span>
                                        <strong>{formatCurrency(engagementProfile.revenue.totalPayments)}</strong>
                                        <small>{engagementProfile.revenue.paidBookings} paid bookings · latest {formatDateLabel(engagementProfile.revenue.latestPaymentAt)}</small>
                                      </article>
                                      <article className="admin-engagement-dual-metrics__card">
                                        <span>Attendance rate</span>
                                        <strong>
                                          {engagementProfile.attendance.attendanceCount + engagementProfile.attendance.noShowCount > 0
                                            ? `${Math.round((engagementProfile.attendance.attendanceCount / (engagementProfile.attendance.attendanceCount + engagementProfile.attendance.noShowCount)) * 100)}%`
                                            : "—"}
                                        </strong>
                                        <small>{engagementProfile.attendance.attendanceCount} attended · {engagementProfile.attendance.noShowCount} no-shows</small>
                                      </article>
                                    </div>
                                    <ul className="admin-metric-list">
                                      <li><span>Average booking value</span><b>{formatCurrency(engagementProfile.revenue.averageBooking)}</b></li>
                                      <li><span>Cancelled bookings</span><b>{engagementProfile.revenue.cancelledBookings}</b></li>
                                      <li><span>Paid bookings</span><b>{engagementProfile.revenue.paidBookings}</b></li>
                                    </ul>
                                  </article>
                                  <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementAttendanceCardTone(engagementProfile))}`}>
                                    <div className="admin-widget__header">
                                      <h2>Attendance Analytics</h2>
                                      <span>Reliability, no-show patterns, and attendance quality</span>
                                    </div>
                                    <ul className="admin-metric-list">
                                      <li><span>Attendance count</span><b>{engagementProfile.attendance.attendanceCount}</b></li>
                                      <li><span>No-show count</span><b>{engagementProfile.attendance.noShowCount}</b></li>
                                      <li><span>Last attendance</span><b>{formatDateLabel(engagementProfile.attendance.lastAttendance)}</b></li>
                                      <li><span>Reliability</span><b>{engagementProfile.attendance.attendanceQuality}</b></li>
                                      <li><span>Loyalty score</span><b>{engagementProfile.loyaltyScore}/100</b></li>
                                    </ul>
                                  </article>
                                </section>
                              )
                            ) : null}

                            {engagementProfileTab === "notes" ? (
                              <section className="admin-engagement-profile__workspace-grid">
                                <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--info">
                                  <div className="admin-widget__header">
                                    <h2>Admin Tags</h2>
                                    <span>Searchable tags for workflow and segmentation</span>
                                  </div>
                                  <input type="text" className="admin-crm-tag-input" placeholder="Search preset tags..." value={crmTagSearch} onChange={(event) => setCrmTagSearch(event.target.value)} />
                                  <div className="admin-crm-tags">
                                    {(engagementProfile.tags ?? []).map((item) => (
                                      <span key={item.tag} className="admin-crm-tag">
                                        {item.tag}
                                        <button type="button" className="admin-crm-tag__remove" onClick={() => void handleRemoveCrmTag(item.tag)} aria-label={`Remove tag ${item.tag}`}>×</button>
                                      </span>
                                    ))}
                                    {(engagementProfile.tags ?? []).length === 0 && <span className="admin-crm-tags__empty">No tags yet</span>}
                                  </div>
                                  <div className="admin-crm-tags__presets">
                                    {filteredCrmPresets.map((preset) => {
                                      const hasTag = (engagementProfile.tags ?? []).some((t) => t.tag === preset);
                                      return (
                                        <button
                                          key={preset}
                                          type="button"
                                          className={`admin-crm-preset-tag ${hasTag ? "admin-crm-preset-tag--active" : ""}`}
                                          onClick={() => {
                                            if (hasTag) { void handleRemoveCrmTag(preset); return; }
                                            if (!engagementProfile || crmTagSaving) return;
                                            setCrmTagSaving(true);
                                            setCrmTagError("");
                                            addUserTag(engagementProfile.overview.source, engagementProfile.overview.id, preset)
                                              .then((tags) => setEngagementProfile((prev) => prev ? { ...prev, tags } : prev))
                                              .catch((err) => setCrmTagError(err instanceof Error ? err.message : "failed to add tag"))
                                              .finally(() => setCrmTagSaving(false));
                                          }}
                                          disabled={crmTagSaving}
                                        >
                                          {preset.replace(/_/g, " ")}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="admin-crm-tags__add">
                                    <input type="text" className="admin-crm-tag-input" placeholder="Custom tag..." value={crmTagInput} onChange={(e) => setCrmTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleAddCrmTag(); }} maxLength={60} />
                                    <AdminButton type="button" variant="secondary" onClick={() => void handleAddCrmTag()} disabled={!crmTagInput.trim() || crmTagSaving}>Add</AdminButton>
                                  </div>
                                  {crmTagError ? <p className="admin-auth__error">{crmTagError}</p> : null}
                                </article>
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementCampaignCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Internal Notes</h2>
                                    <span>Newest notes first with author and audit context</span>
                                  </div>
                                  <div className="admin-crm-notes">
                                    {(engagementProfile.notes ?? []).map((note) => (
                                      <article key={note.id} className="admin-crm-note">
                                        <div className="admin-crm-note__head">
                                          <strong>{note.createdBy || "Admin"}</strong>
                                          <span>{formatDateLabel(note.createdAt)}</span>
                                          <button type="button" className="admin-crm-note__delete" onClick={() => void handleDeleteCrmNote(note.id)} aria-label="Delete note">Delete</button>
                                        </div>
                                        <p>{note.noteText}</p>
                                      </article>
                                    ))}
                                    {(engagementProfile.notes ?? []).length === 0 && <AdminEmptyState compact title="No notes yet" description="Add the first internal note about this guest." />}
                                  </div>
                                  <div className="admin-crm-notes__add">
                                    <textarea className="admin-crm-note-input" placeholder="Write an internal note..." value={crmNoteInput} onChange={(e) => setCrmNoteInput(e.target.value)} rows={4} maxLength={2000} />
                                    <AdminButton type="button" variant="secondary" onClick={() => void handleAddCrmNote()} disabled={!crmNoteInput.trim() || crmNoteSaving}>{crmNoteSaving ? "Saving..." : "Add Note"}</AdminButton>
                                  </div>
                                  {crmNoteError ? <p className="admin-auth__error">{crmNoteError}</p> : null}
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "campaigns" ? (
                              <section className="admin-info-grid admin-info-grid--single">
                                <article className={`admin-widget admin-widget--fit admin-engagement-card ${getEngagementCardToneClass(getEngagementCampaignCardTone(engagementProfile))}`}>
                                  <div className="admin-widget__header">
                                    <h2>Campaign Interactions</h2>
                                    <span>Polls, quizzes, ratings, and other stored campaign responses</span>
                                  </div>
                                  {engagementProfile.campaignResponses.length > 0 ? (
                                    <ul className="admin-metric-list">
                                      {engagementProfile.campaignResponses.map((resp, idx) => (
                                        <li key={idx}>
                                          <span>
                                            <b>{resp.campaignTitle}</b>
                                            {resp.question ? <> · {resp.question}</> : null}
                                            {resp.choiceLabel ? <> → {resp.choiceLabel}</> : null}
                                            {resp.messageType === "quiz" ? (
                                              <AdminBadge tone={getCampaignResponseTone(resp.correct, resp.messageType)}>{resp.correct ? "Correct" : "Wrong"}</AdminBadge>
                                            ) : null}
                                          </span>
                                          <b><AdminBadge tone="default">{resp.messageType}</AdminBadge></b>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : <AdminEmptyState compact title="No campaign interactions yet" description="This guest has not responded to tracked campaigns yet." />}
                                </article>
                              </section>
                            ) : null}

                            {engagementProfileTab === "events" ? (
                              <article className="admin-widget admin-widget--fit admin-engagement-card admin-engagement-card--timeline admin-engagement-card--info">
                                <div className="admin-widget__header">
                                  <h2>Raw Events</h2>
                                  <span>Paginated, searchable raw event feed for verification and support</span>
                                </div>
                                <div className="admin-engagement-timeline__toolbar">
                                  <div className="admin-topbar__search admin-engagement-users__search">
                                    <span aria-hidden="true">⌕</span>
                                    <input type="search" value={engagementTimelineSearch} onChange={(event) => setEngagementTimelineSearch(event.target.value)} placeholder="Search event name or detail" />
                                  </div>
                                  <label className="admin-engagement-timeline__page-size">
                                    <span>Page size</span>
                                    <select value={engagementTimelinePageSize} onChange={(event) => setEngagementTimelinePageSize(Number(event.target.value))}>
                                      {[20, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                                    </select>
                                  </label>
                                  <div className="admin-engagement-timeline__meta">
                                    <span>{engagementProfile.eventsPage?.total ?? 0} total events</span>
                                    <span>{engagementVisibleTimeline.length} loaded</span>
                                    <span>Page {engagementTimelineCurrentPage} of {engagementTimelineTotalPages}</span>
                                  </div>
                                </div>
                                {engagementVisibleTimeline.length > 0 ? (
                                  <div className="admin-engagement-profile__timeline">
                                    {engagementVisibleTimeline.map((item) => (
                                      <article key={item.key} className="admin-engagement-timeline__item">
                                        <div className="admin-engagement-timeline__head">
                                          <div className="admin-engagement-timeline__title">
                                            <strong>{item.title}</strong>
                                            {item.itemCount > 1 ? <AdminBadge tone="gold">{item.itemCount} grouped</AdminBadge> : null}
                                            <AdminBadge tone="default">{engagementProfile.overview.source === "telegram" ? "Telegram" : "Landing"}</AdminBadge>
                                          </div>
                                          <AdminBadge tone={getTimelineToneBadge(item.tone)}>{formatDateLabel(item.occurredAt)}</AdminBadge>
                                        </div>
                                        <p>{item.description}</p>
                                      </article>
                                    ))}
                                  </div>
                                ) : <AdminEmptyState compact title="No raw events yet" description="Once tracked events land for this guest, the feed will appear here." />}
                                <div className="admin-engagement-timeline__pagination">
                                  <AdminButton type="button" variant="ghost" onClick={() => setEngagementTimelinePage((previous) => Math.max(1, previous - 1))} disabled={engagementTimelineCurrentPage <= 1 || engagementProfileLoading}>Previous</AdminButton>
                                  <AdminButton type="button" variant="ghost" onClick={() => setEngagementTimelinePage((previous) => Math.min(engagementTimelineTotalPages, previous + 1))} disabled={engagementTimelineCurrentPage >= engagementTimelineTotalPages || engagementProfileLoading}>Next</AdminButton>
                                </div>
                              </article>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    </section>
                  ) : engagementTab === "analytics" ? (
                    <>
                      <article className="admin-widget admin-widget--fit admin-engagement__filters-card">
                        <AdminFilterBar className="admin-users__controls admin-engagement__filters">
                          <TextField
                            label="Start date"
                            type="date"
                            value={engagementFilters.startDate}
                            onChange={(event) => setEngagementFilters((prev) => ({ ...prev, startDate: event.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            className="admin-engagement__field"
                            sx={engagementFieldSx}
                          />
                          <TextField
                            label="End date"
                            type="date"
                            value={engagementFilters.endDate}
                            onChange={(event) => setEngagementFilters((prev) => ({ ...prev, endDate: event.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            className="admin-engagement__field"
                            sx={engagementFieldSx}
                          />
                          <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                            <Select
                              value={engagementFilters.source}
                              onChange={(event) => setEngagementFilters((prev) => ({ ...prev, source: event.target.value as EngagementFilterState["source"] }))}
                              displayEmpty
                            >
                              {engagementSourceOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                            <Select
                              value={engagementFilters.dinnerId}
                              onChange={(event) => setEngagementFilters((prev) => ({ ...prev, dinnerId: event.target.value }))}
                              displayEmpty
                            >
                              <MenuItem value="all">All dinners</MenuItem>
                              {(engagementAnalytics?.filterOptions.dinners ?? []).map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                            <Select
                              value={engagementFilters.package}
                              onChange={(event) => setEngagementFilters((prev) => ({ ...prev, package: event.target.value }))}
                              displayEmpty
                            >
                              <MenuItem value="all">All packages</MenuItem>
                              {(engagementAnalytics?.filterOptions.packages ?? []).map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </AdminFilterBar>
                        <div className="admin-engagement__filter-meta">
                          <div className="admin-engagement__filter-copy">
                            <strong>Analytics scope</strong>
                            <span>Filter by time, source, dinner, or package to isolate demand and conversion patterns.</span>
                          </div>
                          <div className="admin-engagement__filter-chips" aria-label="Active engagement filters">
                            {engagementFilterChips.map((chip) => (
                              <span key={chip} className="admin-engagement__filter-chip" title={chip}>
                                {chip}
                              </span>
                            ))}
                          </div>
                        </div>
                        {engagementError ? <p className="admin-auth__error">{engagementError}</p> : null}
                      </article>

                      {engagementLoading && !engagementAnalytics ? (
                        <p className="admin-dashboard__state">Loading engagement analytics...</p>
                      ) : null}

                      {!engagementLoading && !engagementAnalytics ? (
                        <AdminEmptyState
                          title="No engagement analytics yet"
                          description="Start tracking more visitor and bot activity to unlock dinner demand, package intent, button behavior, and funnel conversion insights."
                        />
                      ) : null}

                      {engagementAnalytics ? (
                        <>
                          {engagementKpiCards.length > 0 ? (
                            <section className="admin-engagement__summary-grid">
                              {engagementKpiCards.map((card) => (
                                <article key={card.key} className="admin-engagement__summary-card admin-engagement-kpi">
                                  <div className="admin-engagement-kpi__top">
                                    <span className="admin-engagement__summary-label">{card.label}</span>
                                    <span className={`admin-engagement-kpi__trend admin-engagement-kpi__trend--${card.trend.tone}`}>
                                      {card.trend.text}
                                    </span>
                                  </div>
                                  <strong className="admin-engagement-kpi__value">{card.value}</strong>
                                  <span className="admin-engagement-kpi__note">{card.note}</span>
                                  <CustomMiniSparkline
                                    values={card.sparkline}
                                    color={card.trend.tone === "danger" ? "#b45d5d" : card.trend.tone === "emerald" ? "#4c9f87" : "#c9a34a"}
                                  />
                                </article>
                              ))}
                            </section>
                          ) : null}

                          <section className="admin-engagement-grid">
                            <article className="admin-widget admin-engagement-chart admin-engagement-chart--source">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Source Mix</p>
                                  <h2>Telegram vs Landing</h2>
                                </div>
                                <span>{formatCompactNumber(sourceUsersTotal)} tracked users</span>
                              </div>
                              <div className="admin-engagement-chart__frame admin-engagement-chart__frame--compact">
                                {sourcePerformance.length > 0 ? (
                                  <div className="admin-engagement-source">
                                    <CustomStackedSourceBar
                                      items={sourcePerformance.map((item) => ({
                                        key: item.key,
                                        label: item.label,
                                        value: item.users,
                                        color: item.key === "telegram" ? "#4c9f87" : "#c9a34a",
                                      }))}
                                    />
                                    <div className="admin-engagement-source__stats">
                                      {sourcePerformance.map((item) => (
                                        <article key={item.key} className="admin-engagement-source__card">
                                          <div className="admin-engagement-source__title-row">
                                            <span className="admin-engagement-source__title">{item.label}</span>
                                            <span className={`admin-badge ${item.key === "telegram" ? "admin-badge--emerald" : "admin-badge--gold"}`}>
                                              {sourceUsersTotal > 0 ? `${Math.round((item.users / sourceUsersTotal) * 100)}% share` : "0% share"}
                                            </span>
                                          </div>
                                          <div className="admin-engagement-source__metrics">
                                            <div><span>Users</span><strong>{formatCompactNumber(item.users)}</strong></div>
                                            <div><span>Applications</span><strong>{formatCompactNumber(item.applications)}</strong></div>
                                            <div><span>Payments</span><strong>{formatCompactNumber(item.paidUsers)}</strong></div>
                                            <div>
                                              <span title={item.conversionBase}>Conversion</span>
                                              <strong title={item.conversionBase}>{item.conversionRate.toFixed(1)}%</strong>
                                            </div>
                                          </div>
                                        </article>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <AdminEmptyState compact title="Not enough data yet" description="Tracking is working, but this slice needs more users before source performance becomes useful." />
                                )}
                              </div>
                            </article>

                            <article className="admin-widget admin-engagement-chart">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Timing</p>
                                  <h2>Peak Hours</h2>
                                </div>
                                <span>{bestEngagementHour ? `Best hour: ${bestEngagementHour.label}` : "Hourly engagement density"}</span>
                              </div>
                              <div className="admin-engagement-chart__frame">
                                {hourlyActivity.length >= 3 && hourlyActivity.reduce((sum, item) => sum + item.events, 0) >= 6 ? (
                                  <div className="admin-engagement-peak">
                                    <CustomGroupedHistogram
                                      points={hourlyActivity.map((item) => ({
                                        key: item.key,
                                        label: item.label,
                                        firstValue: item.events,
                                        secondValue: item.activeUsers,
                                      }))}
                                      firstLabel="Events"
                                      secondLabel="Active Users"
                                      firstColor="#c9a34a"
                                      secondColor="#4c9f87"
                                    />
                                    {bestEngagementHour ? (
                                      <div className="admin-engagement-peak__summary">
                                        <span className="admin-badge admin-badge--gold">Best hour</span>
                                        <strong>{bestEngagementHour.label}</strong>
                                        <span>{formatCompactNumber(bestEngagementHour.events)} events and {formatCompactNumber(bestEngagementHour.activeUsers)} active users</span>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <AdminEmptyState compact title="Not enough activity data yet" description="Tracking is working. This view needs more hourly event volume before a histogram becomes reliable." />
                                )}
                              </div>
                            </article>

                            <article className="admin-widget admin-engagement-chart">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Demand</p>
                                  <h2>Most Viewed Dinners</h2>
                                </div>
                                <span>Views, applications, and conversion by dinner</span>
                              </div>
                              <div className="admin-engagement-chart__frame">
                                {dinnerPerformance.length > 0 ? (
                                  <div className="admin-engagement-list">
                                    {dinnerPerformance.map((item) => (
                                      <article key={item.key} className="admin-engagement-list__row">
                                        <div className="admin-engagement-list__main">
                                          <strong title={item.label}>{item.label}</strong>
                                          <div className="admin-engagement-list__meta">
                                            <span>{formatCompactNumber(item.views)} views</span>
                                            <span>{formatCompactNumber(item.applications)} applications</span>
                                            <span>{item.conversionRate.toFixed(1)}% conversion</span>
                                          </div>
                                        </div>
                                        <div className="admin-engagement-list__progress">
                                          <span style={{ width: `${Math.max(item.conversionRate, 4)}%` }} />
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                ) : (
                                  <AdminEmptyState compact title="Not enough data yet" description="Need more dinner views before this page can rank demand and conversion by dinner." />
                                )}
                              </div>
                            </article>

                            <article className="admin-widget admin-engagement-chart">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Intent</p>
                                  <h2>Most Selected Packages</h2>
                                </div>
                                <span>Package share across the selected audience</span>
                              </div>
                              <div className="admin-engagement-chart__frame">
                                {packageSelections.length > 0 ? (
                                  <div className="admin-engagement-list">
                                    {packageSelections.map((item) => {
                                      const totalSelections = packageSelections.reduce((sum, entry) => sum + entry.value, 0);
                                      const share = totalSelections > 0 ? (item.value / totalSelections) * 100 : 0;
                                      return (
                                        <article key={item.key} className="admin-engagement-list__row">
                                          <div className="admin-engagement-list__main">
                                            <strong title={item.label}>{item.label}</strong>
                                            <div className="admin-engagement-list__meta">
                                              <span>{formatCompactNumber(item.value)} selections</span>
                                              <span>{share.toFixed(1)}% share</span>
                                            </div>
                                          </div>
                                          <div className="admin-engagement-list__progress admin-engagement-list__progress--gold">
                                            <span style={{ width: `${Math.max(share, 4)}%` }} />
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <AdminEmptyState compact title="Not enough data yet" description="Package intent will appear here once guests start comparing and selecting offers." />
                                )}
                              </div>
                            </article>

                            <article className="admin-widget admin-engagement-chart">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Friction</p>
                                  <h2>Most Clicked Buttons</h2>
                                </div>
                                <span>High-friction and high-intent interaction points</span>
                              </div>
                              <div className="admin-engagement-chart__frame">
                                {buttonPerformance.length > 0 ? (
                                  <div className="admin-engagement-list">
                                    {buttonPerformance.map((item) => (
                                      <article key={item.key} className="admin-engagement-list__row">
                                        <div className="admin-engagement-list__main">
                                          <strong title={item.label}>{item.label}</strong>
                                          <div className="admin-engagement-list__meta">
                                            <span>{formatCompactNumber(item.clicks)} clicks</span>
                                            <span>{formatCompactNumber(item.uniqueUsers)} users</span>
                                            <span>{formatCompactNumber(item.applicantOverlap)} later applied</span>
                                            <span>{item.applicantOverlapRate.toFixed(1)}% applicant overlap</span>
                                          </div>
                                        </div>
                                        <div className="admin-engagement-list__progress admin-engagement-list__progress--neutral">
                                          <span style={{ width: `${Math.max(item.applicantOverlapRate, 4)}%` }} />
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                ) : (
                                  <AdminEmptyState compact title="Not enough data yet" description="Useful click patterns will appear here once more buttons are used across the journey." />
                                )}
                              </div>
                            </article>

                            <article className="admin-widget admin-engagement-chart admin-engagement-chart--funnel">
                              <div className="admin-widget__header admin-engagement-chart__header">
                                <div>
                                  <p className="admin-engagement-chart__eyebrow">Progression</p>
                                  <h2>Guest Journey</h2>
                                </div>
                                <span>How guests move from interest to attendance</span>
                              </div>
                              {currentFunnel.length > 0 && currentFunnel[0]?.users > 0 ? (
                                <div className="admin-engagement-chart__frame">
                                  <div className="admin-engagement-funnel">
                                    {currentFunnel.map((item, index) => (
                                      <article key={item.key} className="admin-engagement-funnel__step">
                                        <div className="admin-engagement-funnel__head">
                                          <span>{index + 1}</span>
                                          <strong>{item.label}</strong>
                                        </div>
                                        <div className="admin-engagement-funnel__metrics">
                                          <b>{formatCompactNumber(item.users)} users</b>
                                          <span>{`${formatCompactNumber(item.users)} of ${formatCompactNumber(currentFunnel[0]?.users ?? item.users)} viewers`}</span>
                                          <span>{index === 0 ? "Dinner Viewers" : `${item.dropOff.toFixed(1)}% guests lost at this step`}</span>
                                        </div>
                                        <div className="admin-engagement-funnel__track">
                                          <span style={{ width: `${Math.max(item.percent, 4)}%` }} />
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <AdminEmptyState compact title="Not enough data yet" description="Need more tracked guest journey events before this view can show reliable step-to-step movement." />
                              )}
                            </article>
                          </section>

                          <section className="admin-info-grid admin-info-grid--single">
                            <article className="admin-widget admin-widget--fit">
                              <div className="admin-widget__header">
                                <h2>Key Insights</h2>
                                <span>What deserves attention next</span>
                              </div>
                              <div className="admin-engagement-insights">
                                {engagementKeyInsights.map((item) => (
                                  <article key={item.label} className="admin-engagement-insights__item">
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                    <p>{item.detail}</p>
                                  </article>
                                ))}
                              </div>
                            </article>
                          </section>
                        </>
                      ) : null}

                    </>
                  ) : engagementTab === "users" ? (
                    <section className="admin-engagement-users">
                      <article className="admin-widget admin-widget--fit">
                        <AdminFilterBar className="admin-users__controls admin-engagement__filters">
                          <div className="admin-users__switch" role="tablist" aria-label="Engagement user source">
                            {engagementUsersSourceOptions.map((option) => (
                              <button
                                key={option.value}
                                className={`admin-users__switch-btn ${option.value === "telegram" ? "admin-users__switch-btn--telegram" : "admin-users__switch-btn--landing"} ${engagementUsersSource === option.value ? "admin-users__switch-btn--active" : ""}`}
                                type="button"
                                onClick={() => setEngagementUsersSource(option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="admin-topbar__search admin-engagement-users__search">
                            <span aria-hidden="true">⌕</span>
                            <input
                              type="search"
                              value={engagementUsersSearch}
                              onChange={(event) => setEngagementUsersSearch(event.target.value)}
                              placeholder="Search name, username, or phone"
                            />
                          </div>
                          <span className="admin-toolbar__meta">{engagementUsersTotal} users loaded for CRM review</span>
                        </AdminFilterBar>
                        {engagementUsersError ? <p className="admin-auth__error">{engagementUsersError}</p> : null}
                      </article>

                      <section className="admin-engagement-users__layout">
                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>User List</h2>
                            <span>Relationship health, commercial value, and latest activity</span>
                          </div>
                          {engagementUsersLoading && engagementUsers.length === 0 ? (
                            <p className="admin-dashboard__state">Loading engagement users...</p>
                          ) : null}
                          {!engagementUsersLoading && engagementUsers.length === 0 ? (
                            <AdminEmptyState
                              compact
                              title="No users match this slice"
                              description="Try another source or search term to surface a different relationship segment."
                            />
                          ) : null}
                          <div className="admin-engagement-users__list" role="list" aria-label="Engagement users">
                            {engagementUsers.map((item) => {
                              const isSelected = item.id === selectedEngagementUserId;
                              return (
                                <button
                                  key={`${item.source}-${item.id}`}
                                  type="button"
                                  className={`admin-engagement-user-card ${isSelected ? "admin-engagement-user-card--active" : ""}`}
                                  onClick={() => setSelectedEngagementUserId(item.id)}
                                >
                                  <div className="admin-engagement-user-card__head">
                                    <div className="admin-engagement-user-card__identity">
                                      <strong>{item.name}</strong>
                                      <span>{item.username ? formatTelegramUsername(item.username) : item.phone || "No contact"}</span>
                                    </div>
                                    <AdminBadge tone={getEngagementScoreTone(item.engagementScore)}>
                                      Score {item.engagementScore}
                                    </AdminBadge>
                                  </div>
                                  <div className="admin-engagement-user-card__meta">
                                    <span>{item.phone || "No phone"}</span>
                                    <AdminBadge tone={getBookingToneByStatus(item.status)}>{formatEngagementUserStatus(item.source, item.status)}</AdminBadge>
                                  </div>
                                  <div className="admin-engagement-user-card__stats">
                                    <span>{item.applications} apps</span>
                                    <span>{formatCurrency(item.payments)} paid</span>
                                    <span>{item.referrals} referrals</span>
                                    <span>{item.points} points</span>
                                  </div>
                                  <div className="admin-engagement-user-card__foot">
                                    <span>Last activity</span>
                                    <strong>{formatDateLabel(item.lastActivityAt || item.createdAt)}</strong>
                                  </div>
                                  <div className="admin-engagement-user-card__actions">
                                    <button
                                      type="button"
                                      className="admin-engagement-inline-copy"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openFullEngagementProfile(item.id, item.source);
                                      }}
                                    >
                                      Open Full Profile
                                    </button>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </article>

                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>User Preview</h2>
                            <span>{selectedEngagementListItem ? "Quick relationship snapshot before opening the full profile" : "Select a user to preview key signals"}</span>
                          </div>
                          {!selectedEngagementListItem ? (
                            <AdminEmptyState
                              compact
                              title="No user selected"
                              description="Choose a user from the list to see the preview card and open the full CRM profile."
                            />
                          ) : (
                            <div className="admin-engagement-user-preview">
                              <div className="admin-engagement-user-preview__hero">
                                <div className="admin-engagement-user-preview__copy">
                                  <p className="admin-modal__eyebrow">{selectedEngagementListItem.source === "telegram" ? "Telegram User" : "Landing User"}</p>
                                  <h3>{selectedEngagementListItem.name}</h3>
                                  <p>{selectedEngagementListItem.username ? formatTelegramUsername(selectedEngagementListItem.username) : selectedEngagementListItem.phone || "No contact on file"}</p>
                                </div>
                                <div className="admin-booking-manager__summary">
                                  <AdminBadge tone={getBookingToneByStatus(selectedEngagementListItem.status)}>
                                    {formatEngagementUserStatus(selectedEngagementListItem.source, selectedEngagementListItem.status)}
                                  </AdminBadge>
                                  <AdminBadge tone={getEngagementScoreTone(selectedEngagementListItem.engagementScore)}>
                                    Score {selectedEngagementListItem.engagementScore}
                                  </AdminBadge>
                                </div>
                              </div>
                              <div className="admin-engagement-kpi-grid admin-engagement-kpi-grid--compact">
                                {[
                                  { label: "Applications", value: `${selectedEngagementListItem.applications}` },
                                  { label: "Payments", value: formatCurrency(selectedEngagementListItem.payments) },
                                  { label: "Referrals", value: `${selectedEngagementListItem.referrals}` },
                                  { label: "Points", value: `${selectedEngagementListItem.points}` },
                                ].map((item) => (
                                  <article key={item.label} className="admin-engagement-kpi-tile">
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                  </article>
                                ))}
                              </div>
                              <div className="admin-engagement-user-preview__meta">
                                <span>Phone</span>
                                <strong>{selectedEngagementListItem.phone || "—"}</strong>
                                <span>Last activity</span>
                                <strong>{formatDateLabel(selectedEngagementListItem.lastActivityAt || selectedEngagementListItem.createdAt)}</strong>
                              </div>
                              <AdminButton
                                type="button"
                                variant="primary"
                                onClick={() => openFullEngagementProfile(selectedEngagementListItem.id, selectedEngagementListItem.source)}
                              >
                                Open Full Profile
                              </AdminButton>
                            </div>
                          )}
                        </article>
                      </section>
                    </section>
                  ) : engagementTab === "campaigns" ? (
                    <section className="admin-engagement-users">
                      {/* Marketing Center summary KPI bar */}
                      {campaigns.length > 0 ? (
                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>Marketing Center</h2>
                            <span>Aggregate performance · {campaignsTotal} campaigns</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0 8px" }}>
                            {[
                              { label: "Total Sent", value: campaigns.reduce((s, c) => s + c.metrics.sent, 0).toLocaleString() },
                              { label: "Clicks", value: campaigns.reduce((s, c) => s + c.metrics.buttonClicks, 0).toLocaleString() },
                              { label: "Applications", value: campaigns.reduce((s, c) => s + c.metrics.applicationsAfter, 0).toLocaleString() },
                              { label: "Payments", value: campaigns.reduce((s, c) => s + c.metrics.paymentsAfter, 0).toLocaleString() },
                              { label: "Revenue", value: formatCurrency(campaigns.reduce((s, c) => s + c.metrics.revenueAfter, 0)) },
                            ].map((kpi) => (
                              <div key={kpi.label} style={{ flex: "1 1 120px", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 12, padding: "10px 16px" }}>
                                <div style={{ fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: "#d4af37", marginTop: 2 }}>{kpi.value}</div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ) : null}

                      <article className="admin-widget admin-widget--fit">
                        <AdminFilterBar className="admin-users__controls admin-engagement__filters">
                          <div className="admin-users__switch" role="tablist" aria-label="Campaign status filter">
                            {[
                              { value: "all", label: "All" },
                              { value: "draft", label: "Draft" },
                              { value: "scheduled", label: "Scheduled" },
                              { value: "sending", label: "Sending" },
                              { value: "completed", label: "Completed" },
                              { value: "cancelled", label: "Cancelled" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                className={`admin-users__switch-btn ${campaignStatusFilter === option.value ? "admin-users__switch-btn--active" : ""}`}
                                type="button"
                                onClick={() => setCampaignStatusFilter(option.value as CampaignStatusFilter)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="admin-topbar__search admin-engagement-users__search">
                            <span aria-hidden="true">⌕</span>
                            <input
                              type="search"
                              value={campaignSearchQuery}
                              onChange={(event) => setCampaignSearchQuery(event.target.value)}
                              placeholder="Search campaigns"
                            />
                          </div>
                          <AdminButton type="button" variant="secondary" onClick={handleOpenNewCampaign}>
                            New Campaign
                          </AdminButton>
                          <span className="admin-toolbar__meta">{campaignsTotal} campaigns</span>
                        </AdminFilterBar>
                        {campaignsError ? <p className="admin-auth__error">{campaignsError}</p> : null}
                        {campaignComposerError ? <p className="admin-auth__error">{campaignComposerError}</p> : null}
                      </article>

                      <section className="admin-engagement-users__layout">
                        {/* Campaign list */}
                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>Queue</h2>
                            <span>Select to open detail or composer</span>
                          </div>
                          {campaignsLoading && campaigns.length === 0 ? (
                            <p className="admin-dashboard__state">Loading campaigns...</p>
                          ) : null}
                          {!campaignsLoading && campaigns.length === 0 ? (
                            <AdminEmptyState compact title="No campaigns yet" description="Create the first Telegram engagement campaign to start building a reusable outreach library." />
                          ) : null}
                          <div className="admin-engagement-users__list" role="list" aria-label="Campaigns">
                            {campaigns.map((item) => {
                              const isSelected = item.id === selectedCampaignId;
                              const sentRate = item.metrics.total > 0 ? Math.round((item.metrics.sent / item.metrics.total) * 100) : 0;
                              const clickRate = item.metrics.sent > 0 ? Math.round((item.metrics.buttonClicks / item.metrics.sent) * 100) : 0;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`admin-engagement-user-card${isSelected ? " admin-engagement-user-card--active" : ""}`}
                                  onClick={() => setSelectedCampaignId(item.id)}
                                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}
                                >
                                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{humanizeLabel(item.messageType)} · {humanizeLabel(item.audience.audienceType)} · {item.targetUsers} users</div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, fontSize: 11, opacity: 0.75, flexShrink: 0 }}>
                                    <span>{sentRate}%</span>
                                    <span>{clickRate}% clk</span>
                                    <span>{item.metrics.applicationsAfter} app</span>
                                    <span style={{ color: "#d4af37" }}>{formatCurrency(item.metrics.revenueAfter)}</span>
                                  </div>
                                  <AdminBadge tone={getBookingToneByStatus(item.status)}>{humanizeLabel(item.status)}</AdminBadge>
                                </button>
                              );
                            })}
                          </div>
                        </article>

                        {/* Right panel */}
                        <article className="admin-widget admin-widget--fit">
                          {campaignComposerLoading ? <p className="admin-dashboard__state">Loading composer...</p> : null}
                          {campaignComposerOpen ? (
                            <div className="admin-campaign-composer">
                              {/* Composer header + tab bar */}
                              <div className="admin-widget__header admin-campaign-composer__header">
                                <h2>{campaignComposer.id != null ? "Edit Campaign" : "New Campaign"}</h2>
                                <div className="admin-users__switch" role="tablist" aria-label="Composer section">
                                  {(["content", "audience", "schedule", "preview"] as CampaignComposerTab[]).map((tab) => (
                                    <button
                                      key={tab}
                                      className={`admin-users__switch-btn${campaignComposerTab === tab ? " admin-users__switch-btn--active" : ""}`}
                                      type="button"
                                      onClick={() => setCampaignComposerTab(tab)}
                                    >
                                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Templates quick-start (content tab, new campaign only) */}
                              {campaignComposerTab === "content" && campaignComposer.id == null ? (
                                <div className="admin-campaign-composer__templates">
                                  <span className="admin-campaign-composer__section-label admin-campaign-composer__section-label--inline">Templates</span>
                                  {[
                                    { id: "reactivation", icon: "↩", label: "Re-engagement", audienceType: "passive_users", messageType: "text" as const, objective: "retention" as CampaignObjective, text: "We miss you at Secret Dinner! 🍽️ Our next exclusive gathering is almost full — reserve your seat before it's gone." },
                                    { id: "vip", icon: "⭐", label: "VIP Invite", audienceType: "vip_users", messageType: "text" as const, objective: "conversion" as CampaignObjective, text: "As a VIP member, you have exclusive early access to our upcoming dinner. Tap below to claim your spot." },
                                    { id: "rating", icon: "📊", label: "Post-event Rating", audienceType: "paid_users", messageType: "rating" as const, objective: "engagement" as CampaignObjective, pollQuestion: "How would you rate your experience at our last dinner?" },
                                    { id: "referral", icon: "🔗", label: "Referral Push", audienceType: "referral_users", messageType: "text" as const, objective: "awareness" as CampaignObjective, text: "You've been an amazing ambassador! 🙌 Know someone who'd love Secret Dinner? Share your invite and earn rewards." },
                                  ].map((tpl) => (
                                    <button
                                      key={tpl.id}
                                      type="button"
                                      style={{ display: "flex", gap: 4, alignItems: "center", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(212,175,55,0.2)", background: "rgba(212,175,55,0.06)", color: "#f5f1e8", cursor: "pointer", fontSize: 12 }}
                                      onClick={() => setCampaignComposer((prev) => ({
                                        ...prev,
                                        audienceType: tpl.audienceType,
                                        messageType: tpl.messageType,
                                        objective: tpl.objective,
                                        text: (tpl as { text?: string }).text ?? prev.text,
                                        pollQuestion: (tpl as { pollQuestion?: string }).pollQuestion ?? prev.pollQuestion,
                                        title: prev.title || tpl.label,
                                      }))}
                                    >
                                      <span>{tpl.icon}</span>
                                      <span>{tpl.label}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              {/* Content tab */}
                              {campaignComposerTab === "content" ? (
                                <div className="admin-campaign-composer__stack">

                                  {/* — Basic info — */}
                                  <div className="admin-campaign-composer__section">
                                    <div className="admin-campaign-composer__section-label">Campaign Info</div>
                                    <TextField label="Campaign title" value={campaignComposer.title} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, title: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                    <TextField label="Internal description" value={campaignComposer.description} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, description: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                  </div>

                                  {/* — Message type grid picker — */}
                                  <div className="admin-campaign-composer__section">
                                    <div className="admin-campaign-composer__section-label">Message Type</div>
                                    <div className="admin-campaign-composer__message-grid">
                                      {([
                                        { value: "text",     icon: "📝", label: "Text" },
                                        { value: "photo",    icon: "📷", label: "Photo" },
                                        { value: "video",    icon: "🎬", label: "Video" },
                                        { value: "document", icon: "📄", label: "Document" },
                                        { value: "audio",    icon: "🎵", label: "Audio" },
                                        { value: "voice",    icon: "🎤", label: "Voice" },
                                        { value: "location", icon: "📍", label: "Location" },
                                        { value: "contact",  icon: "👤", label: "Contact" },
                                        { value: "poll",     icon: "📊", label: "Poll" },
                                        { value: "quiz",     icon: "🧠", label: "Quiz" },
                                        { value: "rating",   icon: "⭐", label: "Rating" },
                                        { value: "image",    icon: "🖼️",  label: "Image" },
                                      ] as Array<{ value: CampaignComposerState["messageType"]; icon: string; label: string }>).map((type) => {
                                        const active = campaignComposer.messageType === type.value;
                                        return (
                                          <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setCampaignComposer((prev) => ({ ...prev, messageType: type.value }))}
                                            style={{
                                              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                                              padding: "6px 4px", borderRadius: 8,
                                              border: active ? "1.5px solid #d4af37" : "1px solid rgba(255,255,255,0.07)",
                                              background: active ? "rgba(212,175,55,0.13)" : "rgba(255,255,255,0.03)",
                                              color: active ? "#d4af37" : "rgba(245,241,232,0.65)",
                                              cursor: "pointer", fontSize: 10, fontWeight: active ? 600 : 400,
                                              transition: "all 0.12s",
                                            }}
                                          >
                                            <span style={{ fontSize: 15, lineHeight: 1 }}>{type.icon}</span>
                                            <span>{type.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* — Message body — */}
                                  <div className="admin-campaign-composer__section">
                                    <div className="admin-campaign-composer__section-label">Message Content</div>
                                    {!["poll", "quiz", "rating"].includes(campaignComposer.messageType) ? (
                                      <TextField label="Message text" multiline minRows={4} value={campaignComposer.text} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, text: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                    ) : null}
                                    {!["text", "poll", "quiz", "rating"].includes(campaignComposer.messageType) ? (
                                      <>
                                        <TextField label="Caption" multiline minRows={2} value={campaignComposer.caption} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, caption: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                        <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                          <Select value={campaignComposer.mediaKind} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, mediaKind: event.target.value as CampaignComposerState["mediaKind"] }))}>
                                            <MenuItem value="url">URL</MenuItem>
                                            <MenuItem value="file_id">Telegram file_id</MenuItem>
                                            <MenuItem value="data_url">Base64</MenuItem>
                                          </Select>
                                        </FormControl>
                                        <TextField label="Media value" value={campaignComposer.mediaValue} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, mediaValue: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                        <TextField label="Filename" value={campaignComposer.mediaFileName} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, mediaFileName: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                      </>
                                    ) : null}

                                    {/* Rating */}
                                    {campaignComposer.messageType === "rating" ? (
                                      <>
                                        <TextField label="Rating question" value={campaignComposer.pollQuestion} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, pollQuestion: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} helperText="Users see 5 star buttons (1 ★ – 5 ★★★★★)" />
                                        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.12)", fontSize: 12, opacity: 0.6 }}>
                                          <span>⭐</span><span>Preview stars in the Preview tab</span>
                                        </div>
                                      </>
                                    ) : null}

                                    {/* Poll / Quiz */}
                                    {(campaignComposer.messageType === "poll" || campaignComposer.messageType === "quiz") ? (() => {
                                      const opts = campaignComposer.pollOptions.split("\n").filter(Boolean);
                                      const correctIdx = parseInt(campaignComposer.correctOptionIndex, 10);
                                      return (
                                        <>
                                          <TextField label="Question" value={campaignComposer.pollQuestion} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, pollQuestion: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />

                                          {/* Individual option inputs */}
                                          <div className="admin-campaign-composer__subsection">
                                            <div className="admin-campaign-composer__section-label">Poll Options</div>
                                            {opts.map((opt, i) => (
                                              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                {campaignComposer.messageType === "quiz" ? (
                                                  <button
                                                    type="button"
                                                    title="Mark as correct answer"
                                                    onClick={() => setCampaignComposer((prev) => ({ ...prev, correctOptionIndex: i === correctIdx ? "" : String(i) }))}
                                                    style={{
                                                      flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                                                      border: i === correctIdx ? "2px solid #52d98c" : "1.5px solid rgba(255,255,255,0.15)",
                                                      background: i === correctIdx ? "rgba(82,217,140,0.15)" : "rgba(255,255,255,0.04)",
                                                      color: i === correctIdx ? "#52d98c" : "rgba(245,241,232,0.4)",
                                                      cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                                                    }}
                                                  >
                                                    {i === correctIdx ? "✓" : i + 1}
                                                  </button>
                                                ) : (
                                                  <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.08)", color: "#d4af37", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                                                )}
                                                <TextField
                                                  value={opt}
                                                  onChange={(event) => {
                                                    const next = [...opts];
                                                    next[i] = event.target.value;
                                                    setCampaignComposer((prev) => ({ ...prev, pollOptions: next.join("\n") }));
                                                  }}
                                                  placeholder={`Option ${i + 1}`}
                                                  className="admin-engagement__field"
                                                  sx={{ ...engagementFieldSx, flex: 1, minWidth: 0 }}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const next = opts.filter((_, j) => j !== i);
                                                    setCampaignComposer((prev) => ({ ...prev, pollOptions: next.join("\n") }));
                                                  }}
                                                  style={{ flexShrink: 0, background: "none", border: "none", color: "rgba(245,241,232,0.35)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                                                  title="Remove option"
                                                >✕</button>
                                              </div>
                                            ))}
                                            {opts.length < 10 ? (
                                              <button
                                                type="button"
                                                onClick={() => setCampaignComposer((prev) => ({ ...prev, pollOptions: prev.pollOptions ? prev.pollOptions + "\nNew option" : "New option" }))}
                                                style={{ alignSelf: "flex-start", display: "flex", gap: 6, alignItems: "center", padding: "6px 14px", borderRadius: 8, border: "1px dashed rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.04)", color: "#d4af37", cursor: "pointer", fontSize: 12 }}
                                              >
                                                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                                                <span>Add option</span>
                                              </button>
                                            ) : null}
                                            {campaignComposer.messageType === "quiz" ? (
                                              <div style={{ fontSize: 11, opacity: 0.5, padding: "4px 0" }}>Click the circle to mark correct answer · Currently: {Number.isNaN(correctIdx) ? "none" : `option ${correctIdx + 1}`}</div>
                                            ) : null}
                                          </div>

                                          <TextField label="Explanation (shown after answer)" value={campaignComposer.pollExplanation} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, pollExplanation: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                        </>
                                      );
                                    })() : null}
                                  </div>

                                  {/* — Inline buttons — */}
                                  <div className="admin-campaign-composer__section">
                                    <div className="admin-campaign-composer__section-label">Inline Buttons</div>
                                    <div className="admin-campaign-composer__subsection">
                                      {campaignComposer.buttons.map((button, index) => (
                                        <div key={button.id} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 6 }}>
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6 }}>Button {index + 1}</span>
                                            <button type="button" onClick={() => setCampaignComposer((prev) => ({ ...prev, buttons: prev.buttons.filter((b) => b.id !== button.id) }))} style={{ background: "none", border: "none", color: "rgba(245,241,232,0.35)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 2 }} title="Remove">✕</button>
                                          </div>
                                          <div className="admin-engagement__filters" style={{ gap: 8 }}>
                                            <TextField label="Label" value={button.label} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, buttons: prev.buttons.map((item) => item.id === button.id ? { ...item, label: event.target.value } : item) }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                            <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                              <Select value={button.kind} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, buttons: prev.buttons.map((item) => item.id === button.id ? { ...item, kind: event.target.value as CampaignComposerState["buttons"][number]["kind"] } : item) }))}>
                                                <MenuItem value="callback">Callback</MenuItem>
                                                <MenuItem value="link">Link</MenuItem>
                                                <MenuItem value="cta">CTA deep link</MenuItem>
                                              </Select>
                                            </FormControl>
                                            {button.kind === "link" ? (
                                              <TextField label="URL" value={button.url} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, buttons: prev.buttons.map((item) => item.id === button.id ? { ...item, url: event.target.value } : item) }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                            ) : (
                                              <TextField label="Action" value={button.action} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, buttons: prev.buttons.map((item) => item.id === button.id ? { ...item, action: event.target.value } : item) }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setCampaignComposer((prev) => ({ ...prev, buttons: [...prev.buttons, buildCampaignButtonState()] }))}
                                        style={{ alignSelf: "flex-start", display: "flex", gap: 6, alignItems: "center", padding: "6px 14px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", color: "rgba(245,241,232,0.55)", cursor: "pointer", fontSize: 12 }}
                                      >
                                        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                                        <span>Add button</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : campaignComposerTab === "audience" ? (
                                <div className="admin-engagement__filters admin-campaign-composer__section">
                                  <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                    <Select value={campaignComposer.audienceType} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, audienceType: event.target.value }))}>
                                      {[
                                        ["all_users", "All users"],
                                        ["active_users", "Active users"],
                                        ["passive_users", "Passive users"],
                                        ["paid_users", "Paid users"],
                                        ["unpaid_users", "Unpaid users"],
                                        ["vip_users", "VIP users"],
                                        ["referral_users", "Referral users"],
                                        ["selected_users", "Selected users"],
                                        ["users_by_dinner", "Users by dinner"],
                                        ["users_by_package", "Users by package"],
                                        ["custom", "Custom filters"],
                                      ].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                                    </Select>
                                  </FormControl>
                                  {campaignComposer.audienceType === "users_by_dinner" ? (
                                    <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                      <Select value={campaignComposer.dinnerId} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, dinnerId: event.target.value }))}>
                                        <MenuItem value="all">All dinners</MenuItem>
                                        {campaignOptions.dinners.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                                      </Select>
                                    </FormControl>
                                  ) : null}
                                  {campaignComposer.audienceType === "users_by_package" ? (
                                    <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                      <Select value={campaignComposer.packageValue} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, packageValue: event.target.value }))}>
                                        <MenuItem value="all">All packages</MenuItem>
                                        {campaignOptions.packages.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                                      </Select>
                                    </FormControl>
                                  ) : null}
                                  {campaignComposer.audienceType === "selected_users" ? (
                                    <TextField label="User IDs (one per line)" multiline minRows={3} value={campaignComposer.selectedUsers} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, selectedUsers: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} helperText="Telegram user IDs" />
                                  ) : null}
                                  {campaignComposer.audienceType === "custom" ? (
                                    <>
                                      <TextField label="Language filter" value={campaignComposer.language} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, language: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} helperText="e.g. en, ru, hy" />
                                      <TextField label="Name / username search" value={campaignComposer.search} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, search: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                    </>
                                  ) : null}
                                  {/* Audience estimator */}
                                  <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.14)", borderRadius: 12, padding: "12px 16px", marginTop: 2 }}>
                                    <div className="admin-campaign-composer__section-label" style={{ marginBottom: 8 }}>Audience Estimator</div>
                                    {campaignComposer.id != null && selectedCampaign != null ? (
                                      <>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                          <span style={{ fontSize: 13 }}>Estimated reach</span>
                                          <strong style={{ color: "#d4af37" }}>{selectedCampaign.targetUsers.toLocaleString()} users</strong>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                          <span style={{ fontSize: 13 }}>Audience segment</span>
                                          <strong>{humanizeLabel(campaignComposer.audienceType)}</strong>
                                        </div>
                                        <p style={{ fontSize: 11, opacity: 0.45, marginTop: 8, marginBottom: 0 }}>Audience is resolved dynamically at send time. Count above reflects last saved snapshot.</p>
                                      </>
                                    ) : (
                                      <>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                          <span style={{ fontSize: 13 }}>Segment</span>
                                          <strong>{humanizeLabel(campaignComposer.audienceType)}</strong>
                                        </div>
                                        <p style={{ fontSize: 11, opacity: 0.45, marginTop: 8, marginBottom: 0 }}>Save the campaign to see the resolved audience count before sending.</p>
                                      </>
                                    )}
                                  </div>
                                  {/* Smart segment shortcuts */}
                                  {smartSegments.length > 0 ? (
                                    <div style={{ marginTop: 6 }}>
                                      <div className="admin-campaign-composer__section-label" style={{ marginBottom: 6 }}>Smart Segments</div>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {smartSegments.slice(0, 5).map((seg) => (
                                          <button
                                            key={seg.key}
                                            type="button"
                                            style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#f5f1e8", cursor: "pointer", fontSize: 12 }}
                                            onClick={() => setCampaignComposer((prev) => ({ ...prev, audienceType: "custom" }))}
                                          >
                                            {seg.label} · {seg.count}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : campaignComposerTab === "schedule" ? (
                                <div className="admin-engagement__filters admin-campaign-composer__section">
                                  <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                    <Select value={campaignComposer.objective} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, objective: event.target.value as CampaignObjective }))}>
                                      <MenuItem value="awareness">Awareness — broaden reach</MenuItem>
                                      <MenuItem value="engagement">Engagement — drive interactions</MenuItem>
                                      <MenuItem value="conversion">Conversion — generate bookings</MenuItem>
                                      <MenuItem value="retention">Retention — re-engage past guests</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <FormControl className="admin-engagement__field" sx={engagementFieldSx}>
                                    <Select value={campaignComposer.status} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, status: event.target.value as CampaignComposerState["status"] }))}>
                                      <MenuItem value="draft">Draft</MenuItem>
                                      <MenuItem value="scheduled">Scheduled</MenuItem>
                                    </Select>
                                  </FormControl>
                                  <TextField label="Scheduled for" type="datetime-local" value={campaignComposer.scheduledFor} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, scheduledFor: event.target.value }))} InputLabelProps={{ shrink: true }} className="admin-engagement__field" sx={engagementFieldSx} />
                                  <TextField label="Rate limit / min" value={campaignComposer.rateLimitPerMinute} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, rateLimitPerMinute: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} helperText="Messages per minute (max 60)" />
                                  <TextField label="Max retries" value={campaignComposer.maxRetries} onChange={(event) => setCampaignComposer((prev) => ({ ...prev, maxRetries: event.target.value }))} className="admin-engagement__field" sx={engagementFieldSx} />
                                </div>
                              ) : (
                                <div className="admin-campaign-composer__preview">
                                  <div style={{ background: "#212b36", borderRadius: 14, padding: 16, maxWidth: 380 }}>
                                    {/* Chat header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#d4af37,#b8960e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#1a1f26" }}>SD</div>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: "#f5f1e8" }}>Secret Dinner</div>
                                        <div style={{ fontSize: 11, opacity: 0.45 }}>Channel</div>
                                      </div>
                                    </div>
                                    {/* Message bubble */}
                                    <div style={{ background: "#2b3a4a", borderRadius: "4px 14px 14px 14px", padding: "10px 14px", maxWidth: 320, position: "relative" }}>
                                      {/* Media preview */}
                                      {campaignComposer.mediaValue && !["poll", "quiz", "rating", "text"].includes(campaignComposer.messageType) ? (
                                        <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden" }}>
                                          {["photo", "image"].includes(campaignComposer.messageType) && campaignComposer.mediaKind === "url" ? (
                                            <img src={campaignComposer.mediaValue} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                          ) : (
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
                                              <span style={{ fontSize: 20 }}>📎</span>
                                              <span style={{ fontSize: 12, opacity: 0.7 }}>{campaignComposer.mediaFileName || campaignComposer.mediaValue.split("/").pop() || "attachment"}</span>
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                      {/* Poll/Quiz/Rating */}
                                      {campaignComposer.messageType === "poll" || campaignComposer.messageType === "quiz" ? (
                                        <div style={{ marginBottom: 6 }}>
                                          <div style={{ fontWeight: 600, fontSize: 14, color: "#f5f1e8", marginBottom: 8 }}>{campaignComposer.pollQuestion || "Enter a question…"}</div>
                                          {campaignComposer.pollOptions.split("\n").filter(Boolean).map((opt, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.5)", flexShrink: 0 }} />
                                              <span style={{ fontSize: 13 }}>{opt}</span>
                                            </div>
                                          ))}
                                          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 6 }}>{campaignComposer.messageType === "quiz" ? "Quiz · Correct answer hidden" : "Poll · Anonymous"}</div>
                                        </div>
                                      ) : campaignComposer.messageType === "rating" ? (
                                        <div style={{ marginBottom: 6 }}>
                                          <div style={{ fontWeight: 600, fontSize: 14, color: "#f5f1e8", marginBottom: 12 }}>{campaignComposer.pollQuestion || "How would you rate your experience?"}</div>
                                          <div style={{ display: "flex", gap: 8 }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                              <button
                                                key={star}
                                                type="button"
                                                onClick={() => setCampaignPreviewRating(campaignPreviewRating === star ? 0 : star)}
                                                style={{
                                                  background: "none", border: "none", cursor: "pointer", padding: 0,
                                                  fontSize: 22, lineHeight: 1,
                                                  filter: star <= campaignPreviewRating ? "none" : "grayscale(1) opacity(0.3)",
                                                  transform: star <= campaignPreviewRating ? "scale(1.1)" : "scale(1)",
                                                  transition: "all 0.12s",
                                                }}
                                                title={`Rate ${star}`}
                                              >⭐</button>
                                            ))}
                                          </div>
                                          {campaignPreviewRating > 0 ? (
                                            <div style={{ fontSize: 11, color: "#d4af37", marginTop: 8, fontWeight: 500 }}>
                                              {"★".repeat(campaignPreviewRating)}{"☆".repeat(5 - campaignPreviewRating)} · You rated {campaignPreviewRating} star{campaignPreviewRating !== 1 ? "s" : ""}
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>Tap a star to preview · Rating poll</div>
                                          )}
                                        </div>
                                      ) : (
                                        <p style={{ margin: 0, fontSize: 14, color: campaignComposer.text || campaignComposer.caption ? "#f5f1e8" : "rgba(245,241,232,0.35)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                          {campaignComposer.text || campaignComposer.caption || "Your message will appear here…"}
                                        </p>
                                      )}
                                      {/* Inline buttons */}
                                      {campaignComposer.buttons.filter((b) => b.label).length > 0 ? (
                                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                                          {campaignComposer.buttons.filter((b) => b.label).map((btn) => (
                                            <div key={btn.id} style={{ textAlign: "center", padding: "7px 12px", borderRadius: 8, background: "rgba(212,175,55,0.14)", color: "#d4af37", fontSize: 13, fontWeight: 500 }}>
                                              {btn.label}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                      <div style={{ textAlign: "right", fontSize: 10, opacity: 0.35, marginTop: 6 }}>12:00</div>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: 12, opacity: 0.4, margin: 0 }}>Preview is approximate. Actual rendering depends on Telegram client version and platform.</p>
                                </div>
                              )}

                              <div className="admin-toolbar" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <AdminButton type="button" variant="ghost" onClick={() => setCampaignComposerOpen(false)}>Close</AdminButton>
                                <AdminButton type="button" variant="primary" onClick={handleSaveCampaign} disabled={campaignComposerSaving}>
                                  {campaignComposerSaving ? "Saving…" : "Save Campaign"}
                                </AdminButton>
                              </div>
                            </div>

                          ) : selectedCampaign ? (
                            <div className="admin-engagement-profile">
                              {/* Hero */}
                              <section className="admin-engagement-profile__hero">
                                <div className="admin-engagement-profile__hero-copy">
                                  <p className="admin-modal__eyebrow">{humanizeLabel(selectedCampaign.messageType)} Campaign</p>
                                  <h3>{selectedCampaign.title}</h3>
                                  <p>{selectedCampaign.description || "No description."}</p>
                                  <div className="admin-booking-manager__summary">
                                    <AdminBadge tone={getBookingToneByStatus(selectedCampaign.status)}>{humanizeLabel(selectedCampaign.status)}</AdminBadge>
                                    <AdminBadge tone="gold">{humanizeLabel(selectedCampaign.audience.audienceType)}</AdminBadge>
                                    <AdminBadge tone="emerald">{selectedCampaign.targetUsers} targets</AdminBadge>
                                  </div>
                                </div>
                                <div className="admin-engagement-profile__hero-note">
                                  <span>Updated {formatDateLabel(selectedCampaign.updatedAt)}</span>
                                  {selectedCampaign.scheduledFor ? <span>Scheduled {formatDateLabel(selectedCampaign.scheduledFor)}</span> : null}
                                </div>
                              </section>

                              {/* KPI bar */}
                              {(() => {
                                const total = Math.max(selectedCampaign.metrics.total, 1);
                                const sent = selectedCampaign.metrics.sent;
                                const kpis = [
                                  { label: "Delivery", value: `${Math.round((sent / total) * 100)}%`, sub: `${sent} of ${selectedCampaign.metrics.total}` },
                                  { label: "Click rate", value: sent > 0 ? `${Math.round((selectedCampaign.metrics.buttonClicks / sent) * 100)}%` : "—", sub: `${selectedCampaign.metrics.buttonClicks} clicks` },
                                  { label: "Conv. rate", value: sent > 0 ? `${Math.round((selectedCampaign.metrics.applicationsAfter / sent) * 100)}%` : "—", sub: `${selectedCampaign.metrics.applicationsAfter} apps` },
                                  { label: "Revenue", value: formatCurrency(selectedCampaign.metrics.revenueAfter), sub: `${selectedCampaign.metrics.paymentsAfter} payments` },
                                ];
                                return (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 0 12px" }}>
                                    {kpis.map((kpi) => (
                                      <div key={kpi.label} style={{ flex: "1 1 100px", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.14)", borderRadius: 10, padding: "8px 14px" }}>
                                        <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: "#d4af37" }}>{kpi.value}</div>
                                        <div style={{ fontSize: 11, opacity: 0.5 }}>{kpi.sub}</div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Actions */}
                              <div className="admin-toolbar" style={{ marginBottom: 12 }}>
                                <AdminButton type="button" variant="secondary" onClick={() => void handleEditCampaign(selectedCampaign.id)}>Edit</AdminButton>
                                <AdminButton type="button" variant="secondary" onClick={() => void handleTestSendCampaign(selectedCampaign.id)}>Test Send</AdminButton>
                                <AdminButton type="button" variant="primary" onClick={() => void handleScheduleCampaign(selectedCampaign.id, true)} disabled={selectedCampaign.status === "sending" || selectedCampaign.status === "completed" || selectedCampaign.status === "cancelled"}>Send Now</AdminButton>
                                <AdminButton type="button" variant="ghost" onClick={() => void handleScheduleCampaign(selectedCampaign.id, false)} disabled={selectedCampaign.status === "completed" || selectedCampaign.status === "cancelled"}>Schedule</AdminButton>
                                <AdminButton type="button" variant="danger" onClick={() => void handleCancelCampaign(selectedCampaign.id)} disabled={selectedCampaign.status === "completed" || selectedCampaign.status === "cancelled"}>Cancel</AdminButton>
                              </div>

                              <section className="admin-info-grid">
                                {/* Delivery funnel */}
                                {selectedCampaign.metrics.total > 0 ? (
                                  <article className="admin-widget admin-widget--fit">
                                    <div className="admin-widget__header">
                                      <h2>Delivery Funnel</h2>
                                      <span>Message flow from queue to conversion</span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {(() => {
                                        const total = Math.max(selectedCampaign.metrics.total, 1);
                                        const sent = selectedCampaign.metrics.sent;
                                        return [
                                          { label: "Queued", value: selectedCampaign.metrics.total, pct: 100, color: "#6b7c93" },
                                          { label: "Sent", value: sent, pct: Math.round((sent / total) * 100), color: "#4da6ff" },
                                          { label: "Failed / Blocked", value: selectedCampaign.metrics.failed + selectedCampaign.metrics.blocked, pct: Math.round(((selectedCampaign.metrics.failed + selectedCampaign.metrics.blocked) / total) * 100), color: "#e05c5c" },
                                          { label: "Clicked", value: selectedCampaign.metrics.buttonClicks, pct: sent > 0 ? Math.round((selectedCampaign.metrics.buttonClicks / sent) * 100) : 0, color: "#d4af37" },
                                          { label: "Applied", value: selectedCampaign.metrics.applicationsAfter, pct: sent > 0 ? Math.round((selectedCampaign.metrics.applicationsAfter / sent) * 100) : 0, color: "#52d98c" },
                                          { label: "Paid", value: selectedCampaign.metrics.paymentsAfter, pct: sent > 0 ? Math.round((selectedCampaign.metrics.paymentsAfter / sent) * 100) : 0, color: "#d4af37" },
                                        ].map((step) => (
                                          <div key={step.label}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                              <span>{step.label}</span>
                                              <span style={{ fontWeight: 600 }}>{step.value.toLocaleString()} <span style={{ opacity: 0.45 }}>({step.pct}%)</span></span>
                                            </div>
                                            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
                                              <div style={{ height: "100%", borderRadius: 3, background: step.color, width: `${step.pct}%`, transition: "width 0.4s" }} />
                                            </div>
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  </article>
                                ) : null}

                                {/* Revenue attribution */}
                                <article className="admin-widget admin-widget--fit">
                                  <div className="admin-widget__header">
                                    <h2>Revenue Attribution</h2>
                                    <span>Business outcomes after campaign delivery</span>
                                  </div>
                                  <ul className="admin-metric-list">
                                    <li><span>Applications after send</span><b>{selectedCampaign.metrics.applicationsAfter}</b></li>
                                    <li><span>Payments after send</span><b>{selectedCampaign.metrics.paymentsAfter}</b></li>
                                    <li><span>Revenue after send</span><b>{formatCurrency(selectedCampaign.metrics.revenueAfter)}</b></li>
                                    <li><span>Revenue per send</span><b>{selectedCampaign.metrics.sent > 0 ? formatCurrency(selectedCampaign.metrics.revenueAfter / selectedCampaign.metrics.sent) : "—"}</b></li>
                                    <li><span>Poll votes</span><b>{selectedCampaign.metrics.pollVotes}</b></li>
                                    <li><span>Quiz correct answers</span><b>{selectedCampaign.metrics.quizCorrect}</b></li>
                                    <li><span>Pending in queue</span><b>{selectedCampaign.metrics.pending}</b></li>
                                    <li><span>Skipped</span><b>{selectedCampaign.metrics.skipped}</b></li>
                                  </ul>
                                </article>
                              </section>

                              {/* Audience sample */}
                              {selectedCampaign.previewUsers.length > 0 ? (
                                <article className="admin-widget admin-widget--fit">
                                  <div className="admin-widget__header">
                                    <h2>Audience Sample</h2>
                                    <span>{selectedCampaign.previewUsers.length} shown of {selectedCampaign.targetUsers} resolved</span>
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {selectedCampaign.previewUsers.map((user) => (
                                      <div key={`${selectedCampaign.id}-${user.userId}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
                                        <span>{user.name || user.username || `ID ${user.userId}`}</span>
                                        <AdminBadge tone={getBookingToneByStatus(user.status)}>{formatEngagementUserStatus("telegram", user.status)}</AdminBadge>
                                      </div>
                                    ))}
                                  </div>
                                </article>
                              ) : null}

                              {/* Delivery log with search */}
                              <article className="admin-widget admin-widget--fit">
                                <div className="admin-widget__header">
                                  <h2>Delivery Log</h2>
                                  <span>{campaignLogs.length} events</span>
                                </div>
                                <div className="admin-topbar__search" style={{ marginBottom: 10 }}>
                                  <span aria-hidden="true">⌕</span>
                                  <input
                                    type="search"
                                    value={campaignLogSearch}
                                    onChange={(event) => setCampaignLogSearch(event.target.value)}
                                    placeholder="Filter by user, event type, or status"
                                  />
                                </div>
                                {campaignLogsError ? <p className="admin-auth__error">{campaignLogsError}</p> : null}
                                {campaignLogsLoading ? <p className="admin-dashboard__state">Loading logs…</p> : null}
                                {!campaignLogsLoading && campaignLogs.length === 0 ? (
                                  <AdminEmptyState compact title="No delivery log yet" description="Logs appear after the campaign is tested, scheduled, or sent." />
                                ) : null}
                                {campaignLogs.length > 0 ? (() => {
                                  const q = campaignLogSearch.toLowerCase().trim();
                                  const filtered = q
                                    ? campaignLogs.filter((item) =>
                                        item.eventType.toLowerCase().includes(q) ||
                                        item.status.toLowerCase().includes(q) ||
                                        (item.username || "").toLowerCase().includes(q) ||
                                        (item.message || "").toLowerCase().includes(q) ||
                                        (item.question || "").toLowerCase().includes(q) ||
                                        (item.choiceLabel || "").toLowerCase().includes(q) ||
                                        item.userId.toLowerCase().includes(q)
                                      )
                                    : campaignLogs;
                                  return (
                                    <div className="admin-engagement-profile__timeline">
                                      {filtered.length === 0 ? (
                                        <p className="admin-dashboard__state">No logs match "{campaignLogSearch}"</p>
                                      ) : filtered.map((item) => (
                                        <article key={item.id} className="admin-engagement-timeline__item">
                                          <div className="admin-engagement-timeline__head">
                                            <strong>{humanizeLabel(item.eventType)}</strong>
                                            <AdminBadge tone={getBookingToneByStatus(item.status)}>{humanizeLabel(item.status)}</AdminBadge>
                                          </div>
                                          <p>{item.username ? formatTelegramUsername(item.username) : `User ${item.userId}`} · {item.message || "No message"}</p>
                                          {item.eventType === "poll_answer" && (item.choiceLabel || item.question) ? (
                                            <p>
                                              {item.question ? <><b>Question:</b> {item.question}</> : null}
                                              {item.question && item.choiceLabel ? " · " : null}
                                              {item.choiceLabel ? <><b>Answer:</b> {item.choiceLabel}</> : null}
                                              {item.messageType === "quiz" && typeof item.correct === "boolean" ? (
                                                <> · <AdminBadge tone={getCampaignResponseTone(item.correct, item.messageType)}>{item.correct ? "Correct" : "Wrong"}</AdminBadge></>
                                              ) : null}
                                            </p>
                                          ) : null}
                                          <p style={{ opacity: 0.5, fontSize: 12 }}>{formatDateLabel(item.occurredAt)}{item.attempt > 1 ? ` · attempt ${item.attempt}` : ""}</p>
                                        </article>
                                      ))}
                                    </div>
                                  );
                                })() : null}
                              </article>
                            </div>
                          ) : (
                            <AdminEmptyState compact title="No campaign selected" description="Choose a campaign from the list or create a new one." />
                          )}
                        </article>
                      </section>
                    </section>
                  ) : engagementTab === "segments" ? (
                    <section className="admin-engagement-users">
                      {segmentsError ? (
                        <article className="admin-widget admin-widget--fit">
                          <p className="admin-auth__error">{segmentsError}</p>
                        </article>
                      ) : segmentsLoading ? (
                        <article className="admin-widget admin-widget--fit">
                          <p className="admin-dashboard__state">Computing segments...</p>
                        </article>
                      ) : (
                        <>
                          {recommendations.length > 0 ? (
                            <article className="admin-widget admin-widget--fit">
                              <div className="admin-widget__header">
                                <h2>BI Recommendations</h2>
                                <span>Actionable insights based on current user data</span>
                              </div>
                              <ul className="admin-metric-list">
                                {recommendations.map((rec, idx) => (
                                  <li key={idx} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                                      <AdminBadge tone={getRecommendationTone(rec.priority)}>{rec.priority}</AdminBadge>
                                      <AdminBadge tone="default">{rec.type}</AdminBadge>
                                      <b style={{ flex: 1 }}>{rec.title}</b>
                                      <span style={{ fontSize: 12, opacity: 0.6 }}>{rec.count} users</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>{rec.message}</p>
                                    <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>Action: {rec.action}</p>
                                  </li>
                                ))}
                              </ul>
                            </article>
                          ) : null}
                          <section className="admin-engagement-users__layout">
                            {smartSegments.map((seg) => (
                              <article key={seg.key} className="admin-widget admin-widget--fit">
                                <div className="admin-widget__header">
                                  <h2>{seg.label}</h2>
                                  <span>{seg.description}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                  <AdminBadge tone={getSegmentCountTone(seg.count)}>{seg.count} users</AdminBadge>
                                </div>
                                {seg.users.length > 0 ? (
                                  <ul className="admin-metric-list">
                                    {seg.users.slice(0, 10).map((u) => (
                                      <li key={u.id}>
                                        <span
                                          style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                                          onClick={() => {
                                            setEngagementTab("users");
                                            setEngagementUsersSource(u.source as "telegram" | "landing");
                                            setSelectedEngagementUserId(u.id);
                                          }}
                                        >
                                          {u.name || `User #${u.id}`}
                                        </span>
                                        <b>{u.value > 0 ? u.value.toFixed(u.value % 1 === 0 ? 0 : 2) : ""}</b>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <AdminEmptyState compact title="No users in this segment" description="Segment criteria not met by any user yet." />
                                )}
                              </article>
                            ))}
                            {smartSegments.length === 0 ? (
                              <article className="admin-widget admin-widget--fit">
                                <AdminEmptyState compact title="No segments computed" description="Segment data requires Telegram users in the database." />
                              </article>
                            ) : null}
                          </section>
                        </>
                      )}
                    </section>
                  ) : (
                    <section className="admin-engagement-users">
                      <article className="admin-widget admin-widget--fit">
                        <div className="admin-widget__header">
                          <h2>Analytics Debug — Data Quality Report</h2>
                          <span>Backend-generated validation checks for the currently loaded analytics slice.</span>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2ddd4" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                                <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600, width: 200 }}>Metric / Widget</th>
                                <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600, width: 70 }}>Status</th>
                                <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600, width: 180 }}>Metric value</th>
                                <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Details</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(engagementAnalytics?.debug.checks ?? []).map((row) => (
                                <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{row.label}</td>
                                  <td style={{ padding: "8px 12px" }}>
                                    <span style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      letterSpacing: "0.04em",
                                      background: row.status === "PASS" ? "rgba(74,222,128,0.15)" : row.status === "WARN" ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)",
                                      color: row.status === "PASS" ? "#4ade80" : row.status === "WARN" ? "#fbbf24" : "#ef4444",
                                    }}>
                                      {row.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 12px", color: "#a6afa8", fontSize: 12, fontFamily: "monospace" }}>{row.metricValue}</td>
                                  <td style={{ padding: "8px 12px", color: "#c8c4bc", fontSize: 12 }}>{row.details}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>

                      {engagementAnalytics ? (
                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>Live Data Snapshot</h2>
                            <span>Raw numbers from the currently loaded analytics response.</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                            {([
                              { label: "Total events", value: engagementAnalytics.summary.totalEvents },
                              { label: "Active users (meaningful events)", value: engagementAnalytics.summary.activeUsers },
                              { label: "Passive users (1–2 events)", value: engagementAnalytics.summary.passiveUsers },
                              { label: "New users", value: engagementAnalytics.summary.newUsers },
                              { label: "Returning users", value: engagementAnalytics.summary.returningUsers },
                              { label: "Journey steps with data", value: engagementAnalytics.funnel.filter((s) => s.users > 0).length },
                              { label: "Dinner views tracked", value: engagementAnalytics.dinnerViews.reduce((a, b) => a + b.value, 0) },
                              { label: "Package selection events", value: engagementAnalytics.packageSelections.reduce((a, b) => a + b.value, 0) },
                              { label: "Button click events", value: engagementAnalytics.buttonClicks.reduce((a, b) => a + b.value, 0) },
                              { label: "Timeline days loaded", value: engagementAnalytics.timeline.length },
                              { label: "Hourly buckets loaded", value: engagementAnalytics.hourlyActivity.length },
                              { label: "Dinner perf rows", value: engagementAnalytics.dinnerPerformance.length },
                            ] as Array<{ label: string; value: number }>).map((item) => (
                              <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ fontSize: 11, color: "#a6afa8", marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: "#f5f1e8" }}>{item.value.toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ) : null}

                      {engagementAnalytics?.debug ? (
                        <article className="admin-widget admin-widget--fit">
                          <div className="admin-widget__header">
                            <h2>Guest Journey Debug</h2>
                            <span>Raw stage reach, ordered guest counts, inference, and data quality warnings.</span>
                          </div>
                          <div style={{ display: "grid", gap: 16 }}>
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2ddd4" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                                    <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Stage</th>
                                    <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Raw</th>
                                    <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Ordered</th>
                                    <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Inferred</th>
                                    <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Excluded</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {engagementAnalytics.debug.orderedStageCounts.map((step) => (
                                    <tr key={step.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>{step.label}</td>
                                      <td style={{ padding: "8px 12px" }}>{formatCompactNumber(step.rawUsers)}</td>
                                      <td style={{ padding: "8px 12px" }}>{formatCompactNumber(step.orderedUsers)}</td>
                                      <td style={{ padding: "8px 12px" }}>{formatCompactNumber(step.inferredUsers)}</td>
                                      <td style={{ padding: "8px 12px" }}>{formatCompactNumber(step.excludedUsers)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ fontSize: 12, color: "#a6afa8", marginBottom: 6 }}>Data quality warnings</div>
                                {engagementAnalytics.debug.dataQualityWarnings.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d8d1c3", fontSize: 12, lineHeight: 1.7 }}>
                                    {engagementAnalytics.debug.dataQualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                                  </ul>
                                ) : (
                                  <p style={{ margin: 0, fontSize: 12, color: "#d8d1c3" }}>No warnings in this slice.</p>
                                )}
                              </div>
                              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ fontSize: 12, color: "#a6afa8", marginBottom: 6 }}>Inferred stages</div>
                                {engagementAnalytics.debug.inferredStages.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: 18, color: "#d8d1c3", fontSize: 12, lineHeight: 1.7 }}>
                                    {engagementAnalytics.debug.inferredStages.slice(0, 12).map((item) => <li key={item}>{item}</li>)}
                                  </ul>
                                ) : (
                                  <p style={{ margin: 0, fontSize: 12, color: "#d8d1c3" }}>No inferred stages in this slice.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      ) : null}

                      <article className="admin-widget admin-widget--fit">
                        <div className="admin-widget__header">
                          <h2>Guest Journey Step Definitions</h2>
                          <span>Ordered guest journey steps with inference and warnings for incomplete stage tracking.</span>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2ddd4" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                              <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Journey step</th>
                              <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Source events</th>
                              <th style={{ padding: "8px 12px", color: "#a6afa8", fontWeight: 600 }}>Current guests</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(engagementAnalytics?.funnel ?? [
                              { key: "viewed_dinner", label: "Viewed Dinner", users: 0 },
                              { key: "selected_package", label: "Selected Package", users: 0 },
                              { key: "started_application", label: "Started Application", users: 0 },
                              { key: "submitted_application", label: "Submitted Application", users: 0 },
                              { key: "approved", label: "Approved", users: 0 },
                              { key: "paid", label: "Paid", users: 0 },
                              { key: "attended", label: "Attended", users: 0 },
                            ]).map((step) => {
                              const eventMap: Record<string, string> = {
                                viewed_dinner: "viewed_dinner, landing_dinner_viewed, opened_tickets",
                                selected_package: "selected_package, landing_package_selected",
                                started_application: "clicked_apply, landing_form_started, join_form_started",
                                submitted_application: "join_form_submitted, submitted_application, landing_dinner_selection_saved, landing_form_submitted",
                                approved: "inferred from current approved booking statuses",
                                paid: "telegram_payment_success + inferred paid statuses",
                                attended: "not yet tracked as an explicit event",
                              };
                              return (
                                <tr key={step.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                  <td style={{ padding: "8px 12px", fontWeight: 500 }}>{step.label}</td>
                                  <td style={{ padding: "8px 12px", color: "#a6afa8", fontSize: 12, fontFamily: "monospace" }}>{eventMap[step.key] ?? "—"}</td>
                                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#f5f1e8" }}>{step.users.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </article>

                      <article className="admin-widget admin-widget--fit">
                        <div className="admin-widget__header">
                          <h2>Collection Layer Status</h2>
                          <span>Known gaps in event collection across Telegram bot and Landing page.</span>
                        </div>
                        <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#c8c4bc", fontSize: 13, lineHeight: 1.9 }}>
                          <li><strong style={{ color: "#4ade80" }}>Landing UTM</strong> — captured from entry URL, session-persisted. All landing events carry utm_source, utm_medium, utm_campaign, utm_content, utm_term.</li>
                          <li><strong style={{ color: "#4ade80" }}>Landing user identity</strong> — anonymous: session_key per tab. Identified: user_key set after join form submit.</li>
                          <li><strong style={{ color: "#fbbf24" }}>Telegram event_key</strong> — never set. Every Telegram event bypasses the (source, event_key) UNIQUE deduplication index. Bot restarts can produce duplicate rows.</li>
                          <li><strong style={{ color: "#fbbf24" }}>Cross-channel identity</strong> — same person using both Telegram and Landing appears as two separate actors (different user_key formats). No stitching implemented.</li>
                          <li><strong style={{ color: "#fbbf24" }}>Payment events</strong> — only <code style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "0 4px" }}>telegram_payment_success</code> is tracked. Landing has no payment event. Conversion rate cross-mixes Telegram payments with cross-source applications.</li>
                          <li><strong style={{ color: "#ef4444" }}>Telegram event queue</strong> — capacity 512. Events silently dropped on overflow (warning logged). High-volume campaign delivery can exhaust the queue.</li>
                          <li><strong style={{ color: "#a6afa8" }}>Journey ordering</strong> — historically this was not enforced. Older data may still contain guests who appear at a later step without a recorded dinner view event.</li>
                        </ul>
                      </article>
                    </section>
                  )}
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

                      {usersSource === "landing" ? (
                        <>
                          <div className="admin-users__filter-group" role="group" aria-label="Selection status filter">
                            <span className="admin-users__filter-group-label">Selection</span>
                            <div className="admin-users__filter-buttons">
                              {landingSelectionFilterOptions.map((option) => (
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
                          <div className="admin-users__filter-group" role="group" aria-label="Review status filter">
                            <span className="admin-users__filter-group-label">Review</span>
                            <div className="admin-users__filter-buttons">
                              {landingReviewFilterOptions.map((option) => (
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
                        </>
                      ) : (
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
                      )}
                    </AdminFilterBar>
                    {usersError ? <p className="admin-auth__error">{usersError}</p> : null}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>{usersSource === "landing" ? "Landing Guest CRM" : "Telegram Guest CRM"}</h2>
                      <span>
                        {guestCrmRows.length} loaded
                        {usersSource === "landing"
                          ? ` of ${landingUsersSummary.total} total`
                          : ` of ${telegramUsersSummary.total} total`}
                      </span>
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
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Payments — not tracked for landing users">Payments</span>
                                    <span style={{ opacity: 0.5 }}><AdminBadge>{item.paidStatusLabel || "Not tracked"}</AdminBadge></span>
                                  </div>
                                </div>

                                <div className="admin-landing-crm-card__activity">
                                  <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Last record update — includes admin edits">Last Updated</span>
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
                                      <h3>Status Snapshot</h3>
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                        {item.snapshotLines.map((line) => (
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
                            <col style={{ width: "130px" }} />
                            <col style={{ width: "72px" }} />
                            <col style={{ width: "72px" }} />
                            <col style={{ width: "86px" }} />
                            <col style={{ width: "130px" }} />
                            <col style={{ width: "110px" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th className="admin-guest-crm__col admin-guest-crm__col--guest admin-tooltip-target" data-tooltip="Guest name and last booking status">Guest</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--payments admin-tooltip-target" data-tooltip="Total payments from bot counter">Payments</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-tooltip-target" data-tooltip="Total applications (all statuses)">Apps</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-tooltip-target" data-tooltip="Confirmed paid bookings (live from package_info)">Paid</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--metric admin-guest-crm__col--attendance admin-tooltip-target" data-tooltip="Bot-maintained attendance counter">Attended</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--activity admin-tooltip-target" data-tooltip="Most recent registration or record update">Last Updated</th>
                              <th className="admin-guest-crm__col admin-guest-crm__col--actions admin-tooltip-target" data-tooltip="View full guest detail">Detail</th>
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
                                  {item.phone !== "—" ? <div className="admin-users__cell-sub">{item.phone}</div> : null}
                                </td>
                                <td className="admin-guest-crm__cell" data-label="Payments">
                                  {item.totalPayments === null ? "—" : formatCurrency(item.totalPayments)}
                                </td>
                                <td className="admin-guest-crm__cell" data-label="Apps">{formatNullableCount(item.applicationsCount)}</td>
                                <td className="admin-guest-crm__cell" data-label="Paid">{formatNullableCount(item.paidBookingsCount)}</td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--attendance" data-label="Attended">{formatNullableCount(item.attendanceCount)}</td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--activity" data-label="Last Updated">
                                  <div className="admin-users__cell-title">{formatDateLabel(item.lastActivityAt)}</div>
                                </td>
                                <td className="admin-guest-crm__cell admin-guest-crm__cell--actions" data-label="Detail">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => setExpandedGuestKey((prev) => (prev === item.key ? null : item.key))}
                                    aria-expanded={isExpanded}
                                    aria-controls={`guest-crm-detail-${item.key}`}
                                  >
                                    {isExpanded ? "Close" : "View"}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="admin-guest-crm__detail-row" id={`guest-crm-detail-${item.key}`}>
                                  <td colSpan={7} className="admin-guest-crm__detail-cell">
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
                                        <h3>Status Snapshot</h3>
                                        <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                          {item.snapshotLines.map((line) => (
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
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Current Status">Status</span>
                                    <AdminBadge tone={getTelegramStatusSummary(item.rawStatus)[0]?.tone ?? "default"}>
                                      {item.statusLabel || "No status"}
                                    </AdminBadge>
                                  </div>
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Total payments from bot counter">Payments</span>
                                    <strong>{item.totalPayments === null ? "—" : formatCurrency(item.totalPayments)}</strong>
                                    <span>{item.paidStatusLabel || "Unpaid"}</span>
                                  </div>
                                  <div className="admin-guest-crm-card__metric">
                                    <span className="admin-landing-crm-card__metric-label admin-tooltip-target" data-tooltip="Most recent registration or record update">Last Updated</span>
                                    <strong>{formatDateLabel(item.lastActivityAt)}</strong>
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
                                    {isExpanded ? "Close" : "View"}
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
                                      <h3>Status Snapshot</h3>
                                      <div className="admin-guest-crm__detail-list admin-guest-crm__detail-list--timeline">
                                        {item.snapshotLines.map((line) => (
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
                                  <div className="admin-users__cell-head admin-telegram-booking-card__header-main">
                                    <div className="admin-users__cell-title">{guestName}</div>
                                    <span className="admin-telegram-booking-card__code">{item.publicCode || `#${item.packageInfoId}`}</span>
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
                      <div className="admin-telegram-booking-list admin-landing-booking-list" role="list" aria-label="Bookings list">
                        {landingUsers.map((item) => {
                          const isExpanded = expandedLandingBookingId === item.id;
                          const bookingCode = `LAND-${item.id.slice(0, 8).toUpperCase()}`;
                          const reviewSummary = getLandingAdminStatusSummary(item.adminStatus);
                          const selectionSummary = getLandingSelectionSummary(item.selectionStatus);
                          const dinnerCapacity = item.dinnerId ? dinnersById.get(item.dinnerId) : undefined;
                          const capacityDetail = getDinnerCapacityDetail(
                            dinnerCapacity?.alreadyRegistered,
                            dinnerCapacity?.places,
                            dinnerCapacity?.activeBookings
                          );
                          return (
                            <article
                              key={item.id}
                              className={`admin-telegram-booking-card admin-landing-booking-card ${isExpanded ? "admin-telegram-booking-card--expanded" : ""}`}
                              role="listitem"
                            >
                              <div className="admin-telegram-booking-card__line admin-telegram-booking-card__line--top">
                                <div className="admin-telegram-booking-card__identity">
                                  <div className="admin-users__cell-head admin-telegram-booking-card__header-main">
                                    <div className="admin-users__cell-title">{item.fullName}</div>
                                    <span className="admin-telegram-booking-card__code">{bookingCode}</span>
                                  </div>
                                </div>
                                <div className="admin-telegram-booking-card__header-action">
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle"
                                    onClick={() => openLandingBookingManager(item)}
                                  >
                                    Manage
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-guest-crm__toggle admin-guest-crm__toggle--ghost"
                                    onClick={() => toggleLandingBookingExpanded(item.id)}
                                    aria-expanded={isExpanded}
                                    aria-controls={`landing-booking-details-${item.id}`}
                                  >
                                    {isExpanded ? "Hide details" : "Details"}
                                  </button>
                                  {selectionStatusSaving[item.id] ? <span className="admin-users__status-saving">Saving override...</span> : null}
                                </div>
                              </div>

                              <div className="admin-telegram-booking-card__line admin-telegram-booking-card__line--summary">
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Dinner</span>
                                  <strong>{item.dinnerTitle || "No dinner selected"}</strong>
                                  <span>{item.dinnerId ? `Dinner #${item.dinnerId}` : "Awaiting dinner choice"}</span>
                                </div>
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Package</span>
                                  <strong>{item.chosenPackage || "Unselected"}</strong>
                                  <span>{`${item.guestCount} guests`}</span>
                                </div>
                                <div className="admin-telegram-booking-card__summary-item">
                                  <span className="admin-telegram-booking-card__label">Guest contact</span>
                                  <strong>{item.email || "No email"}</strong>
                                  <span>{item.phone || "No phone"}</span>
                                </div>
                              </div>

                              <div className="admin-telegram-booking-card__statuses" aria-label={`Booking status summary for ${bookingCode}`}>
                                <AdminBadge tone={reviewSummary.tone}>
                                  <span className="admin-telegram-bookings__summary-badge" title={`${reviewSummary.fullLabel}: ${reviewSummary.value}. ${reviewSummary.description}`}>
                                    Review {reviewSummary.value}
                                  </span>
                                </AdminBadge>
                                <AdminBadge tone={selectionSummary.tone}>
                                  <span className="admin-telegram-bookings__summary-badge" title={`${selectionSummary.fullLabel}: ${selectionSummary.value}. ${selectionSummary.description}`}>
                                    Selection {selectionSummary.value}
                                  </span>
                                </AdminBadge>
                                <AdminBadge tone={item.chosenPackage ? getPackageTone(item.chosenPackage) : "default"}>
                                  <span className="admin-telegram-bookings__summary-badge">Package {item.chosenPackage || "Unselected"}</span>
                                </AdminBadge>
                              </div>

                              <div
                                id={`landing-booking-details-${item.id}`}
                                className={`admin-telegram-booking-card__details ${isExpanded ? "admin-telegram-booking-card__details--open" : ""}`}
                              >
                                <div className="admin-telegram-booking-card__details-inner">
                                  <div className="admin-telegram-booking-card__body">
                                    <div className="admin-telegram-booking-card__block">
                                      <span className="admin-telegram-booking-card__label">Dinner details</span>
                                      <strong>{item.dinnerTitle || "No dinner selected"}</strong>
                                      <span>{item.dinnerId ? `Dinner #${item.dinnerId}` : "Awaiting dinner choice"}</span>
                                      <span>{item.chosenPackage ? `Package ${item.chosenPackage}` : "No package selected yet"}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block">
                                      <span className="admin-telegram-booking-card__label">Capacity</span>
                                      <strong>{capacityDetail.message}</strong>
                                      <span>{capacityDetail.available ? `Bookings: ${capacityDetail.activeBookings} · Guests: ${capacityDetail.occupiedGuests}` : "Bookings and guest counts unavailable"}</span>
                                      <span>{capacityDetail.supporting}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block admin-telegram-booking-card__block--note">
                                      <span className="admin-telegram-booking-card__label">Guest profile</span>
                                      <strong>{item.email || "No email saved"}</strong>
                                      <span>{`Phone ${item.phone || "—"} · Guests ${item.guestCount}`}</span>
                                      <span>{`Hobbies ${item.hobbies || "—"} · Allergies ${item.allergies || "—"}`}</span>
                                    </div>
                                    <div className="admin-telegram-booking-card__block admin-telegram-booking-card__block--meta">
                                      <span className="admin-telegram-booking-card__label">Additional metadata</span>
                                      <strong>{formatLandingAdminStatus(item.adminStatus)}</strong>
                                      <span>{`Selection ${formatLandingSelectionStatus(item.selectionStatus)}`}</span>
                                      <span>{`Created ${formatDateLabel(item.createdAt)} · Updated ${formatDateLabel(item.updatedAt)}`}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}

                    {(bookingsSource === "telegram" ? telegramApplications.length > 0 : landingUsers.length > 0) ? (
                      <div className="admin-users__footer">
                        <button className="admin-toolbar__btn" type="button" onClick={handleLoadMoreBookings} disabled={!bookingsHasMore || usersLoading}>
                          {usersLoading ? "Loading..." : bookingsHasMore ? "Load more bookings" : "No more bookings"}
                        </button>
                      </div>
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
                      onOpenGroup={handleOpenAuditGroup}
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

                        {dishesLoading ? <p className="admin-dashboard__state">Loading dishes...</p> : null}

                        {!dishesLoading && dishCards.length === 0 ? (
                          <AdminEmptyState
                            compact
                            title="No dishes found"
                            description="Choose a dish type or add the first dish for this category."
                          />
                        ) : null}

                        {!dishesLoading && dishCards.length > 0 ? (
                          <div className="admin-dish-grid">
                            {dishCards.map((item) => (
                              <article key={item.id} className="admin-dish-card">
                                <div className="admin-dish-card__head">
                                  <div className="admin-dish-card__copy">
                                    <span className="admin-dish-card__eyebrow">Dish #{item.id}</span>
                                    <strong className="admin-dish-card__title">{item.nameEng}</strong>
                                  </div>
                                  <AdminBadge tone="gold">{formatCurrency(item.price)}</AdminBadge>
                                </div>
                                <div className="admin-dish-card__meta">
                                  <span title={item.nameRus}>RU: {item.nameRus}</span>
                                  <span title={item.nameArm}>AM: {item.nameArm}</span>
                                  <span title={item.dishType}>Type: {item.dishType}</span>
                                </div>
                                <div className="admin-dish-card__actions">
                                  <button
                                    className="admin-toolbar__btn admin-toolbar__btn--info"
                                    type="button"
                                    onClick={() => handleEditDish(item)}
                                    disabled={dishSaving || dishDeleting}
                                  >
                                    Edit Dish
                                  </button>
                                  <button
                                    className="admin-toolbar__btn admin-toolbar__btn--danger"
                                    type="button"
                                    onClick={() => setDishDeleteTarget(item)}
                                    disabled={dishSaving || dishDeleting}
                                  >
                                    Delete Dish
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}

                        <div className="admin-widget__header" style={{ marginTop: 18 }}>
                          <h2>{editingDishId ? `Edit dish #${editingDishId}` : "Add new dish"}</h2>
                          <span>{editingDishId ? "Update names, type, and price" : "Visible in Telegram bot"}</span>
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
                            <button className="admin-toolbar__btn" type="button" onClick={handleCreateDish} disabled={dishSaving || dishDeleting}>
                              {dishSaving ? "Saving..." : editingDishId ? "Save dish changes" : "Create dish"}
                            </button>
                            {editingDishId ? (
                              <button className="admin-toolbar__btn" type="button" onClick={handleCancelDishEdit} disabled={dishSaving || dishDeleting}>
                                Cancel edit
                              </button>
                            ) : null}
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
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleApplyAuditFilters();
                      }}
                    >
                      <AdminFilterBar className="admin-users__controls admin-audit-log__filters">
                        <div className="admin-topbar__search admin-audit-log__search">
                          <span aria-hidden="true">⌕</span>
                          <input
                            value={auditSearchInput}
                            onChange={(event) => setAuditSearchInput(event.target.value)}
                            placeholder="Search booking code, entity ID, reason, status JSON..."
                          />
                        </div>
                        <label className="admin-users__filter">
                          <span>Entity</span>
                          <select value={auditEntityTypeDraft} onChange={(event) => setAuditEntityTypeDraft(event.target.value)}>
                            {auditEntityTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-users__filter">
                          <span>Action</span>
                          <select value={auditActionTypeDraft} onChange={(event) => setAuditActionTypeDraft(event.target.value)}>
                            {auditActionTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-users__filter">
                          <span>Reason</span>
                          <select value={auditReasonStateDraft} onChange={(event) => setAuditReasonStateDraft(event.target.value as "all" | "with_reason" | "without_reason")}>
                            {auditReasonStateOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-users__filter admin-audit-log__admin-filter">
                          <span>Admin</span>
                          <input
                            className="admin-dinner-input"
                            value={auditAdminInput}
                            onChange={(event) => setAuditAdminInput(event.target.value)}
                            placeholder="Username"
                          />
                        </label>
                        <div className="admin-audit-log__actions">
                          <button className="admin-toolbar__btn admin-toolbar__btn--info" type="submit">
                            Search
                          </button>
                          <button className="admin-toolbar__btn" type="button" onClick={handleResetAuditFilters}>
                            Reset
                          </button>
                        </div>
                      </AdminFilterBar>
                    </form>
                    {auditFocusedLogs && auditFocusedLogs.length > 0 ? (
                      <article className="admin-audit-log__focus">
                        <div className="admin-widget__header admin-audit-log__focus-header">
                          <div>
                            <h2>Focused Group</h2>
                            <span>{auditFocusedLabel || "Ungrouped audit history"}</span>
                          </div>
                          <button className="admin-toolbar__btn" type="button" onClick={handleClearAuditFocus}>
                            Clear Focus
                          </button>
                        </div>
                        <AuditTimelineList
                          logs={auditFocusedLogs}
                          groupEvents={false}
                          emptyTitle="No actions in this group"
                          emptyDescription="This grouped event does not have any individual audit rows to show."
                        />
                      </article>
                    ) : null}
                    <AuditTimelineList
                      logs={auditLogs}
                      emptyTitle="No audit activity yet"
                      emptyDescription="As admins update bookings, dinners, and runtime controls, the operational audit trail will appear here."
                      onOpenGroup={handleOpenAuditGroup}
                    />
                    {auditLogs.length > 0 ? (
                      <div className="admin-users__footer">
                        <button className="admin-toolbar__btn" type="button" onClick={handleLoadMoreAuditLogs} disabled={!auditHasMore || auditLoading}>
                          {auditLoading ? "Loading..." : auditHasMore ? "Load more audit entries" : "No more audit entries"}
                        </button>
                      </div>
                    ) : null}
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

          {dishDeleteTarget ? (
            <div
              className="admin-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm dish deletion"
              onClick={(event) => {
                if (event.target === event.currentTarget && !dishDeleting) {
                  setDishDeleteTarget(null);
                }
              }}
            >
              <article className="admin-modal admin-modal--danger">
                <button
                  className="admin-modal__close"
                  type="button"
                  onClick={() => setDishDeleteTarget(null)}
                  disabled={dishDeleting}
                  aria-label="Close dish delete confirmation"
                >
                  x
                </button>
                <p className="admin-modal__eyebrow">Delete Dish</p>
                <h3>Remove dish #{dishDeleteTarget.id}?</h3>
                <p className="admin-modal__text">
                  This dish will be removed from the Telegram custom menu catalog.
                </p>
                <div className="admin-modal__detail">
                  <b>{dishDeleteTarget.nameEng}</b>
                  <span>
                    {dishDeleteTarget.dishType} · {formatCurrency(dishDeleteTarget.price)}
                  </span>
                </div>
                <div className="admin-modal__actions">
                  <button
                    className="admin-toolbar__btn"
                    type="button"
                    onClick={() => setDishDeleteTarget(null)}
                    disabled={dishDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="admin-toolbar__btn admin-toolbar__btn--danger"
                    type="button"
                    onClick={confirmDeleteDish}
                    disabled={dishDeleting}
                  >
                    {dishDeleting ? "Deleting..." : "Delete Dish"}
                  </button>
                </div>
              </article>
            </div>
          ) : null}

        </div>
      </div>
      {bookingManagerModal}
      {landingBookingManagerModal}
    </section>
  );
}
