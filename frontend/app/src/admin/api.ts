const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type ApiError = {
  error?: string;
};

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.error || `request failed with status ${response.status}`;
  } catch {
    return `request failed with status ${response.status}`;
  }
}

export type AdminMeResponse = {
  ok: boolean;
  username: string;
  name: string;
};

export type AdminDinner = {
  id: number;
  description: string;
  places: number;
  alreadyRegistered: number;
  location: string;
  dinnerDate: string;
  silverPrice?: number | null;
  goldPrice?: number | null;
  vipPrice?: number | null;
  expired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminLandingUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  guestCount: number;
  hobbies: string;
  allergies: string;
  dinnerId?: number;
  dinnerTitle: string;
  chosenPackage?: string;
  selectionStatus: "open" | "completed";
  createdAt: string;
  updatedAt: string;
};

export type AdminLandingUsersSummary = {
  total: number;
  completed: number;
  open: number;
};

export type AdminTelegramUser = {
  id: number;
  username: string;
  name: string;
  surname: string;
  phone: string;
  language: string;
  termsAccepted: boolean;
  totalPayments: number;
  attendanceCount: number;
  friendsInvited: number;
  ordersCount: number;
  blockedActive: boolean;
  lastRegisteredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTelegramUsersSummary = {
  total: number;
  termsAccepted: number;
  payingUsers: number;
  blockedActive: number;
};

export type AdminPanelResponse = {
  ok: boolean;
  name: string;
  meta: {
    generatedAt: string;
    username: string;
  };
  landing: {
    totalUsers: number;
    completedSelections: number;
    pendingSelections: number;
    selectedDinners: number;
    totalGuests: number;
    avgGuestsPerUser: number;
    avgSelectionHours: number;
    selectionP50Hours: number;
    selectionP90Hours: number;
    conversionPercent: number;
    recent24h: number;
    recentSelections24h: number;
    activeDinners: number;
    potentialRevenue: number;
    latestApplicationAt?: string;
    packageBreakdown: {
      silver: number;
      gold: number;
      vip: number;
      custom: number;
      unselected: number;
    };
    dailySubmissions?: Array<{
      day: string;
      count: number;
    }>;
    dailySelections?: Array<{
      day: string;
      count: number;
    }>;
    hourlySubmissions?: Array<{
      hour: string;
      count: number;
    }>;
    weekdaySubmissions?: Array<{
      label: string;
      count: number;
    }>;
    weekdaySelections?: Array<{
      label: string;
      count: number;
    }>;
    guestDistribution?: Array<{
      label: string;
      count: number;
    }>;
    selectionLagBuckets?: Array<{
      label: string;
      count: number;
    }>;
    topEmailDomains?: Array<{
      label: string;
      count: number;
    }>;
    topDinners?: Array<{
      dinnerId: number;
      description: string;
      registrations: number;
      capacity: number;
      fillPercent: number;
    }>;
  };
  telegram: {
    enabled: boolean;
    available: boolean;
    error?: string;
    stats?: {
      totalUsers: number;
      acceptedTermsUsers: number;
      usersWithPhone: number;
      usersWithPayments: number;
      totalDinners: number;
      activeDinners: number;
      registrationsTotal: number;
      referralsTotal: number;
      blockedActive: number;
      revenueTotal: number;
      termsAcceptancePct: number;
      phoneCoveragePct: number;
      referralCoveragePct: number;
      blockedRatePct: number;
      revenue24h: number;
      orders24h: number;
      avgOrderValue: number;
      nextDinnerDate?: string;
      lastDinnerDate?: string;
      packageBreakdown: {
        silver: number;
        gold: number;
        vip: number;
        custom: number;
        unselected: number;
      };
      dailyOrders?: Array<{
        day: string;
        orders: number;
        revenue: number;
      }>;
      dailyNewUsers?: Array<{
        day: string;
        count: number;
      }>;
      registrationsByHour?: Array<{
        hour: string;
        count: number;
      }>;
      ordersByWeekday?: Array<{
        label: string;
        count: number;
      }>;
      revenueByPackage?: Array<{
        label: string;
        value: number;
      }>;
      dinnerFillBands?: Array<{
        label: string;
        count: number;
      }>;
      topDinners?: Array<{
        dinnerId: number;
        description: string;
        registrations: number;
        capacity: number;
        fillPercent: number;
      }>;
    };
  };
  settings: {
    frontendOrigin: string;
    listenAddr: string;
    adminCookieSecure: boolean;
    adminTokenTTLMinutes: number;
    telegramDatabaseConfigured: boolean;
    rateLimits: {
      adminLoginPerMinute: number;
      joinFormPer20MinByIP: number;
      joinSelectionPer20MinByIP: number;
    };
    runtime: {
      maintenanceMode: boolean;
      allowJoinApplications: boolean;
      allowJoinSelections: boolean;
      minJoinFormFillDurationMs: number;
      panelAutoRefreshSeconds: number;
      adminUsersPageSize: number;
      allowAdminDinnerMutations: boolean;
      allowAdminUserStatusEdits: boolean;
    };
  };
};

export type AdminSettingsPayload = {
  adminTokenTTLMinutes?: number;
  adminLoginPerMinute?: number;
  joinFormPer20MinByIP?: number;
  joinSelectionPer20MinByIP?: number;
  minJoinFormFillDurationMs?: number;
  panelAutoRefreshSeconds?: number;
  adminUsersPageSize?: number;
  maintenanceMode?: boolean;
  allowJoinApplications?: boolean;
  allowJoinSelections?: boolean;
  allowAdminDinnerMutations?: boolean;
  allowAdminUserStatusEdits?: boolean;
};

export async function adminLogin(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function adminLogout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function adminMe(): Promise<AdminMeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AdminMeResponse;
}

export async function getAdminPanel(): Promise<AdminPanelResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/panel`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AdminPanelResponse;
}

export type AdminDinnerUpsertPayload = {
  description: string;
  places: number;
  location: string;
  dinnerDate: string;
  silverPrice?: number | null;
  goldPrice?: number | null;
  vipPrice?: number | null;
  expired?: boolean;
};

export async function getAdminDinners(): Promise<AdminDinner[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/dinners`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { dinners?: AdminDinner[] };
  return data.dinners ?? [];
}

