import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { RetroScreenBackground } from "./RetroScreenBackground";

type SetupMode = "host" | "join";

interface OnlineOnboardingScreenProps {
  connected: boolean;
  initialName?: string;
  initialAvatar?: number;
  initialMode?: SetupMode;
  initialCode?: string;
  onSubmit: (payload: { name: string; avatar: number; mode: SetupMode; code: string }) => void;
  onBack: () => void;
}

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, 16);
const cleanCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export const OnlineOnboardingScreen: React.FC<OnlineOnboardingScreenProps> = ({
  connected,
  initialName,
  initialAvatar,
  initialMode,
  initialCode,
  onSubmit,
  onBack,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(() => cleanName(initialName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const next = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, next));
  });
  const [mode, setMode] = useState<SetupMode>(initialMode ?? "host");
  const [code, setCode] = useState(() => cleanCode(initialCode ?? ""));

  const validName = name.length >= 2;
  const validCode = cleanCode(code).length >= 4;
  const canSubmit = connected && validName && (mode === "host" || validCode);

  const stepTitle = useMemo(() => {
    if (step === 1) return "Choisi ton nickname";
    if (step === 2) return "Choisi ton personnage";
    return "Heberger ou rejoindre";
  }, [step]);

  const goNext = () => {
    if (step === 1 && !validName) return;
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 1) setStep(2);
  };

  const goBack = () => {
    if (step === 1) {
      onBack();
      return;
    }
    if (step === 3) {
      setStep(2);
      return;
    }
    setStep(1);
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />

      <div className="relative z-10 w-full max-w-2xl rounded border border-cyan-300/60 bg-card/88 p-5 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
          <span>Retro Party Online</span>
          <span>Etape {step}/3</span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {stepTitle}
        </h1>

        {step === 1 && (
          <div className="mt-8 space-y-2">
            <p className="text-xs text-slate-300 sm:text-sm">Entre ton pseudo joueur</p>
            <Input
              autoFocus
              value={name}
              maxLength={16}
              placeholder="Ton nickname"
              onChange={(e) => setName(cleanName(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && validName && goNext()}
            />
            {!validName && name.length > 0 && (
              <p className="text-xs text-amber-300">Min. 2 caracteres</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mt-8">
            <p className="mb-3 text-xs text-slate-300 sm:text-sm">Choisis ton avatar</p>
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
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("host")}
                className={cn(
                  "h-11 border-border/70 bg-background/50 font-semibold text-foreground transition-all hover:bg-background/70",
                  mode === "host"
                    ? "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                    : "opacity-95"
                )}
              >
                Heberger
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode("join")}
                className={cn(
                  "h-11 border-border/70 bg-background/50 font-semibold text-foreground transition-all hover:bg-background/70",
                  mode === "join"
                    ? "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                    : "opacity-95"
                )}
              >
                Rejoindre
              </Button>
            </div>

            {mode === "join" && (
              <div className="space-y-1">
                <Input
                  value={code}
                  maxLength={6}
                  placeholder="Code room"
                  onChange={(e) => setCode(cleanCode(e.target.value))}
                />
                {!validCode && code.length > 0 && (
                  <p className="text-xs text-amber-300">Min. 4 caracteres (A-Z0-9)</p>
                )}
              </div>
            )}

            {!connected && (
              <p className="text-xs text-amber-300">Connexion au serveur...</p>
            )}

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() =>
                onSubmit({
                  name: cleanName(name),
                  avatar,
                  mode,
                  code: cleanCode(code),
                })
              }
              className="h-12 w-full border border-cyan-300 bg-cyan-500 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.45)] hover:bg-cyan-400"
            >
              {mode === "host" ? "Creer la room" : "Rejoindre la room"}
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
            {step === 1 ? "Retour" : "Precedent"}
          </Button>

          {step < 3 && (
            <Button
              type="button"
              onClick={goNext}
              disabled={step === 1 && !validName}
              className="border border-cyan-300 bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Suivant
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
