import type { SuiteModuleId } from "@/net/api";

export type HostSession = {
  code: string;
  moduleId: SuiteModuleId;
};

const EVENT = "agile:host-session";
let current: HostSession | null = null;

export function setHostSession(next: HostSession | null) {
  if (next?.code === current?.code && next?.moduleId === current?.moduleId) return;
  current = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<HostSession | null>(EVENT, { detail: next }));
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
