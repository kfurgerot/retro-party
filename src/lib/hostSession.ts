import { api, type SuiteModuleId } from "@/net/api";

export type HostSession = {
  code: string;
  moduleId: SuiteModuleId;
  isHost?: boolean;
  participantId?: string | null;
  participantSessionId?: string | null;
  endSession?: () => void | Promise<void>;
};

const EVENT = "agile:host-session";
let current: HostSession | null = null;
const recorded = new Set<string>();

export function setHostSession(next: HostSession | null) {
  if (
    next?.code === current?.code &&
    next?.moduleId === current?.moduleId &&
    next?.isHost === current?.isHost &&
    next?.participantId === current?.participantId &&
    next?.participantSessionId === current?.participantSessionId
  ) {
    return;
  }
  current = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<HostSession | null>(EVENT, { detail: next }));
  }
  // Best-effort persistence for retro/poker rooms (radar/skills already
  // persist via their own join flows). Server requires auth; anonymous
  // calls are silently ignored.
  if (next && (next.moduleId === "retro-party" || next.moduleId === "planning-poker")) {
    const key = `${next.moduleId}:${next.code}`;
    if (!recorded.has(key)) {
      recorded.add(key);
      api.recordRoomParticipation(next.code).catch(() => {
        recorded.delete(key);
      });
    }
  }
}

export function getHostSession(): HostSession | null {
  return current;
}

export function subscribeHostSession(handler: (next: HostSession | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<HostSession | null>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
