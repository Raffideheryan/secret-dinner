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
  silverSeats?: number | null;
  goldSeats?: number | null;
  vipSeats?: number | null;
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
  adminStatus: "new" | "review" | "contacted" | "approved" | "rejected";
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
  paidBookingsCount: number;
  noShowCount: number;
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
  vipApplicationsCount: number;
  goldApplicationsCount: number;
  totalGuestCount: number;
  referralSourcedCount: number;
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

export type EngagementSeriesPoint = {
  key: string;
  label: string;
  value: number;
};

export type EngagementTrendPoint = {
  key: string;
  label: string;
  events: number;
  activeUsers: number;
  returningUsers: number;
  applications: number;
  paidUsers: number;
  conversionRate: number;
};

export type EngagementSourcePerformance = {
  key: string;
  label: string;
  users: number;
  applications: number;
  paidUsers: number;
  conversionRate: number;
  conversionBase: string;
};

export type EngagementDinnerPerformance = {
  key: string;
  label: string;
  views: number;
  applications: number;
  conversionRate: number;
};

export type EngagementButtonPerformance = {
  key: string;
  label: string;
  clicks: number;
  uniqueUsers: number;
  applicantOverlap: number;
  applicantOverlapRate: number;
  conversionRate: number;
};

export type EngagementHourlyPoint = {
  key: string;
  label: string;
  events: number;
  activeUsers: number;
};

export type EngagementFunnelStep = {
  key: string;
  label: string;
  users: number;
  percent: number;
  dropOff: number;
  dropText: string;
};

export type EngagementFilterOption = {
  value: string;
  label: string;
};

export type EngagementAnalytics = {
  summary: {
    activeUsers: number;
    passiveUsers: number;
    newUsers: number;
    returningUsers: number;
    totalEvents: number;
  };
  conversions: {
    overallAvailable: boolean;
    overallRate: number;
    overallSubmittedUsers: number;
    overallPaidUsers: number;
    overallApprovedUsers: number;
    overallAttendedUsers: number;
    telegramSubmittedUsers: number;
    telegramApprovedUsers: number;
    telegramPaidUsers: number;
    telegramAttendedUsers: number;
    telegramRate: number;
    landingViewedUsers: number;
    landingSelectedUsers: number;
    landingSubmittedUsers: number;
    landingApprovedUsers: number;
    landingRate: number;
    landingConversionBase: string;
    landingPaymentTracked: boolean;
    displayLabel: string;
    displayRate: number;
  };
  timeline: EngagementTrendPoint[];
  sourceBreakdown: EngagementSeriesPoint[];
  sourcePerformance: EngagementSourcePerformance[];
  dinnerViews: EngagementSeriesPoint[];
  dinnerPerformance: EngagementDinnerPerformance[];
  packageSelections: EngagementSeriesPoint[];
  buttonClicks: EngagementSeriesPoint[];
  buttonPerformance: EngagementButtonPerformance[];
  peakHours: EngagementSeriesPoint[];
  hourlyActivity: EngagementHourlyPoint[];
  funnel: EngagementFunnelStep[];
  dataQualityWarnings: string[];
  debug: {
    rawStageCounts: Array<{
      key: string;
      label: string;
      rawUsers: number;
      orderedUsers: number;
      inferredUsers: number;
      excludedUsers: number;
      inferredActors?: string[];
      excludedActors?: string[];
    }>;
    orderedStageCounts: Array<{
      key: string;
      label: string;
      rawUsers: number;
      orderedUsers: number;
      inferredUsers: number;
      excludedUsers: number;
      inferredActors?: string[];
      excludedActors?: string[];
    }>;
    excludedUsers: string[];
    inferredStages: string[];
    dataQualityWarnings: string[];
    meaningfulEvents: string[];
    checks: Array<{
      key: string;
      label: string;
      status: string;
      severity: string;
      metricValue: string;
      details: string;
    }>;
  };
  filterOptions: {
    dinners: EngagementFilterOption[];
    packages: EngagementFilterOption[];
  };
};

export type EngagementUserListItem = {
  id: string;
  source: "telegram" | "landing";
  name: string;
  username: string;
  phone: string;
  status: string;
  applications: number;
  paidBookings: number;
  payments: number;
  referrals: number;
  points: number;
  attendanceCount: number;
  lastActivityAt?: string;
  createdAt?: string;
  engagementScore: number;
  healthScore: number;
};

