import type { RadarAnswers } from "@/features/radarParty/scoring";

export type RadarStage = "lobby" | "questionnaire" | "individual" | "team-radar" | "team-progress";

const RADAR_STAGES: RadarStage[] = [
  "lobby",
  "questionnaire",
  "individual",
  "team-radar",
  "team-progress",
];

const RADAR_SESSION_STORAGE_KEY = "retro-party:radar-party:session";

export type RadarPersistedSession = {
  code: string;
  participantId: string;
  profile: { name: string; avatar: number };
  stage: RadarStage;
  answers: RadarAnswers;
  questionIndex: number;
  hostParticipates: boolean;
  resultPublished: boolean;
  updatedAt: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePersistedAnswers(raw: unknown): RadarAnswers {
  if (!isPlainObject(raw)) return {};
  const normalized: RadarAnswers = {};
  Object.entries(raw).forEach(([rawKey, rawValue]) => {
    const key = Number(rawKey);
    const value = Number(rawValue);
    if (!Number.isFinite(key) || !Number.isFinite(value)) return;
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 5) return;
    normalized[key] = rounded;
  });
  return normalized;
}

export function loadPersistedRadarSession(): RadarPersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RADAR_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;

    const code = typeof parsed.code === "string" ? parsed.code.trim().toUpperCase() : "";
    const participantId =
      typeof parsed.participantId === "string" ? parsed.participantId.trim() : "";
    if (!code || !participantId) return null;

    const profileRaw = isPlainObject(parsed.profile) ? parsed.profile : {};
    const stageRaw = typeof parsed.stage === "string" ? parsed.stage : "";
    const stage = RADAR_STAGES.includes(stageRaw as RadarStage)
      ? (stageRaw as RadarStage)
      : "lobby";
    const questionIndexRaw = Number(parsed.questionIndex);
    const questionIndex = Number.isFinite(questionIndexRaw)
      ? Math.max(0, Math.round(questionIndexRaw))
      : 0;

    return {
      code,
      participantId,
      profile: {
        name: typeof profileRaw.name === "string" ? profileRaw.name : "",
        avatar: Number.isFinite(Number(profileRaw.avatar)) ? Number(profileRaw.avatar) : 0,
      },
      stage,
      answers: normalizePersistedAnswers(parsed.answers),
      questionIndex,
      hostParticipates: parsed.hostParticipates !== false,
      resultPublished: parsed.resultPublished === true,
      updatedAt: Number.isFinite(Number(parsed.updatedAt)) ? Number(parsed.updatedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

export function persistRadarSession(session: RadarPersistedSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(RADAR_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(RADAR_SESSION_STORAGE_KEY, JSON.stringify(session));
}
