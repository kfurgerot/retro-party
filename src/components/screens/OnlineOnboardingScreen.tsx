import React, { useMemo, useState } from "react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { fr } from "@/i18n/fr";
import { Card, Input, PrimaryButton, SecondaryButton, SectionHeader } from "@/components/app-shell";
import { APP_SHELL_INPUT } from "@/lib/uiTokens";
import { useAnimatedProgress } from "@/hooks/useAnimatedProgress";

interface OnlineOnboardingScreenProps {
  connected: boolean;
  initialName?: string;
  initialAvatar?: number;
  initialStep?: 1 | 2;
  brandLabel?: string;
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
  onSubmit,
  onBack,
  overallStepStart,
  overallStepTotal,
}) => {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const next = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, next));
  });

  const validName = name.length >= 2;
  const canNext = validName;
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
  const progressFromPct = showOverallStep
    ? Math.max(0, Math.min(100, Math.round(((currentOverallStep - 1) / overallStepTotal) * 100)))
    : step === 1
      ? 0
      : 50;
  const animatedProgressPct = useAnimatedProgress(progressPct, progressFromPct);

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-28 pt-4 sm:pb-28 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{brandLabel || fr.onlineOnboarding.brand}</span>
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
            style={{ width: `${animatedProgressPct}%` }}
          />
        </div>

        <div className="mt-6 grid flex-1 content-start gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Card className="rounded-md p-4 sm:p-5">
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
                  className={APP_SHELL_INPUT}
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
                        "h-12 w-12 rounded-md border border-cyan-400/20 bg-slate-900/50 text-2xl transition hover:border-cyan-300/60 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:h-12 sm:w-12",
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
          </Card>

          <Card className="rounded-md p-4">
            <SectionHeader title={fr.onlineLobby.profileTitle} />
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
          </Card>
        </div>

      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton
              type="button"
              className="h-11"
              onClick={goBack}
            >
              {fr.onlineOnboarding.back}
            </SecondaryButton>

            {step === 1 ? (
              <PrimaryButton
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className="h-11 font-semibold"
              >
                {fr.onlineOnboarding.next}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                type="button"
                disabled={!canSubmit}
                onClick={() => onSubmit({ name: cleanName(name), avatar })}
                className="h-11 px-6 text-sm font-semibold tracking-wide"
              >
                {fr.onlineOnboarding.continue}
              </PrimaryButton>
            )}
          </div>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              type="button"
              className="h-12 min-h-0"
              onClick={goBack}
            >
              {fr.onlineOnboarding.back}
            </SecondaryButton>

            {step === 1 ? (
              <PrimaryButton
                type="button"
                onClick={goNext}
                disabled={!canNext}
                className="h-12 min-h-0 font-semibold"
              >
                {fr.onlineOnboarding.next}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                type="button"
                disabled={!canSubmit}
                onClick={() => onSubmit({ name: cleanName(name), avatar })}
                className="h-12 min-h-0 font-semibold tracking-wide"
              >
                {fr.onlineOnboarding.continue}
              </PrimaryButton>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
