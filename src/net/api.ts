import { resolveBackendUrl } from "./backend";

export type HostUser = {
  id: string;
  email: string;
  displayName: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  description: string | null;
  baseConfig: Record<string, unknown>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TemplateQuestion = {
  id: string;
  text: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

const API_BASE = `${resolveBackendUrl()}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let payload: ApiError | null = null;
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      payload = null;
    }
    const message = payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getMe: () => request<{ user: HostUser }>("/auth/me", { method: "GET" }),
  register: (payload: { email: string; password: string; displayName: string }) =>
    request<{ user: HostUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ user: HostUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (payload: { email: string }) =>
    request<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  listTemplates: () => request<{ items: TemplateItem[] }>("/templates", { method: "GET" }),
  createTemplate: (payload: {
    name: string;
    description?: string | null;
    baseConfig?: Record<string, unknown>;
  }) =>
    request<{ template: TemplateItem }>("/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getTemplate: (templateId: string) =>
    request<{ template: TemplateItem }>(`/templates/${templateId}`, { method: "GET" }),
  patchTemplate: (
    templateId: string,
    payload: Partial<{
      name: string;
      description: string | null;
      baseConfig: Record<string, unknown>;
      isArchived: boolean;
    }>
  ) =>
    request<{ template: TemplateItem }>(`/templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTemplate: (templateId: string) =>
    request<void>(`/templates/${templateId}`, { method: "DELETE" }),

  listTemplateQuestions: (templateId: string) =>
    request<{ items: TemplateQuestion[] }>(`/templates/${templateId}/questions`, { method: "GET" }),
  createTemplateQuestion: (
    templateId: string,
    payload: { text: string; category?: string | null; sortOrder?: number }
  ) =>
    request<{ question: TemplateQuestion }>(`/templates/${templateId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patchTemplateQuestion: (
    templateId: string,
    questionId: string,
    payload: Partial<{
      text: string;
      category: string | null;
      sortOrder: number;
      isActive: boolean;
    }>
  ) =>
    request<{ question: TemplateQuestion }>(`/templates/${templateId}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTemplateQuestion: (templateId: string, questionId: string) =>
    request<void>(`/templates/${templateId}/questions/${questionId}`, { method: "DELETE" }),
  reorderTemplateQuestions: (templateId: string, idsInOrder: string[]) =>
    request<{ items: TemplateQuestion[] }>(`/templates/${templateId}/questions/reorder`, {
      method: "PUT",
      body: JSON.stringify({ idsInOrder }),
    }),

  launchTemplateRoom: (templateId: string) =>
    request<{ roomId: string; roomCode: string; mode: "template"; sourceTemplateId: string }>(
      `/templates/${templateId}/launch-room`,
      { method: "POST" }
    ),
  createQuickRoom: (baseConfig?: Record<string, unknown>) =>
    request<{ roomId: string; roomCode: string; mode: "quick" }>("/rooms/quick", {
      method: "POST",
      body: JSON.stringify({ baseConfig: baseConfig ?? {} }),
    }),
};
