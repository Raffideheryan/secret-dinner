import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  createAdminDinner,
  deleteAdminDinner,
  getAdminLandingUsers,
  getAdminTelegramUsers,
  getAdminDinners,
  getAdminPanel,
  syncAdminDinners,
  type AdminDinner,
  type AdminLandingUser,
  type AdminLandingUsersSummary,
  type AdminSettingsPayload,
  type AdminPanelResponse,
  type AdminTelegramUser,
  type AdminTelegramUsersSummary,
  updateAdminLandingUserStatus,
  updateAdminSettings,
  updateAdminDinner,
} from "../../admin/api";
import "./admin.css";

type AdminSection = "dashboard" | "landing" | "telegram" | "insights" | "users" | "dinners" | "settings";
type PackageBar = { label: string; value: number; height: number };
type MetricItem = { label: string; value: string; hint?: string };
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

const sectionLabels: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  landing: "Landing",
  telegram: "Telegram",
  insights: "Insights",
  users: "Users",
  dinners: "Dinners",
  settings: "Settings",
};

const sectionHints: Record<AdminSection, string> = {
  dashboard: "High-level overview of landing and Telegram performance.",
  landing: "Landing funnel, conversion, and application behavior trends.",
  telegram: "Telegram service health, users, and revenue activity.",
  insights: "Deep analytical charts for timing, demand, and risk patterns.",
  users: "User-level monitoring and status operations.",
  dinners: "Dinner catalog management across both landing and Telegram.",
  settings: "Runtime controls, rate limits, and operational switches.",
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
const USERS_PAGE_SIZE = 30;

const metricHints: Record<string, string> = {
  "Landing applications": "Total join form submissions from the landing website.",
  "Selection completion": "Percent of users who finished both steps: profile + dinner/package selection.",
  "Landing conversion": "How many submitted users completed selection compared to all submissions.",
  "Active landing dinners": "Landing dinners that are not expired and still upcoming.",
  "Telegram users": "Total users recorded in the Telegram service database.",
  "Telegram revenue": "Total paid revenue from Telegram registrations.",
  "Orders last 24h": "Number of Telegram registrations created in the last 24 hours.",
  "Total users": "Unique users stored in this data source.",
  "Completed selections": "Landing users with both dinner and package selected.",
  "Pending selections": "Landing users who submitted step 1 but did not finish selection.",
  "Distinct dinner picks": "How many different dinners were chosen by landing users.",
  "Average guests per form": "Average value of guest_count in landing applications.",
  "Average time to select": "Average hours between step 1 submit and dinner/package selection.",
  "Selections last 24h": "Users who completed dinner/package selection in the last 24 hours.",
  "Flow conversion %": "Completion ratio from application submitted to full selection.",
  "Potential revenue": "Estimated revenue using selected package prices on current selections.",
  "Latest application": "Most recent landing form submission timestamp.",
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
  "Join applications": "Controls whether step-1 join form submissions are accepted.",
  "Join selections": "Controls whether step-2 dinner/package selections are accepted.",
  "Min fill duration": "Minimum time (ms) user must spend before form submit is accepted.",
  "Selection P50": "Median time from first form submit to dinner/package selection.",
  "Selection P90": "90th percentile of time to complete dinner/package selection.",
  "Top email domain": "Most common domain among submitted landing emails.",
  "Weekend share": "Share of landing submissions happening on Saturday and Sunday.",
  "Hourly telegram orders": "Registrations created in Telegram in the last 24 hours.",
  "Top package revenue": "Package that generated the highest Telegram revenue.",
  "Overbooked dinners": "Telegram dinners where registrations exceed listed places.",
  "Top fill band": "Most common occupancy level across Telegram dinners.",
  "Landing users total": "Total users captured from landing join flow.",
  "Completed": "Landing users who finished dinner and package selection.",
  "Open selections": "Landing users who still need to finish selection.",
  "Telegram users total": "Total users in telegram service database.",
  "Paying users": "Telegram users with total payments above zero.",
  "Login rate limit": "Maximum login attempts per minute per IP.",
  "Join form limit": "Maximum first-step form submissions per IP in 20 minutes.",
  "Join selection limit": "Maximum selection submissions per IP in 20 minutes.",
  "Panel auto-refresh": "Admin page auto-refresh interval in seconds. 0 disables auto-refresh.",
  "Users page size": "Maximum users returned per page for users monitoring lists.",
  "Dinner mutations": "Controls whether admins can create, edit, delete, or sync dinners.",
  "User status edits": "Controls whether admins can change landing user selection status.",
};

const landingSelectionStatusOptions: Array<{
  value: AdminLandingUser["selectionStatus"];
  label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
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
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const [dinners, setDinners] = useState<AdminDinner[]>([]);
  const [dinnersLoading, setDinnersLoading] = useState(false);
  const [dinnerFormOpen, setDinnerFormOpen] = useState(false);
  const [dinnerSaving, setDinnerSaving] = useState(false);
  const [dinnerFormError, setDinnerFormError] = useState("");
  const [dinnerForm, setDinnerForm] = useState<DinnerFormState>(emptyDinnerForm);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [usersSource, setUsersSource] = useState<UsersSource>("landing");
  const [usersStatus, setUsersStatus] = useState("all");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [landingUsers, setLandingUsers] = useState<AdminLandingUser[]>([]);
  const [telegramUsers, setTelegramUsers] = useState<AdminTelegramUser[]>([]);
  const [selectionStatusSaving, setSelectionStatusSaving] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    void loadPanel();
  }, []);

  useEffect(() => {
    if (activeSection === "dinners") {
      void loadDinners();
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "users") {
      return;
    }
    setUsersOffset(0);
    void loadUsers(false);
  }, [activeSection, usersSource, usersStatus, searchQuery]);

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
      if (activeSection === "users") {
        setUsersOffset(0);
        void loadUsers(false);
        return;
      }
      void loadPanel(true);
    }, intervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [data?.settings.runtime.panelAutoRefreshSeconds, activeSection, usersSource, usersStatus, searchQuery]);

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
    if (activeSection === "users") {
      setUsersOffset(0);
      await loadUsers(false);
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

  const handleDeleteDinner = async (item: AdminDinner) => {
    const confirmed = window.confirm(`Delete dinner #${item.id}?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteAdminDinner(item.id);
      await Promise.all([loadDinners(), loadPanel(true)]);
      setInfoMessage(`Dinner #${item.id} deleted`);
      window.setTimeout(() => setInfoMessage(""), 1500);
    } catch (err) {
      setDinnerFormError(err instanceof Error ? err.message : "failed to delete dinner");
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

  const landingFlowHeatmap = useMemo(() => {
    const max = Math.max(
      1,
      ...landingDailyTrendBars.map((point) => point.primary),
      ...landingDailyTrendBars.map((point) => point.secondary)
    );
    return landingDailyTrendBars.map((point) => ({
      ...point,
      primaryIntensity: point.primary / max,
      secondaryIntensity: point.secondary / max,
    }));
  }, [landingDailyTrendBars]);

  const landingFlowSummary = useMemo(() => {
    const submissions = landingDailyTrendBars.reduce((sum, point) => sum + point.primary, 0);
    const selections = landingDailyTrendBars.reduce((sum, point) => sum + point.secondary, 0);
    return {
      submissions,
      selections,
      conversion: submissions > 0 ? (selections / submissions) * 100 : 0,
    };
  }, [landingDailyTrendBars]);

  const landingHourlyHeatmap = useMemo(() => {
    const max = Math.max(1, ...landingHourlyBars.map((point) => point.value));
    return landingHourlyBars.map((point, index) => ({
      ...point,
      index,
      intensity: point.value / max,
    }));
  }, [landingHourlyBars]);

  const landingPeakHour = useMemo(() => {
    if (landingHourlyBars.length === 0) {
      return "—";
    }
    const peak = landingHourlyBars.reduce((best, point) => (point.value > best.value ? point : best), landingHourlyBars[0]);
    return `${peak.label}:00`;
  }, [landingHourlyBars]);

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

  const currentUsers = usersSource === "landing" ? landingUsers : telegramUsers;
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

  const query = searchQuery.trim().toLowerCase();
  const matches = (label: string) => (query === "" ? true : label.toLowerCase().includes(query));
  const filterItems = (items: MetricItem[]) => items.filter((item) => matches(item.label));

  const completionDonutStyle = {
    background: `conic-gradient(#d4af37 0 ${completionPercent}%, #1f7a5c ${completionPercent}% 100%)`,
  };

  const dinnerRegistrationsTotal = dinners.reduce((sum, item) => sum + item.alreadyRegistered, 0);
  const activeDinnersCount = dinners.filter((item) => !item.expired).length;
  const topDomain = landing?.topEmailDomains?.[0]?.label ?? "—";
  const weekendSubmissions = (landing?.weekdaySubmissions ?? [])
    .filter((item) => item.label === "Sat" || item.label === "Sun")
    .reduce((sum, item) => sum + item.count, 0);
  const weekdaySubmissionsTotal = (landing?.weekdaySubmissions ?? []).reduce((sum, item) => sum + item.count, 0);
  const weekendShare = weekdaySubmissionsTotal > 0 ? (weekendSubmissions / weekdaySubmissionsTotal) * 100 : 0;
  const topRevenuePackage = packageRevenueRows[0]?.label ?? "—";
  const overbookedCount = dinnerFillBandRows.find((item) => item.label === "Overbooked")?.count ?? 0;
  const topFillBand = dinnerFillBandRows[0]?.label ?? "—";

  const sectionMetrics: Record<AdminSection, MetricItem[]> = {
    dashboard: filterItems([
      { label: "Landing applications", value: `${totalUsers}` },
      { label: "Selection completion", value: `${completionPercent}%` },
      { label: "Landing conversion", value: `${(landing?.conversionPercent ?? 0).toFixed(1)}%` },
      { label: "Active landing dinners", value: `${landing?.activeDinners ?? 0}` },
      { label: "Telegram users", value: `${telegramStats?.totalUsers ?? 0}` },
      { label: "Telegram revenue", value: `${telegramStats?.revenueTotal.toFixed(2) ?? "0.00"}` },
      { label: "Orders last 24h", value: `${telegramStats?.orders24h ?? 0}` },
    ]),
    landing: filterItems([
      { label: "Total users", value: `${landing?.totalUsers ?? 0}` },
      { label: "Completed selections", value: `${landing?.completedSelections ?? 0}` },
      { label: "Pending selections", value: `${landing?.pendingSelections ?? 0}` },
      { label: "Distinct dinner picks", value: `${landing?.selectedDinners ?? 0}` },
      { label: "Average guests per form", value: `${(landing?.avgGuestsPerUser ?? 0).toFixed(2)}` },
      { label: "Average time to select", value: `${(landing?.avgSelectionHours ?? 0).toFixed(1)} h` },
      { label: "Selections last 24h", value: `${landing?.recentSelections24h ?? 0}` },
      { label: "Flow conversion %", value: `${(landing?.conversionPercent ?? 0).toFixed(1)}%` },
      { label: "Potential revenue", value: `${(landing?.potentialRevenue ?? 0).toFixed(2)}` },
      { label: "Latest application", value: formatDateLabel(landing?.latestApplicationAt) },
    ]),
    telegram: filterItems([
      { label: "Total users", value: `${telegramStats?.totalUsers ?? 0}` },
      { label: "Terms accepted", value: `${telegramStats?.acceptedTermsUsers ?? 0}` },
      { label: "Terms acceptance %", value: `${(telegramStats?.termsAcceptancePct ?? 0).toFixed(1)}%` },
      { label: "Users with phone", value: `${telegramStats?.usersWithPhone ?? 0}` },
      { label: "Phone coverage %", value: `${(telegramStats?.phoneCoveragePct ?? 0).toFixed(1)}%` },
      { label: "Referral coverage %", value: `${(telegramStats?.referralCoveragePct ?? 0).toFixed(1)}%` },
      { label: "Blocked rate %", value: `${(telegramStats?.blockedRatePct ?? 0).toFixed(1)}%` },
      { label: "Revenue 24h", value: `${(telegramStats?.revenue24h ?? 0).toFixed(2)}` },
      { label: "Orders 24h", value: `${telegramStats?.orders24h ?? 0}` },
      { label: "Users with payments", value: `${telegramStats?.usersWithPayments ?? 0}` },
      { label: "Average order value", value: `${(telegramStats?.avgOrderValue ?? 0).toFixed(2)}` },
      { label: "Blocked active", value: `${telegramStats?.blockedActive ?? 0}` },
      { label: "Next dinner", value: formatDateLabel(telegramStats?.nextDinnerDate) },
    ]),
    insights: filterItems([
      { label: "Selection P50", value: `${(landing?.selectionP50Hours ?? 0).toFixed(1)} h` },
      { label: "Selection P90", value: `${(landing?.selectionP90Hours ?? 0).toFixed(1)} h` },
      { label: "Top email domain", value: topDomain },
      { label: "Weekend share", value: `${weekendShare.toFixed(1)}%` },
      { label: "Hourly telegram orders", value: `${telegramHourlyRegistrationsBars.reduce((sum, item) => sum + item.value, 0)}` },
      { label: "Top package revenue", value: topRevenuePackage },
      { label: "Overbooked dinners", value: `${overbookedCount}` },
      { label: "Top fill band", value: topFillBand },
    ]),
    users: filterItems(usersSummaryCards),
    dinners: filterItems([
      { label: "Total dinners", value: `${dinners.length}` },
      { label: "Active dinners", value: `${activeDinnersCount}` },
      { label: "Total registrations", value: `${dinnerRegistrationsTotal}` },
      { label: "Telegram DB configured", value: settings.telegramDatabaseConfigured ? "true" : "false" },
    ]),
    settings: filterItems([
      { label: "Admin user", value: meta.username ?? "—" },
      { label: "Frontend origin", value: settings.frontendOrigin || "—" },
      { label: "Listen address", value: settings.listenAddr || "—" },
      { label: "Cookie secure", value: settings.adminCookieSecure ? "true" : "false" },
      { label: "Admin token TTL", value: `${settings.adminTokenTTLMinutes ?? 0} min` },
      { label: "Telegram DB configured", value: settings.telegramDatabaseConfigured ? "true" : "false" },
      { label: "Maintenance mode", value: settings.runtime.maintenanceMode ? "enabled" : "disabled" },
      { label: "Join applications", value: settings.runtime.allowJoinApplications ? "enabled" : "disabled" },
      { label: "Join selections", value: settings.runtime.allowJoinSelections ? "enabled" : "disabled" },
      { label: "Min fill duration", value: `${settings.runtime.minJoinFormFillDurationMs ?? 0} ms` },
      { label: "Login rate limit", value: `${settings.rateLimits.adminLoginPerMinute ?? 0}/min` },
      { label: "Join form limit", value: `${settings.rateLimits.joinFormPer20MinByIP ?? 0}/20m` },
      { label: "Join selection limit", value: `${settings.rateLimits.joinSelectionPer20MinByIP ?? 0}/20m` },
      { label: "Panel auto-refresh", value: `${settings.runtime.panelAutoRefreshSeconds ?? 0}s` },
      { label: "Users page size", value: `${settings.runtime.adminUsersPageSize ?? USERS_PAGE_SIZE}` },
      { label: "Dinner mutations", value: settings.runtime.allowAdminDinnerMutations ? "enabled" : "disabled" },
      { label: "User status edits", value: settings.runtime.allowAdminUserStatusEdits ? "enabled" : "disabled" },
    ]),
  };

  return (
    <section className="admin-panel admin-dashboard">
      <div className="admin-dashboard__layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar__brand">
            <span className="admin-sidebar__dot" />
            Secret Dinner
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
                {sectionLabels[section]}
              </button>
            ))}
          </nav>

          <button className="admin-panel__logout admin-sidebar__logout" onClick={handleLogout} type="button">
            Logout
          </button>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <p className="admin-topbar__title">{sectionLabels[activeSection]}</p>
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
            <p className="admin-topbar__date">{dashboardDate}</p>
            <button className="admin-panel__logout admin-topbar__logout" onClick={handleLogout} type="button">
              Logout
            </button>
          </header>

          <div className="admin-toolbar">
            <button
              className="admin-toolbar__btn"
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing || dinnersLoading}
              title="Reload the currently active section data."
            >
              {refreshing || dinnersLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="admin-toolbar__btn"
              type="button"
              onClick={handleExport}
              disabled={!data}
              title="Download full current panel snapshot as JSON."
            >
              Export Snapshot
            </button>
            {activeSection === "settings" ? (
              <button
                className="admin-toolbar__btn"
                type="button"
                onClick={handleCopyFrontendOrigin}
                disabled={!data}
                title="Copy currently configured CORS frontend origin."
              >
                Copy Frontend Origin
              </button>
            ) : null}
            {activeSection === "dinners" ? (
              <>
                <button className="admin-toolbar__btn" type="button" onClick={handleStartCreateDinner} title="Create a new dinner visible in both systems.">
                  New Dinner
                </button>
                <button className="admin-toolbar__btn" type="button" onClick={handleSyncDinners} title="Recalculate dinner registration counts from source data.">
                  Sync Registrations
                </button>
              </>
            ) : null}
            <span className="admin-toolbar__meta">Generated: {formatDateLabel(meta.generatedAt)}</span>
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
                    <article
                      key={item.label}
                      className="admin-kpi admin-kpi--violet"
                      data-has-tooltip={hint ? "true" : "false"}
                      data-tooltip={hint ?? ""}
                      title={hint ?? undefined}
                      tabIndex={hint ? 0 : -1}
                    >
                      <div className="admin-kpi__label-row">
                        <p className="admin-kpi__label">{item.label}</p>
                        {hint ? (
                          <span className="admin-kpi__help" aria-hidden="true">
                            ?
                          </span>
                        ) : null}
                      </div>
                      <p className="admin-kpi__value admin-kpi__value--text">{item.value}</p>
                    </article>
                  );
                })}
              </section>

              {activeSection === "dashboard" || activeSection === "landing" ? (
                <section className="admin-widgets">
                  <article className="admin-widget admin-widget--bars">
                    <div className="admin-widget__header">
                      <h2>Landing Package Choices</h2>
                      <span>Current selections</span>
                    </div>
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
                              data-tooltip={`${item.label}: ${item.value} selections`}
                              title={`${item.label}: ${item.value}`}
                              tabIndex={0}
                              aria-label={`${item.label}: ${item.value} selections`}
                            />
                          </div>
                          <span className="admin-bars__month">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="admin-widget admin-widget--status">
                    <div className="admin-widget__header">
                      <h2>Landing Completion</h2>
                      <span>User progression</span>
                    </div>
                    <div className="admin-donut" style={completionDonutStyle} aria-hidden="true">
                      <div className="admin-donut__inner">
                        <strong>{completionPercent}%</strong>
                        <span>Completed</span>
                      </div>
                    </div>
                    <ul className="admin-legend">
                      <li>
                        <span className="admin-legend__dot admin-legend__dot--sales" />Completed <b>{completedSelections}</b>
                      </li>
                      <li>
                        <span className="admin-legend__dot admin-legend__dot--product" />Pending <b>{pendingSelections}</b>
                      </li>
                    </ul>
                  </article>
                </section>
              ) : null}

              {activeSection === "dashboard" || activeSection === "landing" ? (
                <section className="admin-analytics-grid">
                  <article className="admin-widget admin-widget--fit">
                    <div className="admin-widget__header">
                      <h2>Landing User Flow Trend</h2>
                      <span>Submissions vs completed selections (14d)</span>
                    </div>
                    {landingDailyTrendBars.length === 0 ? (
                      <p className="admin-dashboard__state">No flow data yet.</p>
                    ) : (
                      <>
                        <div className="admin-widget__explain">
                          <p>Each cell shows daily intensity. Brighter color means more activity on that day.</p>
                        </div>
                        <div className="admin-flow-heatmap" role="img" aria-label="Landing submissions and selections heatmap by day">
                          <div className="admin-flow-heatmap__row">
                            <span className="admin-flow-heatmap__label">Submitted</span>
                            <div className="admin-flow-heatmap__cells">
                              {landingFlowHeatmap.map((point) => (
                                <span
                                  key={`flow-sub-${point.label}`}
                                  className="admin-flow-cell admin-flow-cell--gold admin-tooltip-target"
                                  style={{ opacity: Math.max(point.primaryIntensity, 0.12) }}
                                  data-tooltip={`${point.label}: ${point.primary} submissions`}
                                  tabIndex={0}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="admin-flow-heatmap__row">
                            <span className="admin-flow-heatmap__label">Selected</span>
                            <div className="admin-flow-heatmap__cells">
                              {landingFlowHeatmap.map((point) => (
                                <span
                                  key={`flow-sel-${point.label}`}
                                  className="admin-flow-cell admin-flow-cell--emerald admin-tooltip-target"
                                  style={{ opacity: Math.max(point.secondaryIntensity, 0.12) }}
                                  data-tooltip={`${point.label}: ${point.secondary} selections`}
                                  tabIndex={0}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="admin-flow-heatmap__days">
                          {landingFlowHeatmap.map((point, index) => (
                            <span
                              key={`flow-day-${point.label}-${index}`}
                              className="admin-flow-heatmap__day admin-tooltip-target"
                              data-tooltip={`${point.label}: ${point.primary} submitted / ${point.secondary} selected`}
                              tabIndex={0}
                            >
                              {index % 2 === 0 ? point.label : "•"}
                            </span>
                          ))}
                        </div>
                        <div className="admin-speed-grid">
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Total landing forms submitted during this 14-day window." tabIndex={0}>
                            <span>Submissions</span>
                            <strong>{landingFlowSummary.submissions}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Users who completed dinner/package selection during this 14-day window." tabIndex={0}>
                            <span>Selections</span>
                            <strong>{landingFlowSummary.selections}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Selections divided by submissions in this chart period." tabIndex={0}>
                            <span>Flow conversion</span>
                            <strong>{landingFlowSummary.conversion.toFixed(1)}%</strong>
                          </div>
                        </div>
                      </>
                    )}
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>24h Submission Pulse</h2>
                      <span>Hourly distribution</span>
                    </div>
                    {landingHourlyBars.length === 0 ? (
                      <p className="admin-dashboard__state">No hourly data yet.</p>
                    ) : (
                      <>
                        <div className="admin-widget__explain">
                          <p>Heat tiles show submission density by hour. Brighter and warmer tiles mean busier hours.</p>
                        </div>
                        <div className="admin-hours-heatmap" role="img" aria-label="Landing hourly submissions heatmap">
                          {landingHourlyHeatmap.map((point) => (
                            <div
                              key={`hour-${point.label}-${point.index}`}
                              className={`admin-hours-heatmap__tile admin-tooltip-target ${point.label === landingPeakHour.slice(0, 2) ? "admin-hours-heatmap__tile--peak" : ""}`}
                              data-tooltip={`${point.label}:00 - ${point.value} submissions`}
                              tabIndex={0}
                              style={{
                                background: `linear-gradient(155deg, rgba(230,201,106,${Math.max(point.intensity * 0.7, 0.14)}), rgba(31,122,92,${Math.max(point.intensity * 0.8, 0.2)}))`,
                              }}
                            >
                              <span className="admin-hours-heatmap__hour">{point.label}</span>
                              <b className="admin-hours-heatmap__count">{point.value}</b>
                            </div>
                          ))}
                        </div>
                        <div className="admin-speed-grid">
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Hour with highest number of submissions in the last 24 hours." tabIndex={0}>
                            <span>Peak hour</span>
                            <strong>{landingPeakHour}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Average submissions per hour in this 24h distribution." tabIndex={0}>
                            <span>Avg/hour</span>
                            <strong>{(landingHourlyBars.reduce((sum, point) => sum + point.value, 0) / Math.max(landingHourlyBars.length, 1)).toFixed(1)}</strong>
                          </div>
                          <div className="admin-speed-pill admin-tooltip-target" data-tooltip="Total submissions represented by this hourly graph." tabIndex={0}>
                            <span>Total 24h</span>
                            <strong>{landingHourlyBars.reduce((sum, point) => sum + point.value, 0)}</strong>
                          </div>
                        </div>
                      </>
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
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Dinner</th>
                              <th>Regs</th>
                              <th>Capacity</th>
                              <th>Fill</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(landing?.topDinners ?? []).map((item) => (
                              <tr key={`landing-${item.dinnerId}`}>
                                <td>#{item.dinnerId}</td>
                                <td>{item.description}</td>
                                <td>{item.registrations}</td>
                                <td>{item.capacity}</td>
                                <td>{item.fillPercent.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>
                </section>
              ) : null}

              {activeSection === "dashboard" || activeSection === "telegram" ? (
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

              {activeSection === "dashboard" || activeSection === "telegram" ? (
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
                              <th>Regs</th>
                              <th>Capacity</th>
                              <th>Fill</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(telegramStats?.topDinners ?? []).map((item) => (
                              <tr key={`telegram-${item.dinnerId}`}>
                                <td>#{item.dinnerId}</td>
                                <td>{item.description}</td>
                                <td>{item.registrations}</td>
                                <td>{item.capacity}</td>
                                <td>{item.fillPercent.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </article>
                </section>
              ) : null}

              {activeSection === "insights" ? (
                <section className="admin-insights-grid">
                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>Conversion Funnel Intelligence</h2>
                      <span>From first submission to final dinner selection</span>
                    </div>
                    <div className="admin-funnel">
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Submitted applications</div>
                        <div className="admin-funnel__value">{totalUsers}</div>
                      </div>
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Completed selections</div>
                        <div className="admin-funnel__value">{completedSelections}</div>
                      </div>
                      <div className="admin-funnel__row">
                        <div className="admin-funnel__label">Open selections</div>
                        <div className="admin-funnel__value">{pendingSelections}</div>
                      </div>
                      <div className="admin-funnel__progress">
                        <span
                          className="admin-funnel__progress-fill"
                          style={{ width: `${completionPercent}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="admin-funnel__hint">Completion rate: {completionPercent}%</p>
                    </div>
                  </article>

                  <article className="admin-widget">
                    <div className="admin-widget__header">
                      <h2>Selection Speed</h2>
                      <span>How quickly users finish step 2</span>
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
                      <h2>Weekday Intent vs Completion</h2>
                      <span>Behavior by day of week</span>
                    </div>
                    {landingWeekdayFlowBars.length === 0 ? (
                      <p className="admin-dashboard__state">No weekday flow data yet.</p>
                    ) : (
                      <>
                        <div className="admin-chart-legend">
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--gold" />Submissions</span>
                          <span><i className="admin-chart-legend__dot admin-chart-legend__dot--emerald" />Selections</span>
                        </div>
                        <div className="admin-wave-chart" role="img" aria-label="Weekday submissions and selections trend">
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
                              data-tooltip={`${label}: ${landingWeekdayFlowBars[index]?.primary ?? 0} submissions, ${landingWeekdayFlowBars[index]?.secondary ?? 0} selections`}
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
                      <h2>Selection Delay Buckets</h2>
                      <span>Time between step 1 and step 2</span>
                    </div>
                    {landingLagBars.length === 0 ? (
                      <p className="admin-dashboard__state">No selection delay data yet.</p>
                    ) : (
                      <ul className="admin-meter-list" role="img" aria-label="Selection delay distribution">
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

              {activeSection === "users" ? (
                <section className="admin-users-layout">
                  <article className="admin-widget admin-widget--fit">
                    <div className="admin-users__controls">
                      <div className="admin-users__switch" role="tablist" aria-label="Users source">
                        <button
                          className={`admin-users__switch-btn ${usersSource === "landing" ? "admin-users__switch-btn--active" : ""}`}
                          type="button"
                          onClick={() => {
                            setUsersSource("landing");
                            setUsersStatus("all");
                          }}
                        >
                          Landing Users
                        </button>
                        <button
                          className={`admin-users__switch-btn ${usersSource === "telegram" ? "admin-users__switch-btn--active" : ""}`}
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
                              className={`admin-users__filter-btn ${usersStatus === option.value ? "admin-users__filter-btn--active" : ""}`}
                              onClick={() => setUsersStatus(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {usersError ? <p className="admin-auth__error">{usersError}</p> : null}
                  </article>

                  <article className="admin-widget admin-widget--full">
                    <div className="admin-widget__header">
                      <h2>{usersSource === "landing" ? "Landing Users Monitoring" : "Telegram Users Monitoring"}</h2>
                      <span>{currentUsers.length} loaded</span>
                    </div>

                    {usersLoading && currentUsers.length === 0 ? (
                      <p className="admin-dashboard__state">Loading users...</p>
                    ) : null}

                    {!usersLoading && currentUsers.length === 0 ? (
                      <p className="admin-dashboard__state">No users found for current filters.</p>
                    ) : null}

                    {usersSource === "landing" && currentUsers.length > 0 ? (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Contact</th>
                              <th>Guests</th>
                              <th>Dinner</th>
                              <th>Package</th>
                              <th>Selection Status</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {landingUsers.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <div className="admin-users__cell-title">{item.fullName}</div>
                                  <div className="admin-users__cell-sub">ID: {item.id.slice(0, 8)}...</div>
                                </td>
                                <td>
                                  <div className="admin-users__cell-title">{item.email}</div>
                                  <div className="admin-users__cell-sub">{item.phone}</div>
                                </td>
                                <td>{item.guestCount}</td>
                                <td>{item.dinnerTitle || "—"}</td>
                                <td>{item.chosenPackage ?? "—"}</td>
                                <td>
                                  <div className="admin-users__status-cell" role="group" aria-label={`Selection status for ${item.fullName}`}>
                                    <div className="admin-users__status-toggle">
                                      {landingSelectionStatusOptions.map((option) => (
                                        <button
                                          key={option.value}
                                          type="button"
                                          className={`admin-users__status-btn ${
                                            item.selectionStatus === option.value ? "admin-users__status-btn--active" : ""
                                          }`}
                                          onClick={() => void handleUpdateLandingUserStatus(item.id, option.value)}
                                          disabled={Boolean(selectionStatusSaving[item.id]) || item.selectionStatus === option.value}
                                          title={`Set selection status to ${option.label.toLowerCase()}`}
                                        >
                                          {option.label}
                                        </button>
                                      ))}
                                    </div>
                                    {selectionStatusSaving[item.id] ? <span className="admin-users__status-saving">Saving...</span> : null}
                                  </div>
                                </td>
                                <td>{formatDateLabel(item.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {usersSource === "telegram" && currentUsers.length > 0 ? (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Profile</th>
                              <th>Payments</th>
                              <th>Orders</th>
                              <th>Terms</th>
                              <th>Blocked</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {telegramUsers.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <div className="admin-users__cell-title">@{item.username}</div>
                                  <div className="admin-users__cell-sub">ID: {item.id}</div>
                                </td>
                                <td>
                                  <div className="admin-users__cell-title">
                                    {[item.name, item.surname].filter(Boolean).join(" ").trim() || "—"}
                                  </div>
                                  <div className="admin-users__cell-sub">{item.phone || "No phone"}</div>
                                </td>
                                <td>{item.totalPayments.toFixed(2)}</td>
                                <td>{item.ordersCount}</td>
                                <td>
                                  <span className={`admin-user-badge ${item.termsAccepted ? "admin-user-badge--ok" : "admin-user-badge--warn"}`}>
                                    {item.termsAccepted ? "accepted" : "pending"}
                                  </span>
                                </td>
                                <td>
                                  <span className={`admin-user-badge ${item.blockedActive ? "admin-user-badge--danger" : "admin-user-badge--ok"}`}>
                                    {item.blockedActive ? "blocked" : "active"}
                                  </span>
                                </td>
                                <td>{formatDateLabel(item.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    <div className="admin-users__footer">
                      <button className="admin-toolbar__btn" type="button" onClick={handleLoadMoreUsers} disabled={!usersHasMore || usersLoading}>
                        {usersLoading ? "Loading..." : usersHasMore ? "Load more" : "No more users"}
                      </button>
                    </div>
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
                          <p className="admin-dinner-card__line">Places: {item.places}</p>
                          <p className="admin-dinner-card__line">Already registered: {item.alreadyRegistered}</p>
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

              {activeSection === "settings" ? (
                <section className="admin-info-grid">
                  <article className="admin-widget admin-info-card">
                    <div className="admin-widget__header">
                      <h2>Editable Runtime Controls</h2>
                      <span>Apply instantly without restart</span>
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
                      <h2>Runtime Snapshot</h2>
                      <span>Current active values</span>
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
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