export async function createAdminDinner(payload: AdminDinnerUpsertPayload): Promise<AdminDinner> {
  const response = await fetch(`${API_BASE_URL}/api/admin/dinners`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { dinner: AdminDinner };
  return data.dinner;
}

export async function updateAdminDinner(id: number, payload: AdminDinnerUpsertPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/dinners/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function deleteAdminDinner(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/dinners/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function syncAdminDinners(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/dinners/sync`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

type UserListQuery = {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

function buildQueryString(params: UserListQuery): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const str = query.toString();
  return str ? `?${str}` : "";
}

export async function getAdminLandingUsers(
  params: UserListQuery = {}
): Promise<{ users: AdminLandingUser[]; summary: AdminLandingUsersSummary }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/landing${buildQueryString(params)}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    users?: AdminLandingUser[];
    summary?: AdminLandingUsersSummary;
  };

  return {
    users: data.users ?? [],
    summary: data.summary ?? { total: 0, completed: 0, open: 0 },
  };
}

export async function getAdminTelegramUsers(
  params: UserListQuery = {}
): Promise<{ users: AdminTelegramUser[]; summary: AdminTelegramUsersSummary }> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/telegram${buildQueryString(params)}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    users?: AdminTelegramUser[];
    summary?: AdminTelegramUsersSummary;
  };

  return {
    users: data.users ?? [],
    summary: data.summary ?? { total: 0, termsAccepted: 0, payingUsers: 0, blockedActive: 0 },
  };
}

export async function updateAdminLandingUserStatus(
  userId: string,
  status: "open" | "completed"
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/landing/${encodeURIComponent(userId)}/status`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function updateAdminSettings(payload: AdminSettingsPayload): Promise<AdminPanelResponse["settings"]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { settings: AdminPanelResponse["settings"] };
  return data.settings;
}