export type EngagementUserProfile = {
  overview: {
    id: string;
    source: "telegram" | "landing";
    name: string;
    username: string;
    phone: string;
    status: string;
    applications: number;
    paidBookings: number;
    payments: number;
    referrals: number;
    points: number;
    attendanceCount: number;
    lastActivityAt?: string;
    firstSeenAt?: string;
    createdAt?: string;
    termsAccepted: boolean;
    language: string;
    legalVersion: string;
    engagementScore: number;
    healthScore: number;
    loyaltyScore: number;
    referralScore: number;
    engagementLabel: string;
    engagementReason: string;
  };
  timeline: Array<{
    key: string;
    occurredAt: string;
    title: string;
    description: string;
    tone: string;
  }>;
  behavioral: {
    totalEvents: number;
    activeDays: number;
    dinnerViews: number;
    packageSelections: number;
    buttonClicks: number;
    errorEvents: number;
    applicationStarts: number;
    applicationsSent: number;
    firstSeenAt: string;
    lastSeenAt: string;
    peakHour: string;
    peakHourEvents: number;
    topDinner: string;
    topPackage: string;
    conversionStage: string;
    completionRate: number;
  };
  referral: {
    referralCode: string;
    usedReferralCode: string;
    invitedUsers: number;
    referralEvents: number;
    referralClicks: number;
    referralSuccesses: number;
    tracked: boolean;
  };
  revenue: {
    totalPayments: number;
    paidBookings: number;
    averageBooking: number;
    cancelledBookings: number;
    latestPaymentAt: string;
    tracked: boolean;
  };
  attendance: {
    attendanceCount: number;
    noShowCount: number;
    lastAttendance: string;
    attendanceQuality: string;
    tracked: boolean;
  };
  journey: Array<{
    key: string;
    title: string;
    subtitle: string;
    status: string;
    amount: number;
    occurredAt: string;
    description: string;
  }>;
  tags: Array<{ tag: string; createdBy: string; createdAt: string }>;
  notes: Array<{ id: number; noteText: string; createdBy: string; createdAt: string }>;
  loyaltyScore: number;
  referralScore: number;
  dinnerInterest: Array<{
    dinnerId: string;
    dinnerName: string;
    viewCount: number;
    applied: boolean;
    lastViewAt: string;
  }>;
  campaignResponses: Array<{
    campaignId: number;
    campaignTitle: string;
    messageType: string;
    question: string;
    choiceIndex: number;
    choiceLabel: string;
    correct: boolean;
    occurredAt: string;
  }>;
  eventsPage: {
    events: Array<{
      key: string;
      occurredAt: string;
      title: string;
      description: string;
      tone: string;
    }>;
    total: number;
    limit: number;
    offset: number;
    search: string;
  };
};

export type EngagementUserEventsPage = {
  events: Array<{
    key: string;
    occurredAt: string;
    title: string;
    description: string;
    tone: string;
  }>;
  total: number;
  limit: number;
  offset: number;
  search: string;
};

export async function addUserTag(source: string, userId: string, tag: string): Promise<Array<{ tag: string; createdBy: string; createdAt: string }>> {
  const response = await fetch(adminUrl(`/engagement/users/${source}/${userId}/tags`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "failed to add tag");
  }
  const data = (await response.json()) as { tags: Array<{ tag: string; createdBy: string; createdAt: string }> };
  return data.tags;
}

export async function removeUserTag(source: string, userId: string, tag: string): Promise<Array<{ tag: string; createdBy: string; createdAt: string }>> {
  const response = await fetch(adminUrl(`/engagement/users/${source}/${userId}/tags/${encodeURIComponent(tag)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "failed to remove tag");
  }
  const data = (await response.json()) as { tags: Array<{ tag: string; createdBy: string; createdAt: string }> };
  return data.tags;
}

export async function addUserNote(source: string, userId: string, noteText: string): Promise<{ id: number; noteText: string; createdBy: string; createdAt: string }> {
  const response = await fetch(adminUrl(`/engagement/users/${source}/${userId}/notes`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noteText }),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "failed to add note");
  }
  const data = (await response.json()) as { note: { id: number; noteText: string; createdBy: string; createdAt: string } };
  return data.note;
}

export async function deleteUserNote(source: string, userId: string, noteId: number): Promise<void> {
  const response = await fetch(adminUrl(`/engagement/users/${source}/${userId}/notes/${noteId}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "failed to delete note");
  }
}

export type EngagementCampaignAudienceConfig = {
  audienceType: string;
  dinnerIds?: number[];
  packages?: string[];
  selectedUsers?: string[];
  language?: string;
  search?: string;
  termsAccepted?: boolean;
  includeBlocked?: boolean;
};

export type EngagementCampaignButton = {
  id: string;
  label: string;
  kind: "callback" | "link" | "cta";
  url?: string;
  action?: string;
  dinnerId?: number;
};

export type EngagementCampaignMedia = {
  kind: "file_id" | "url" | "data_url" | "upload";
  value: string;
  fileName?: string;
  mimeType?: string;
};

