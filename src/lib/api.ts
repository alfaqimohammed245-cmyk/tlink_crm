// API helper with LocalStorage session keeping
const TOKEN_KEY = "crm_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Low-level fetch wrapper
export async function apiRequest(endpoint: string, method: "GET" | "POST" = "GET", data?: any) {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (data && method === "POST") {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, config);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || `HTTP error! Status: ${response.status}`);
  }

  return result;
}
