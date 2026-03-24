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

export type AdminPanelResponse = {
  ok: boolean;
  name: string;
  landingUsersCount: number;
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
