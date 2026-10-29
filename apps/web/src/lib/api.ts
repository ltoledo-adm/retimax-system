'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function getTokens() {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem('retimax_access');
  const refreshToken = localStorage.getItem('retimax_refresh');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('retimax_access', accessToken);
  localStorage.setItem('retimax_refresh', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('retimax_access');
  localStorage.removeItem('retimax_refresh');
  localStorage.removeItem('retimax_user');
}

export function setUser(user: unknown) {
  localStorage.setItem('retimax_user', JSON.stringify(user));
}

export function getUser<T>() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('retimax_user');
  return raw ? (JSON.parse(raw) as T) : null;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Sesión expirada');
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  setUser(data.usuario);
  return data.accessToken as string;
}

function errorDeRed(err: unknown): Error {
  if (err instanceof Error && err.name === 'AbortError') {
    return new Error(
      'La subida tardó demasiado. Intente de nuevo. Lo que ya se había guardado sigue en el sistema.',
    );
  }
  return new Error('No se pudo conectar con la API. Verifique que el servidor esté activo (pnpm dev:api).');
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = getTokens();
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (tokens?.accessToken) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const esSubida = init.body instanceof FormData;
  const reloj = new AbortController();
  const limite = esSubida ? setTimeout(() => reloj.abort(), 90_000) : null;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: reloj.signal });
  } catch (err) {
    throw errorDeRed(err);
  } finally {
    if (limite) clearTimeout(limite);
  }

  if (res.status === 401 && tokens?.refreshToken) {
    const nuevoReloj = new AbortController();
    const nuevoLimite = esSubida ? setTimeout(() => nuevoReloj.abort(), 90_000) : null;
    const newAccess = await refreshAccessToken(tokens.refreshToken);
    headers.set('Authorization', `Bearer ${newAccess}`);
    try {
      res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: nuevoReloj.signal });
    } catch (err) {
      throw errorDeRed(err);
    } finally {
      if (nuevoLimite) clearTimeout(nuevoLimite);
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Error de red' }));
    throw new Error(Array.isArray(err.message) ? err.message.join(', ') : err.message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Credenciales inválidas' }));
    throw new Error(err.message ?? 'Credenciales inválidas');
  }
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  setUser(data.usuario);
  return data;
}

export async function logout() {
  const tokens = getTokens();
  if (tokens?.refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }).catch(() => undefined);
  }
  clearTokens();
}

export function imageUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // En el navegador usamos proxy de Next (/uploads → API) para evitar CORS y auth
  if (typeof window !== 'undefined') return path;
  return `${API_URL}${path}`;
}
