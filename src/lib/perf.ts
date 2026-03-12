const canUsePerformance =
  typeof window !== "undefined" &&
  typeof window.performance !== "undefined" &&
  typeof window.performance.mark === "function" &&
  typeof window.performance.measure === "function";

const enabled = import.meta.env.DEV && canUsePerformance;

export function perfMark(name: string): void {
  if (!enabled) return;
  window.performance.mark(name);
}

export function perfMeasure(name: string, startMark: string, endMark?: string): number | null {
  if (!enabled) return null;
  try {
    window.performance.measure(name, startMark, endMark);
    const entries = window.performance.getEntriesByName(name, "measure");
    const entry = entries[entries.length - 1];
    if (!entry) return null;
    return entry.duration;
  } catch {
    return null;
  }
}

export function perfLog(label: string, payload?: Record<string, unknown>): void {
  if (!enabled) return;
  if (payload) {
    // Keep logs compact and consistent for quick profiling sessions.
    console.info(`[perf] ${label}`, payload);
    return;
  }
  console.info(`[perf] ${label}`);
}
