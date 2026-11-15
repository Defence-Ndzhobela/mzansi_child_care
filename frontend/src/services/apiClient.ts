import { API_URL } from '../config/api';

// Every API request goes through here so the base URL and session-cookie handling stay in one place.
// `path` is relative to the API base, for example `/auth/login`.
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
}
