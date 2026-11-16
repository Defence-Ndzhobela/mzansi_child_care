import {
  AdminArrangement,
  AdminArrangementDetail,
  AdminAssignment,
  AdminChild,
  AdminChildDetail,
  AdminChildSupporter,
  AdminChildSupporterDetail,
  AdminReport,
  AdminSocialWorker,
  AdminSocialWorkerDetail,
  AdminStats,
  ListParams,
  Page,
  SocialWorkerInput,
} from '../types/admin';
import { apiFetch } from './apiClient';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`/admin${path}`, {
    ...init,
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'The request could not be completed.';
    throw new Error(message);
  }
  return body as T;
}

function query(params: ListParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

const json = (value: unknown) => JSON.stringify(value);

// Every call goes through the browser's session cookie to /api/admin, where the server checks the ADMIN
// role again. Nothing here decides who is allowed to do what.
export const adminApi = {
  stats: () => request<{ stats: AdminStats }>('/dashboard/stats').then((r) => r.stats),

  listSocialWorkers: (params: ListParams) => request<Page<AdminSocialWorker>>(`/social-workers${query(params)}`),
  getSocialWorker: (id: string) =>
    request<{ socialWorker: AdminSocialWorkerDetail }>(`/social-workers/${id}`).then((r) => r.socialWorker),
  createSocialWorker: (input: SocialWorkerInput) =>
    request<{ socialWorker: AdminSocialWorkerDetail }>('/social-workers', { method: 'POST', body: json(input) }),
  updateSocialWorker: (id: string, input: SocialWorkerInput) =>
    request<{ socialWorker: AdminSocialWorkerDetail }>(`/social-workers/${id}`, { method: 'PUT', body: json(input) }),
  deleteSocialWorker: (id: string) =>
    request<{ outcome: 'DELETED' | 'DEACTIVATED' }>(`/social-workers/${id}`, { method: 'DELETE' }),

  listAssignments: (params: ListParams) => request<Page<AdminAssignment>>(`/social-worker-assignments${query(params)}`),
  createAssignment: (input: { socialWorkerId: string; childId: string; arrangementId: string }) =>
    request<{ assignment: AdminAssignment }>('/social-worker-assignments', { method: 'POST', body: json(input) }),
  reassignAssignment: (id: string, socialWorkerId: string) =>
    request<{ assignment: AdminAssignment }>(`/social-worker-assignments/${id}`, {
      method: 'PUT',
      body: json({ socialWorkerId }),
    }),
  endAssignment: (id: string) =>
    request<{ assignment: AdminAssignment }>(`/social-worker-assignments/${id}/end`, { method: 'PATCH' }),

  listChildSupporters: (params: ListParams) => request<Page<AdminChildSupporter>>(`/child-supporters${query(params)}`),
  getChildSupporter: (id: string) =>
    request<{ childSupporter: AdminChildSupporterDetail }>(`/child-supporters/${id}`).then((r) => r.childSupporter),

  listChildren: (params: ListParams) => request<Page<AdminChild>>(`/children${query(params)}`),
  getChild: (id: string) => request<{ child: AdminChildDetail }>(`/children/${id}`).then((r) => r.child),

  listArrangements: (params: ListParams) => request<Page<AdminArrangement>>(`/maintenance-arrangements${query(params)}`),
  getArrangement: (id: string) =>
    request<{ arrangement: AdminArrangementDetail }>(`/maintenance-arrangements/${id}`).then((r) => r.arrangement),

  report: () => request<{ report: AdminReport }>('/reports/summary').then((r) => r.report),
};
