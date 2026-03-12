import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { fr } from "@/i18n/fr";
import { CTA_NEON_PRIMARY, CTA_NEON_SECONDARY } from "@/lib/uiTokens";

interface OnlineOnboardingScreenProps {
  connected: boolean;
  initialName?: string;
  initialAvatar?: number;
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
  onSubmit,
  onBack,
  overallStepStart,
  overallStepTotal,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const next = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, next));
  });

  const validName = name.length >= 2;
  const canSubmit = connected && validName;

  const stepTitle = useMemo(() => {
    if (step === 1) return fr.onlineOnboarding.nicknameTitle;
    return fr.onlineOnboarding.avatarTitle;
  }, [step]);

  const goNext = () => {
    if (step === 1 && !validName) return;
    setStep(2);
  };

  const goBack = () => {
    if (step === 1) {
      onBack();
      return;
    }
    setStep(1);
  };

  const currentOverallStep =
    typeof overallStepStart === "number" ? overallStepStart + (step === 2 ? 1 : 0) : null;
  const showOverallStep = currentOverallStep !== null && typeof overallStepTotal === "number";
  const progressPct = showOverallStep
    ? Math.max(0, Math.min(100, Math.round((currentOverallStep / overallStepTotal) * 100)))
    : step === 1
      ? 50
      : 100;

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-8 pt-4 sm:pt-6">
      <RetroScreenBackground />

      <div className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col rounded border border-cyan-300/60 bg-card/88 p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.onlineOnboarding.brand}</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">
            {showOverallStep
              ? `${fr.onlineOnboarding.step} ${currentOverallStep}/${overallStepTotal}`
              : `${fr.onlineOnboarding.step} ${step}/2`}
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {stepTitle}
        </h1>

        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-slate-900/55">
          <div
            className="h-full rounded bg-cyan-400/90 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-6 grid flex-1 content-start gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="neon-surface rounded-md p-4 sm:p-5">
            {step === 1 && (
              <div className="space-y-2">
                <label htmlFor="display-name" className="text-xs text-slate-300 sm:text-sm">
                  {fr.onlineOnboarding.displayNameLabel}
                </label>
                <Input
                  id="display-name"
                  autoFocus
                  value={name}
                  maxLength={16}
                  placeholder={fr.onlineOnboarding.displayNamePlaceholder}
                  onChange={(e) => setName(cleanName(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && validName && goNext()}
                  className="h-11 border-cyan-300/25 bg-slate-900/45 text-cyan-50 placeholder:text-slate-400"
                />
                {!validName && name.length > 0 && (
                  <p className="text-xs text-amber-300">{fr.onlineOnboarding.minName}</p>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="mb-3 text-xs text-slate-300 sm:text-sm">{fr.onlineOnboarding.avatarLabel}</p>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {AVATARS.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatar(i)}
                      className={cn(
                        "h-12 w-12 rounded-md border border-cyan-400/20 bg-slate-900/50 text-2xl transition hover:border-cyan-300/60 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                        i === avatar && "ring-2 ring-cyan-400"
                      )}
                      aria-label={fr.onlineOnboarding.avatarAria.replace("{index}", String(i + 1))}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {!connected && (
                  <p className="mt-4 text-xs text-amber-300">{fr.onlineOnboarding.connecting}</p>
                )}
              </div>
            )}
          </div>

          <div className="neon-surface rounded-md p-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
              {fr.onlineLobby.profileTitle}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded border border-cyan-300/25 bg-slate-900/55 px-3 py-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded border border-cyan-300/30 bg-slate-950/65 text-2xl">
                {AVATARS[avatar] ?? "?"}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-cyan-50">
                  {validName ? name : fr.onlineOnboarding.displayNamePlaceholder}
                </div>
                <div className="text-xs text-slate-300">{fr.onlineOnboarding.avatarTitle}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-1 text-[11px] text-slate-300">
              <div>
                {fr.onlineOnboarding.step} 1:{" "}
                <span className={cn("font-semibold", validName ? "text-emerald-200" : "text-amber-200")}>
                  {validName ? fr.onlineLobby.checklistReady : fr.onlineLobby.checklistBlocked}
                </span>
              </div>
              <div>
                {fr.onlineOnboarding.step} 2:{" "}
                <span className={cn("font-semibold", step === 2 ? "text-emerald-200" : "text-cyan-200")}>
                  {step === 2 ? fr.onlineLobby.checklistReady : fr.onlineOnboarding.next}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            className={CTA_NEON_SECONDARY}
            onClick={goBack}
          >
            {step === 1 ? fr.onlineOnboarding.back : fr.onlineOnboarding.previous}
          </Button>

          {step === 1 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!validName}
              className={`font-semibold ${CTA_NEON_PRIMARY}`}
            >
              {fr.onlineOnboarding.next}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => onSubmit({ name: cleanName(name), avatar })}
              className={`h-11 px-6 text-sm font-semibold uppercase tracking-wide ${CTA_NEON_PRIMARY}`}
            >
              {fr.onlineOnboarding.continue}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
