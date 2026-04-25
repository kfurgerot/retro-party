import React, { useEffect, useState } from "react";
import { fr } from "@/i18n/fr";

interface LaunchAnnouncementProps {
  title: string;
  subtitle: string;
  startAt?: number;
  variant?: "turn" | "roll" | "default";
  highlightValue?: string | number | null;
  emphasisText?: string | null;
}

export const LaunchAnnouncement: React.FC<LaunchAnnouncementProps> = ({
  title,
  subtitle,
  startAt,
  variant = "default",
  highlightValue = null,
  emphasisText = null,
}) => {
  const [initialDurationMs, setInitialDurationMs] = useState(() =>
    startAt ? Math.max(1, startAt - Date.now()) : 1,
  );
  const [remainingMs, setRemainingMs] = useState(() =>
    startAt ? Math.max(0, startAt - Date.now()) : 0,
  );

  useEffect(() => {
    if (!startAt) return;
    setInitialDurationMs(Math.max(1, startAt - Date.now()));
    const timer = window.setInterval(() => {
      setRemainingMs(Math.max(0, startAt - Date.now()));
    }, 50);
    return () => window.clearInterval(timer);
  }, [startAt]);

  const progressRatio = Math.max(0, Math.min(1, remainingMs / initialDurationMs));
  const countdown = Math.max(0, Math.ceil(remainingMs / 1000));

  const skin =
    variant === "turn"
      ? {
          glow: "shadow-[0_0_0_2px_rgba(236,72,153,0.2),0_0_44px_rgba(236,72,153,0.3)]",
          border: "border-[#163832]/35",
          panel: "from-white/96 via-[#f7f8f3]/94 to-[#edf5ef]/92",
          accent: "bg-[#163832]",
          badge: "text-[#24443d] border-[#163832]/35 bg-[#edf5ef]",
          icon: "🎮",
          label: "Tour actif",
        }
      : variant === "roll"
        ? {
            glow: "shadow-[0_0_0_2px_rgba(251,146,60,0.24),0_0_44px_rgba(251,146,60,0.35)]",
            border: "border-orange-300/50",
            panel: "from-white/96 via-[#f7f8f3]/94 to-orange-50",
            accent: "bg-orange-400",
            badge: "text-orange-800 border-orange-300/70 bg-orange-50",
            icon: "🎲",
            label: "Lancer valide",
          }
        : {
            glow: "shadow-[0_0_0_2px_rgba(163,230,53,0.2),0_0_44px_rgba(163,230,53,0.28)]",
            border: "border-lime-300/40",
            panel: "from-white/96 via-[#f7f8f3]/94 to-lime-50",
            accent: "bg-lime-700",
            badge: "text-lime-800 border-lime-300/70 bg-lime-50",
            icon: "✨",
            label: fr.launchAnnouncement.preparation,
          };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#f7f8f3]/80 p-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(22,56,50,0.12)_0%,rgba(247,248,243,0.42)_45%,rgba(247,248,243,0.76)_100%)]" />
      <div
        className={`relative w-full max-w-xl overflow-hidden rounded-2xl border ${skin.border} bg-gradient-to-br ${skin.panel} p-6 text-center text-[#18211f] backdrop-blur ${skin.glow}`}
      >
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#163832]/25 bg-[#edf5ef] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#24443d]">
          <span className="text-base leading-none">{skin.icon}</span>
          <span>{skin.label}</span>
        </div>

        <h2 className="mt-3 text-2xl font-bold tracking-wide sm:text-[2rem]">{title}</h2>
        {emphasisText ? (
          <div className="mt-3 flex items-center justify-center">
            <div
              className={
                variant === "roll"
                  ? "inline-flex items-center rounded-xl border border-orange-300/70 bg-orange-50 px-4 py-2 text-xl font-black tracking-wide text-orange-900 shadow-[0_0_24px_rgba(251,146,60,0.25)] sm:text-2xl"
                  : "inline-flex items-center rounded-xl border border-[#163832]/35 bg-[#edf5ef] px-4 py-2 text-xl font-black tracking-wide text-[#18211f] shadow-[0_0_24px_rgba(236,72,153,0.3)] sm:text-2xl"
              }
            >
              {emphasisText}
            </div>
          </div>
        ) : null}
        {variant === "roll" && highlightValue != null ? (
          <div className="mt-3 flex items-center justify-center">
            <div className="inline-flex h-20 min-w-20 items-center justify-center rounded-2xl border-2 border-orange-300/80 bg-orange-50 px-5 text-5xl font-black leading-none text-orange-900 shadow-[0_0_24px_rgba(251,146,60,0.22)]">
              {highlightValue}
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-[#24443d] sm:text-base">{subtitle}</p>

        <div className="mt-5 h-2.5 w-full rounded-full bg-[#d8e2d9] p-[2px]">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ease-linear ${skin.accent}`}
            style={{ width: `${Math.max(8, progressRatio * 100)}%` }}
          />
        </div>

        <div
          className={`mt-4 inline-flex rounded-lg border px-3 py-1 text-lg font-semibold ${skin.badge}`}
        >
          {countdown}s
        </div>
      </div>
    </div>
  );
};