export type EngagementCampaignPoll = {
  question: string;
  options: string[];
  allowsMultiple: boolean;
  isAnonymous: boolean;
  correctOptionIndex?: number;
  explanation?: string;
};

export type EngagementCampaignMessagePayload = {
  text?: string;
  caption?: string;
  parseMode?: string;
  media?: EngagementCampaignMedia;
  buttons?: EngagementCampaignButton[];
  poll?: EngagementCampaignPoll;
  location?: {
    latitude: number;
    longitude: number;
    title?: string;
    address?: string;
  };
  contact?: {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
    vcard?: string;
  };
};

export type EngagementCampaignPayload = {
  title: string;
  description: string;
  status?: "draft" | "scheduled";
  messageType: "text" | "photo" | "image" | "video" | "document" | "audio" | "voice" | "location" | "contact" | "poll" | "quiz" | "rating";
  audience: EngagementCampaignAudienceConfig;
  message: EngagementCampaignMessagePayload;
  scheduledFor?: string;
  rateLimitPerMinute?: number;
  maxRetries?: number;
  confirmBulkSend?: boolean;
};

export type EngagementCampaignRecord = {
  id: number;
  title: string;
  description: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "cancelled";
  messageType: string;
  audience: EngagementCampaignAudienceConfig;
  message: EngagementCampaignMessagePayload;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  rateLimitPerMinute: number;
  maxRetries: number;
  targetUsers: number;
  previewUsers: Array<{
    userId: string;
    name: string;
    username: string;
    phone: string;
    status: string;
  }>;
  metrics: {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    blocked: number;
    skipped: number;
    cancelled: number;
    clickedUsers: number;
    buttonClicks: number;
    pollVotes: number;
    quizCorrect: number;
    applicationsAfter: number;
    paymentsAfter: number;
    revenueAfter: number;
  };
};

export type EngagementCampaignLog = {
  id: number;
  campaignId: number;
  deliveryId: number;
  userId: string;
  username: string;
  eventType: string;
  status: string;
  message: string;
  metadata: string;
  messageType: string;
  question: string;
  choiceIndex?: number;
  choiceLabel: string;
  correct?: boolean;
  occurredAt: string;
  attempt: number;
  messageId: number;
  pollId: string;
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
  silverSeats?: number | null;
  goldSeats?: number | null;
  vipSeats?: number | null;
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
      vipApplicationsCount: 0,
      goldApplicationsCount: 0,
      totalGuestCount: 0,
      referralSourcedCount: 0,
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

export async function getAdminAuditLogs(params: {
  limit?: number;
  offset?: number;
  search?: string;
  entityType?: string;
  actionType?: string;
  adminUsername?: string;
  reasonState?: "all" | "with_reason" | "without_reason";
} = {}): Promise<AdminAuditLog[]> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.search) query.set("search", params.search);
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.actionType) query.set("actionType", params.actionType);
  if (params.adminUsername) query.set("adminUsername", params.adminUsername);
  if (params.reasonState && params.reasonState !== "all") query.set("reasonState", params.reasonState);

  const response = await adminFetch(`/audit-logs?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { logs?: AdminAuditLog[] };
  return data.logs ?? [];
}

export async function getEngagementAnalytics(params: {
  startDate?: string;
  endDate?: string;
  source?: string;
  dinnerId?: string;
  package?: string;
} = {}): Promise<EngagementAnalytics> {
  const query = new URLSearchParams();
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.source && params.source !== "all") query.set("source", params.source);
  if (params.dinnerId && params.dinnerId !== "all") query.set("dinnerId", params.dinnerId);
  if (params.package && params.package !== "all") query.set("package", params.package);

  const response = await adminFetch(`/engagement/analytics?${query.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { analytics: EngagementAnalytics };
  return data.analytics;
}

export async function getEngagementUsers(params: {
  source?: "telegram" | "landing";
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ users: EngagementUserListItem[]; total: number; source: "telegram" | "landing" }> {
  const query = new URLSearchParams();
  if (params.source) query.set("source", params.source);
  if (params.search) query.set("search", params.search);
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));

  const response = await adminFetch(`/engagement/users?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    users?: EngagementUserListItem[];
    meta?: { total?: number; source?: "telegram" | "landing" };
  };

  return {
    users: data.users ?? [],
    total: data.meta?.total ?? 0,
    source: data.meta?.source ?? (params.source ?? "telegram"),
  };
}

export async function getEngagementUserProfile(
  source: "telegram" | "landing",
  userId: string
): Promise<EngagementUserProfile> {
  const response = await adminFetch(`/engagement/users/${encodeURIComponent(source)}/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { profile: EngagementUserProfile };
  return data.profile;
}

export async function getEngagementUserEvents(
  source: "telegram" | "landing",
  userId: string,
  params: { limit?: number; offset?: number; search?: string } = {},
): Promise<EngagementUserEventsPage> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.search?.trim()) query.set("search", params.search.trim());

  const response = await adminFetch(`/engagement/users/${encodeURIComponent(source)}/${encodeURIComponent(userId)}/events?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    events?: EngagementUserEventsPage["events"];
    meta?: Omit<EngagementUserEventsPage, "events">;
  };

  return {
    events: data.events ?? [],
    total: data.meta?.total ?? 0,
    limit: data.meta?.limit ?? (params.limit ?? 20),
    offset: data.meta?.offset ?? (params.offset ?? 0),
    search: data.meta?.search ?? (params.search ?? ""),
  };
}

export async function getEngagementCampaignOptions(): Promise<{
  dinners: EngagementFilterOption[];
  packages: EngagementFilterOption[];
}> {
  const response = await adminFetch("/engagement/campaigns/options", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as {
    options?: {
      dinners?: EngagementFilterOption[];
      packages?: EngagementFilterOption[];
    };
  };
  return {
    dinners: data.options?.dinners ?? [],
    packages: data.options?.packages ?? [],
  };
}

export async function getEngagementCampaigns(params: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
} = {}): Promise<{ campaigns: EngagementCampaignRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);

  const response = await adminFetch(`/engagement/campaigns?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    campaigns?: EngagementCampaignRecord[];
    meta?: { total?: number };
  };
  return {
    campaigns: data.campaigns ?? [],
    total: data.meta?.total ?? 0,
  };
}

