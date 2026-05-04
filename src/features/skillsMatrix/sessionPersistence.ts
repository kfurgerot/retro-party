import { AVATARS } from "@/types/game";
import { cleanName } from "./utils";

const SKILLS_MATRIX_SESSION_STORAGE_KEY = "retro-party:skills-matrix:session";

export type SkillsMatrixPersistedSession = {
  code: string;
  participantId: string;
  profile: { name: string; avatar: number };
  updatedAt: number;
};

export function loadPersistedSkillsMatrixSession(): SkillsMatrixPersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SKILLS_MATRIX_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SkillsMatrixPersistedSession> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const code = typeof parsed.code === "string" ? parsed.code.trim().toUpperCase() : "";
    const participantId =
      typeof parsed.participantId === "string" ? parsed.participantId.trim() : "";
    if (!code || !participantId) return null;
    const profileRaw = parsed.profile ?? {};
    const name = typeof profileRaw.name === "string" ? cleanName(profileRaw.name) : "";
    const avatarRaw = Number(profileRaw.avatar);
    const avatar = Number.isFinite(avatarRaw)
      ? Math.max(0, Math.min(AVATARS.length - 1, Math.floor(avatarRaw)))
      : 0;
    const updatedAtRaw = Number(parsed.updatedAt);
    const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : Date.now();
    return {
      code,
      participantId,
      profile: { name, avatar },
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function persistSkillsMatrixSession(session: SkillsMatrixPersistedSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SKILLS_MATRIX_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SKILLS_MATRIX_SESSION_STORAGE_KEY, JSON.stringify(session));
}
