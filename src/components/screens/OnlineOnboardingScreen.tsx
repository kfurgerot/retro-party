import React, { useEffect, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { PageShell, StickyFooter, AvatarPicker } from "@/components/app-shell";

interface OnlineOnboardingScreenProps {
  connected: boolean;
  initialName?: string;
  initialAvatar?: number;
  /** 1 = focus name, 2 = focus avatar */
  initialStep?: 1 | 2;
  brandLabel?: string;
  accentColor?: string;
  accentGlow?: string;
  onSubmit: (payload: { name: string; avatar: number }) => void;
  onBack: () => void;
  overallStepStart?: number;
  overallStepTotal?: number;
}

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 16);

export const OnlineOnboardingScreen: React.FC<OnlineOnboardingScreenProps> = ({
  connected,
  initialName,
  initialAvatar,
  initialStep = 1,
  brandLabel,
  accentColor = "#6366f1",
  accentGlow = "rgba(99,102,241,0.04)",
  onSubmit,
  onBack,
  overallStepStart,
  overallStepTotal,
}) => {
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const n = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, n));
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const validName = name.length >= 2;
  const canSubmit = connected && validName;

  useEffect(() => {
    if (initialStep === 2) {
      avatarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      nameRef.current?.focus();
    }
  }, [initialStep]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ name: cleanName(name), avatar });
  };

  const showStepBadge =
    typeof overallStepStart === "number" && typeof overallStepTotal === "number";

  return (
    <PageShell
      accentColor={`${accentColor}12`}
      accentGlow={accentGlow}
    >
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {fr.onlineOnboarding.back}
        </button>
        {showStepBadge && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-500">
            Étape {overallStepStart} / {overallStepTotal}
          </span>
        )}
      </div>

      {/* Heading */}
      <div className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
        {brandLabel ?? "Agile Suite"}
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
        Ton profil
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Choisis un pseudo et un avatar pour rejoindre la session.
      </p>

      <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <label htmlFor="ds-name" className="mb-3 block text-sm font-semibold text-slate-200">
              {fr.onlineOnboarding.displayNameLabel}
            </label>
            <input
              ref={nameRef}
              id="ds-name"
              value={name}
              maxLength={16}
              placeholder={fr.onlineOnboarding.displayNamePlaceholder}
              autoComplete="off"
              onChange={(e) => setName(cleanName(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition focus:border-white/20 focus:bg-white/[0.06]"
            />
            {!validName && name.length > 0 && (
              <p className="mt-2 text-xs text-amber-400">{fr.onlineOnboarding.minName}</p>
            )}
          </div>

          {/* Avatar */}
          <div ref={avatarRef} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="mb-4 text-sm font-semibold text-slate-200">
              {fr.onlineOnboarding.avatarLabel}
            </p>
            <AvatarPicker value={avatar} onChange={setAvatar} accentColor={accentColor} />
          </div>
        </div>

        {/* Profile preview */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500">
            Aperçu
          </p>
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl border text-4xl"
              style={{ borderColor: `${accentColor}30`, background: `${accentColor}10` }}
            >
              {AVATARS[avatar] ?? "?"}
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-slate-100">
                {validName ? name : (
                  <span className="text-slate-600">{fr.onlineOnboarding.displayNamePlaceholder}</span>
                )}
              </div>
              <div
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: connected ? "#10b981" : "#f59e0b",
                  background: connected ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                  borderColor: connected ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
                }}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", connected && "animate-pulse")}
                  style={{ background: connected ? "#10b981" : "#f59e0b" }}
                />
                {connected ? fr.onlineLobby.connected : fr.onlineOnboarding.connecting}
              </div>
            </div>
          </div>
        </div>
      </div>

      <StickyFooter>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            {fr.onlineOnboarding.back}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 flex-1 rounded-xl px-5 text-sm font-bold text-white transition disabled:opacity-40 sm:flex-none sm:min-w-[160px]"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
              boxShadow: canSubmit ? `0 4px 16px ${accentColor}40` : "none",
            }}
          >
            {fr.onlineOnboarding.continue}
          </button>
        </div>
      </StickyFooter>
    </PageShell>
  );
};
