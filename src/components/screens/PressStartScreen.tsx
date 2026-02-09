import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface PressStartScreenProps {
  onStart: () => void;
}

export const PressStartScreen: React.FC<PressStartScreenProps> = ({ onStart }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onStart();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onStart]);

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.2),transparent_35%),linear-gradient(to_bottom,rgba(15,23,42,0.95),rgba(2,6,23,1))]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-2xl rounded border border-cyan-400/50 bg-card/85 p-5 text-center shadow-[0_0_0_2px_rgba(34,211,238,0.25),0_0_28px_rgba(34,211,238,0.25)] backdrop-blur sm:p-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
          Retro Party Online
        </div>
        <h1 className="mt-4 text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          Press Start
        </h1>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
          Appuie sur START pour entrer dans le lobby multijoueur.
        </p>

        <div className="mt-8">
          <Button
            onClick={onStart}
            className="h-12 w-full animate-pixel-pulse border border-cyan-300 bg-cyan-500 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.45)] hover:bg-cyan-400 sm:w-auto sm:px-12"
          >
            Start
          </Button>
        </div>

        <div className="mt-4 text-[10px] text-slate-400 sm:text-xs">
          Enter / Espace / Clic
        </div>
      </div>
    </div>
  );
};
