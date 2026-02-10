import React, { useEffect, useState } from "react";

interface LaunchAnnouncementProps {
  title: string;
  subtitle: string;
  startAt?: number;
}

export const LaunchAnnouncement: React.FC<LaunchAnnouncementProps> = ({
  title,
  subtitle,
  startAt,
}) => {
  const [countdown, setCountdown] = useState(() =>
    startAt ? Math.max(0, Math.ceil((startAt - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!startAt) return;
    const timer = window.setInterval(() => {
      setCountdown(Math.max(0, Math.ceil((startAt - Date.now()) / 1000)));
    }, 100);
    return () => window.clearInterval(timer);
  }, [startAt]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="w-full max-w-xl rounded border border-cyan-300/45 bg-slate-900/75 p-6 text-center text-cyan-50 shadow-[0_0_0_2px_rgba(34,211,238,0.2),0_0_32px_rgba(34,211,238,0.24)] backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">
          Preparation
        </div>
        <h2 className="mt-3 text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-slate-200">{subtitle}</p>
        <div className="mt-5 inline-flex rounded border border-cyan-300/45 bg-cyan-500/15 px-3 py-1 text-lg font-semibold text-cyan-200">
          {countdown}s
        </div>
      </div>
    </div>
  );
};
