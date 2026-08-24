const BASE = import.meta.env.VITE_API_URL ?? '';

let accessToken = null;
export const setAccessToken = (t) => {
  accessToken = t;
};

async function rawRefresh() {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('session expired');
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

export async function api(path, { method = 'GET', body } = {}, retry = true) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && retry && !path.startsWith('/api/auth/login')) {
    try {
      await rawRefresh();
      return api(path, { method, body }, false);
    } catch {
      setAccessToken(null);
      window.dispatchEvent(new Event('hc:logout'));
      throw new ApiFailure(401, 'SESSION_INVALID', 'Please sign in again');
    }
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiFailure(res.status, data.error?.code || 'ERROR', data.error?.message || 'Request failed', data.error?.details);
  }
  return data;
}

export class ApiFailure extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export { rawRefresh };
