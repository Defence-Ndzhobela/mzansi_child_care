// Single source of truth for backend URLs. Values come from Vite env variables
// (frontend/.env.local for development, the Vercel dashboard for production).
// Only public values belong here: anything with a VITE_ prefix is bundled into the browser.

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

// Full API base including the /api prefix, for example https://api.example.com/api.
// When unset, requests stay same-origin (/api), which suits a reverse proxy in front of both apps.
export const API_URL: string = trimTrailingSlashes(import.meta.env.VITE_API_URL?.trim() || '/api');

// Backend origin without /api. Use it to build absolute links to files the backend serves.
export const BACKEND_URL: string = trimTrailingSlashes(import.meta.env.VITE_BACKEND_URL?.trim() || '');

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn('VITE_API_URL is not set; API requests will use the same-origin "/api" path. Copy frontend/.env.example to frontend/.env.local.');
}

export default API_URL;
