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

function adminUrl(path: string): string {
  return `${API_BASE_URL}/api/admin${path}`;
}

function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(adminUrl(path), {
    ...init,
    credentials: "include",
  });
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
  activeBookings: number;
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
  legalVersion: string;
  acceptedLanguage: string;
  acceptedAt?: string;
  totalPayments: number;
  attendanceCount: number;
  friendsInvited: number;
  referralCode: string;
  referralUsedCode: string;
  points: number;
  discount: number;
  ordersCount: number;
  blockedActive: boolean;
  lastRegisteredAt?: string;
  lastApplicationStatus: string;
  lastTablePreference: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTelegramUsersSummary = {
  total: number;
  termsAccepted: number;
  payingUsers: number;
  blockedActive: number;
};

export type AdminTelegramApplicationStatus =
  | "draft"
  | "pending_application"
  | "contacted"
  | "approved"
  | "rejected"
  | "waiting_payment"
  | "paid"
  | "cancelled"
  | "no_show";

export type AdminTelegramApplication = {
  packageInfoId: number;
  publicCode: string;
  userId: number;
  username: string;
  name: string;
  surname: string;
  phone: string;
  language: string;
  dinnerId: number;
  dinnerTitle: string;
  dinnerDate?: string;
  packageCode: string;
  packageLabel: string;
  storedMenu: string;
  guestCount: number;
  price: number;
  status: AdminTelegramApplicationStatus;
  adminNote: string;
  tablePreference: string;
  termsAccepted: boolean;
  legalVersion: string;
  referralCode: string;
  referralUsedCode: string;
  points: number;
  discount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTelegramApplicationsSummary = {
  total: number;
  pendingApplication: number;
  approved: number;
  waitingPayment: number;
  paid: number;
  cancelled: number;
  rejected: number;
  noShow: number;
};

export type AdminAuditLog = {
  id: number;
  adminUsername: string;
  actionType: string;
  entityType: string;
  entityId: string;
  previousValue: string;
  newValue: string;
  reason: string;
  createdAt: string;
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

export type AdminDishType = string;

export type AdminDishItem = {
  id: number;
  nameArm: string;
  nameRus: string;
  nameEng: string;
  price: number;
  dishType: string;
  createdAt: string;
  updatedAt: string;
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

export type AdminTelegramApplicationUpdatePayload = {
  status: AdminTelegramApplicationStatus;
  note: string;
  reason?: string;
  expectedUpdatedAt: string;
};

export async function adminLogin(username: string, password: string): Promise<void> {
  const response = await adminFetch("/login", {
    method: "POST",
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
  const response = await adminFetch("/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function adminMe(): Promise<AdminMeResponse> {
  const response = await adminFetch("/me", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AdminMeResponse;
}

export async function getAdminPanel(): Promise<AdminPanelResponse> {
  const response = await adminFetch("/panel", {
    method: "GET",
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
  const response = await adminFetch("/dinners", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { dinners?: AdminDinner[] };
  return data.dinners ?? [];
}

export async function getAdminTelegramApplications(params: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ applications: AdminTelegramApplication[]; summary: AdminTelegramApplicationsSummary }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

  const response = await adminFetch(`/applications/telegram?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    applications?: AdminTelegramApplication[];
    summary?: AdminTelegramApplicationsSummary;
  };
  return {
    applications: data.applications ?? [],
    summary: data.summary ?? {
      total: 0,
      pendingApplication: 0,
      approved: 0,
      waitingPayment: 0,
      paid: 0,
      cancelled: 0,
      rejected: 0,
      noShow: 0,
    },
  };
}

export async function updateAdminTelegramApplication(
  id: number,
  payload: AdminTelegramApplicationUpdatePayload
): Promise<AdminTelegramApplication> {
  const response = await adminFetch(`/applications/telegram/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { application: AdminTelegramApplication };
  return data.application;
}

export async function getAdminAuditLogs(limit = 20): Promise<AdminAuditLog[]> {
  const response = await adminFetch(`/audit-logs?limit=${limit}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { logs?: AdminAuditLog[] };
  return data.logs ?? [];
}

export async function createAdminDinner(payload: AdminDinnerUpsertPayload): Promise<AdminDinner> {
  const response = await adminFetch("/dinners", {
    method: "POST",
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
  const response = await adminFetch(`/dinners/${id}`, {
    method: "PUT",
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
  const response = await adminFetch(`/dinners/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function syncAdminDinners(): Promise<void> {
  const response = await adminFetch("/dinners/sync", {
    method: "POST",
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
  const response = await adminFetch(`/users/landing${buildQueryString(params)}`, {
    method: "GET",
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
  const response = await adminFetch(`/users/telegram${buildQueryString(params)}`, {
    method: "GET",
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
  const response = await adminFetch(`/users/landing/${encodeURIComponent(userId)}/status`, {
    method: "PUT",
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
  const response = await adminFetch("/settings", {
    method: "PUT",
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

export async function getAdminDishTypes(): Promise<AdminDishType[]> {
  const response = await adminFetch("/dishes/types", {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { types?: AdminDishType[] };
  return data.types ?? [];
}

export async function getAdminDishesByType(dishType: string): Promise<AdminDishItem[]> {
  const response = await adminFetch(`/dishes?type=${encodeURIComponent(dishType)}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { items?: AdminDishItem[] };
  return data.items ?? [];
}

export type AdminDishCreatePayload = {
  nameArm: string;
  nameRus: string;
  nameEng: string;
  price: number;
  dishType: string;
};

export async function createAdminDish(payload: AdminDishCreatePayload): Promise<AdminDishItem> {
  const response = await adminFetch("/dishes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { item: AdminDishItem };
  return data.item;
}
