/**
 * API client for Smart Roster Management.
 * Uses TanStack Query for data fetching and mutations.
 */

import { QueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('sb-access-token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('sb-access-token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth
export const authApi = {
  me: () => fetchWithAuth<{ user: any; role: string; employee: any; pod: any }>('/me'),
};

// Config
export const configApi = {
  listPods: () => fetchWithAuth<any[]>('/pods'),
  createPod: (data: any) => fetchWithAuth<any>('/pods', { method: 'POST', body: JSON.stringify(data) }),
  updatePod: (id: string, data: any) => fetchWithAuth<any>(`/pods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePod: (id: string) => fetchWithAuth<void>(`/pods/${id}`, { method: 'DELETE' }),

  listEmployees: (params?: { pod_id?: string; active?: boolean }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchWithAuth<any[]>(`/employees${search ? `?${search}` : ''}`);
  },
  createEmployee: (data: any) => fetchWithAuth<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: any) => fetchWithAuth<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEmployee: (id: string) => fetchWithAuth<void>(`/employees/${id}`, { method: 'DELETE' }),

  listBrands: (brandId?: string) => {
    const search = brandId ? `?brand_id=${brandId}` : '';
    return fetchWithAuth<any[]>(`/brands${search}`);
  },
  createBrand: (data: any) => fetchWithAuth<any>('/brands', { method: 'POST', body: JSON.stringify(data) }),
  updateBrand: (id: string, data: any) => fetchWithAuth<any>(`/brands/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBrand: (id: string, confirm?: boolean) => fetchWithAuth<void>(`/brands/${id}${confirm ? '?confirm=true' : ''}`, { method: 'DELETE' }),

  listProcesses: (brandId?: string) => {
    const search = brandId ? `?brand_id=${brandId}` : '';
    return fetchWithAuth<any[]>(`/processes${search}`);
  },
  createProcess: (data: any) => fetchWithAuth<any>('/processes', { method: 'POST', body: JSON.stringify(data) }),
  updateProcess: (id: string, data: any) => fetchWithAuth<any>(`/processes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProcess: (id: string, confirm?: boolean) => fetchWithAuth<void>(`/processes/${id}${confirm ? '?confirm=true' : ''}`, { method: 'DELETE' }),

  putOverrides: (processId: string, overrides: any[]) =>
    fetchWithAuth<any>(`/processes/${processId}/overrides`, { method: 'PUT', body: JSON.stringify({ overrides }) }),

  listAssignments: (params?: { employee_id?: string; process_id?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchWithAuth<any[]>(`/assignments${search ? `?${search}` : ''}`);
  },
  createAssignment: (data: any) => fetchWithAuth<any>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  deleteAssignment: (id: string) => fetchWithAuth<void>(`/assignments/${id}`, { method: 'DELETE' }),

  listHolidays: () => fetchWithAuth<any[]>('/holidays'),
  createHoliday: (data: any) => fetchWithAuth<any>('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id: string) => fetchWithAuth<void>(`/holidays/${id}`, { method: 'DELETE' }),

  getSettings: () => fetchWithAuth<any>('/settings'),
  updateSettings: (data: any) => fetchWithAuth<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

// Leaves
export const leavesApi = {
  list: (params?: { employee_id?: string; month?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchWithAuth<any[]>(`/leaves${search ? `?${search}` : ''}`);
  },
  create: (data: any) => fetchWithAuth<any>('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => fetchWithAuth<any>(`/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => fetchWithAuth<any>(`/leaves/${id}`, { method: 'DELETE' }),
  preview: (data: any) => fetchWithAuth<any>('/leaves/preview', { method: 'POST', body: JSON.stringify(data) }),
};

// Roster
export const rosterApi = {
  fetch: (month: string, view?: string, id?: string) => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (id) params.set('id', id);
    const search = params.toString();
    return fetchWithAuth<any>(`/rosters/${month}${search ? `?${search}` : ''}`);
  },
  generate: (month: string, data: { keep_locked?: boolean; time_limit_s?: number }) =>
    fetchWithAuth<any>(`/rosters/${month}/generate`, { method: 'POST', body: JSON.stringify(data) }),
  regenerate: (month: string, data: { mode: 'MINIMAL_CHANGE' | 'FULL'; save: boolean }) =>
    fetchWithAuth<any>(`/rosters/${month}/regenerate`, { method: 'POST', body: JSON.stringify(data) }),
  validate: (month: string, data?: { entries?: any[]; covers?: any[] }) =>
    fetchWithAuth<any>(`/rosters/${month}/validate`, { method: 'POST', body: JSON.stringify(data || {}) }),
  listIssues: (month: string, params?: { severity?: string; rule?: string; brand_id?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchWithAuth<any[]>(`/rosters/${month}/issues${search ? `?${search}` : ''}`);
  },
  editEntry: (month: string, data: { employee_id: string; date: string; status: string; locked?: boolean }) =>
    fetchWithAuth<any>(`/rosters/${month}/entries`, { method: 'PATCH', body: JSON.stringify(data) }),
  addCover: (month: string, data: { employee_id: string; process_id: string; date: string }) =>
    fetchWithAuth<any>(`/rosters/${month}/covers`, { method: 'POST', body: JSON.stringify(data) }),
  removeCover: (month: string, coverId: string) =>
    fetchWithAuth<any>(`/rosters/${month}/covers/${coverId}`, { method: 'DELETE' }),
  lock: (month: string, data: { employee_id?: string; from?: string; to?: string; locked: boolean }) =>
    fetchWithAuth<any>(`/rosters/${month}/lock`, { method: 'POST', body: JSON.stringify(data) }),
  export: (month: string, format: 'csv' | 'xlsx', view?: string, id?: string) => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (id) params.set('id', id);
    const search = params.toString();
    return fetch(`${API_BASE}/rosters/${month}/export.${format}${search ? `?${search}` : ''}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('sb-access-token')}` },
    }).then(r => r.blob());
  },
  fairness: (month: string) => fetchWithAuth<any[]>(`/rosters/${month}/fairness`),
  structural: (month: string) => fetchWithAuth<any[]>(`/structural?month=${month}`),
};

// Changes & Suggestions
export const changesApi = {
  analyze: (month: string, data: { type: 'LEAVE'; employee_id: string; start_date: string; end_date: string }) =>
    fetchWithAuth<any>(`/rosters/${month}/changes/analyze`, { method: 'POST', body: JSON.stringify(data) }),
  getSuggestions: (month: string, issueId: string) =>
    fetchWithAuth<any[]>(`/rosters/${month}/issues/${issueId}/suggestions`),
  applySuggestion: (month: string, suggestionId: string) =>
    fetchWithAuth<any>(`/rosters/${month}/suggestions/${suggestionId}/apply`, { method: 'POST' }),
};

// Approval
export const approvalApi = {
  submitReview: (month: string) =>
    fetchWithAuth<any>(`/rosters/${month}/submit-review`, { method: 'POST' }),
  decide: (month: string, podId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment?: string) =>
    fetchWithAuth<any>(`/rosters/${month}/approvals/${podId}`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }),
  publish: (month: string) =>
    fetchWithAuth<any>(`/rosters/${month}/publish`, { method: 'POST' }),
  amend: (month: string, changes: any[], reason: string) =>
    fetchWithAuth<any>(`/rosters/${month}/amend`, { method: 'POST', body: JSON.stringify({ changes, reason }) }),
};

// Explanations
export const explainApi = {
  explain: (month: string, issueId: string) =>
    fetchWithAuth<any>(`/issues/explain`, { method: 'POST', body: JSON.stringify({ month, issue_id: issueId }) }),
};

// Utilities
export const utilsApi = {
  health: () => fetch('/api/v1/health').then(r => r.json() as Promise<{ status: string; db: string }>),
  changelog: (month?: string) => {
    const search = month ? `?month=${month}` : '';
    return fetchWithAuth<any[]>(`/changelog${search}`);
  },
  demoReset: (token: string) =>
    fetch('/api/v1/demo/reset', {
      method: 'POST',
      headers: { 'X-Reset-Token': token },
    }).then(r => r.json()),
};