export async function getEngagementCampaign(id: number): Promise<EngagementCampaignRecord> {
  const response = await adminFetch(`/engagement/campaigns/${id}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function createEngagementCampaign(payload: EngagementCampaignPayload): Promise<EngagementCampaignRecord> {
  const response = await adminFetch("/engagement/campaigns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function updateEngagementCampaign(id: number, payload: EngagementCampaignPayload): Promise<EngagementCampaignRecord> {
  const response = await adminFetch(`/engagement/campaigns/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function scheduleEngagementCampaign(id: number, payload: {
  sendNow?: boolean;
  scheduledFor?: string;
}): Promise<EngagementCampaignRecord> {
  const response = await adminFetch(`/engagement/campaigns/${id}/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function cancelEngagementCampaign(id: number): Promise<EngagementCampaignRecord> {
  const response = await adminFetch(`/engagement/campaigns/${id}/cancel`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function testSendEngagementCampaign(id: number, userId: string): Promise<EngagementCampaignRecord> {
  const response = await adminFetch(`/engagement/campaigns/${id}/test-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { campaign: EngagementCampaignRecord };
  return data.campaign;
}

export async function getEngagementCampaignLogs(
  id: number,
  params: { limit?: number; offset?: number } = {}
): Promise<{ logs: EngagementCampaignLog[]; total: number }> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const response = await adminFetch(`/engagement/campaigns/${id}/logs?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as {
    logs?: EngagementCampaignLog[];
    meta?: { total?: number };
  };
  return {
    logs: data.logs ?? [],
    total: data.meta?.total ?? 0,
  };
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
  payload: {
    selectionStatus?: AdminLandingUser["selectionStatus"];
    adminStatus?: AdminLandingUser["adminStatus"];
  }
): Promise<AdminLandingUser> {
  const response = await adminFetch(`/users/landing/${encodeURIComponent(userId)}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { user: AdminLandingUser };
  return data.user;
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

export async function updateAdminDish(id: number, payload: AdminDishCreatePayload): Promise<AdminDishItem> {
  const response = await adminFetch(`/dishes/${id}`, {
    method: "PUT",
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

export async function deleteAdminDish(id: number): Promise<void> {
  const response = await adminFetch(`/dishes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export type SmartSegmentUser = {
  id: string;
  source: string;
  name: string;
  value: number;
};

export type SmartSegmentResult = {
  key: string;
  label: string;
  description: string;
  count: number;
  users: SmartSegmentUser[];
};

export type AdminRecommendation = {
  priority: "high" | "medium" | "low";
  type: "retention" | "engagement" | "growth" | "revenue";
  title: string;
  message: string;
  action: string;
  count: number;
};

export async function getSmartSegments(): Promise<SmartSegmentResult[]> {
  const response = await adminFetch("/segments");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { segments: SmartSegmentResult[] };
  return data.segments ?? [];
}

export async function getAdminRecommendations(): Promise<AdminRecommendation[]> {
  const response = await adminFetch("/recommendations");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = (await response.json()) as { recommendations: AdminRecommendation[] };
  return data.recommendations ?? [];
}
