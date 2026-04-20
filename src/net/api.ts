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

export type RadarAxisValues = {
  collaboration: number;
  fun: number;
  learning: number;
  alignment: number;
  ownership: number;
  process: number;
  resources: number;
  roles: number;
  speed: number;
  value: number;
};

export type RadarPolesPercent = Record<string, number>;

export type RadarIndividualInsights = {
  summary: string;
  strengths: string[];
  watchouts: string[];
  workshopQuestions: string[];
};

export type RadarIndividualResult = {
  radar: RadarAxisValues;
  polesPercent: RadarPolesPercent;
  insights: RadarIndividualInsights;
};

export type RadarTeamInsights = {
  summary: string;
  homogeneousAxes: string[];
  polarizedAxes: string[];
  divergenceAxes: string[];
  workshopQuestions: string[];
  spreads: Array<{
    axis: keyof RadarAxisValues;
    min: number;
    max: number;
    spread: number;
    homogeneous: boolean;
    polarized: boolean;
  }>;
};

export type RadarSessionInfo = {
  id: string;
  code: string;
  title: string | null;
  facilitatorName: string | null;
  hostParticipates: boolean;
  status: "lobby" | "started";
  startedAt: string | null;
  createdAt?: string;
};

export type RadarParticipant = {
  id: string;
  displayName: string;
  avatar: number;
  isHost: boolean;
  progressAnswered?: number;
  progressTotal?: number;
  progressPct?: number;
  createdAt?: string;
  submittedAt?: string | null;
  result?: RadarIndividualResult | null;
};

type ApiError = { error?: string };

const API_BASE = `${resolveBackendUrl()}/api`;

const ERROR_TRANSLATIONS: Record<string, string> = {
  Unauthorized: "Non autorise",
  "Invalid payload": "Donnees invalides",
  "Invalid credentials": "Identifiants invalides",
  "Too many attempts": "Trop de tentatives, reessaie plus tard",
  "Too many requests": "Trop de requetes, reessaie plus tard",
  "Not found": "Ressource introuvable",
  "Sort order already used": "Ordre deja utilise",
  "Unable to create account": "Impossible de creer le compte",
  "Unable to generate room code": "Impossible de generer un code de partie",
  "Mail service not configured": "Service d'email non configure",
  "Internal server error": "Erreur interne du serveur",
  "Invalid or expired token": "Lien invalide ou expire",
};

const SUCCESS_TRANSLATIONS: Record<string, string> = {
  "If this account exists, a reset email has been sent.":
    "Si ce compte existe, un email de reinitialisation a ete envoye.",
  "Password has been reset.": "Le mot de passe a ete reinitialise.",
  "Password updated.": "Le mot de passe a ete mis a jour.",
};

const localizeMessage = (message: string) => ERROR_TRANSLATIONS[message] ?? message;
const localizeSuccessMessage = (message: string) => SUCCESS_TRANSLATIONS[message] ?? message;

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
    const rawMessage = payload?.error || `HTTP ${response.status}`;
    const message = localizeMessage(rawMessage);
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
    }).then((response) => ({
      ...response,
      message: localizeSuccessMessage(response.message),
    })),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((response) => ({
      ...response,
      message: localizeSuccessMessage(response.message),
    })),
  updateProfile: (payload: { displayName: string }) =>
    request<{ user: HostUser }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean; message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((response) => ({
      ...response,
      message: localizeSuccessMessage(response.message),
    })),
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
    }>,
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
    payload: { text: string; category?: string | null; sortOrder?: number },
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
    }>,
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
      { method: "POST" },
    ),
  launchPokerTemplateRoom: (templateId: string) =>
    request<{
      roomId: string;
      roomCode: string;
      mode: "template";
      sourceTemplateId: string;
      voteSystem: string;
    }>(`/templates/${templateId}/launch-poker-room`, { method: "POST" }),
  createQuickRoom: (baseConfig?: Record<string, unknown>) =>
    request<{ roomId: string; roomCode: string; mode: "quick" }>("/rooms/quick", {
      method: "POST",
      body: JSON.stringify({ baseConfig: baseConfig ?? {} }),
    }),

  radarCreateSession: (payload: {
    title?: string;
    facilitatorName?: string;
    hostParticipates?: boolean;
  }) =>
    request<{ session: RadarSessionInfo }>("/radar/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  radarJoinSession: (code: string, payload: { displayName: string; avatar?: number }) =>
    request<{ session: RadarSessionInfo; participant: RadarParticipant }>(
      `/radar/sessions/${encodeURIComponent(code)}/participants`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  radarUpdateProgress: (
    code: string,
    payload: {
      participantId: string;
      answeredCount: number;
    },
  ) =>
    request<{
      participant: {
        id: string;
        progressAnswered: number;
        progressTotal: number;
        progressPct: number;
      };
    }>(`/radar/sessions/${encodeURIComponent(code)}/progress`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  radarSubmitAnswers: (
    code: string,
    payload: {
      participantId: string;
      answers: Record<number, number>;
    },
  ) =>
    request<{
      participant: Pick<RadarParticipant, "id" | "displayName">;
      result: RadarIndividualResult;
      team: { memberCount: number; radar: RadarAxisValues; insights: RadarTeamInsights };
    }>(`/radar/sessions/${encodeURIComponent(code)}/submissions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  radarGetSession: (code: string) =>
    request<{
      session: RadarSessionInfo;
      participants: RadarParticipant[];
      team: {
        memberCount: number;
        radar: RadarAxisValues;
        insights: RadarTeamInsights;
        updatedAt: string;
      } | null;
    }>(`/radar/sessions/${encodeURIComponent(code)}`, {
      method: "GET",
    }),
  radarStartSession: (
    code: string,
    payload: { participantId: string; hostParticipates?: boolean },
  ) =>
    request<{
      session: Pick<RadarSessionInfo, "id" | "code" | "status" | "startedAt" | "hostParticipates">;
    }>(`/radar/sessions/${encodeURIComponent(code)}/start`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
