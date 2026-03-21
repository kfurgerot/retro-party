import { useEffect, useState } from "react";

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const useAnimatedProgress = (targetPct: number, fromPct: number) => {
  const safeTarget = clampPct(targetPct);
  const safeFrom = clampPct(fromPct);
  const [progress, setProgress] = useState<number>(safeFrom);

  useEffect(() => {
    setProgress(safeFrom);
    const frame = window.requestAnimationFrame(() => {
      setProgress(safeTarget);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [safeFrom, safeTarget]);

  return progress;
};

