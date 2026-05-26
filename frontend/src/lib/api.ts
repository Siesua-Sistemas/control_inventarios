type ApiError = {
  detail?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getStoredToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

function getStoredRefreshToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
}

function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function clearStoredTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('No se pudo refrescar la sesión');
  }

  const data = await response.json();
  setStoredTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const request = async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && path !== '/api/v1/auth/refresh') {
      const refreshedToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    }

    return response;
  };

  const response = await request();
  const text = await response.text();
  if (!response.ok) {
    const error: ApiError = text ? JSON.parse(text) : {};
    throw new Error(error.detail || 'Error en la solicitud');
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error en el inicio de sesión');
  }

  const data = await response.json();
  setStoredTokens(data.access_token, data.refresh_token);
  return data;
}

export async function logoutUser() {
  const refreshToken = getStoredRefreshToken();
  clearStoredTokens();

  if (!refreshToken) {
    return;
  }

  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function getCurrentUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return {
      id: payload.sub,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getStoredToken();
}
