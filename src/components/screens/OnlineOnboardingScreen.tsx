import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";

interface OnlineOnboardingScreenProps {
  connected: boolean;
  initialName?: string;
  initialAvatar?: number;
  onSubmit: (payload: { name: string; avatar: number }) => void;
  onBack: () => void;
}

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 16);

export const OnlineOnboardingScreen: React.FC<OnlineOnboardingScreenProps> = ({
  connected,
  initialName,
  initialAvatar,
  onSubmit,
  onBack,
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
    if (step === 1) return "Choose your nickname";
    return "Choose your avatar";
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

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />

      <div className="relative z-10 w-full max-w-2xl rounded border border-cyan-300/60 bg-card/88 p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>Retro Agile Toolbox</span>
          <span>Step {step}/2</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {stepTitle}
        </h1>

        {step === 1 && (
          <div className="mt-8 space-y-2">
            <p className="text-xs text-slate-300 sm:text-sm">Enter your display name</p>
            <Input
              autoFocus
              value={name}
              maxLength={16}
              placeholder="Your nickname"
              onChange={(e) => setName(cleanName(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && validName && goNext()}
            />
            {!validName && name.length > 0 && (
              <p className="text-xs text-amber-300">Min. 2 characters</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8">
            <p className="mb-3 text-xs text-slate-300 sm:text-sm">Pick your avatar</p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {AVATARS.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvatar(i)}
                  className={cn(
                    "h-12 w-12 rounded-md border border-cyan-400/20 bg-slate-900/50 text-2xl transition hover:border-cyan-300/60 hover:bg-slate-900/70",
                    i === avatar && "ring-2 ring-cyan-400"
                  )}
                  aria-label={`Avatar ${i + 1}`}
                >
                  {a}
                </button>
              ))}
            </div>

            {!connected && (
              <p className="mt-4 text-xs text-amber-300">Connecting to server...</p>
            )}

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => onSubmit({ name: cleanName(name), avatar })}
              className="mt-6 h-12 w-full border border-cyan-300 bg-cyan-500 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.45)] hover:bg-cyan-400"
            >
              Continue
            </Button>
          </div>
        )}

        <div className="mt-8 flex justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            className="border-border/70 bg-background/50 text-foreground hover:bg-background/70"
            onClick={goBack}
          >
            {step === 1 ? "Back" : "Previous"}
          </Button>

          {step < 2 && (
            <Button
              type="button"
              onClick={goNext}
              disabled={step === 1 && !validName}
              className="border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
