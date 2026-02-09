import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RetroScreenBackground } from "./RetroScreenBackground";

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
      <RetroScreenBackground />

      <div className="relative z-10 w-full max-w-2xl rounded border border-cyan-300/60 bg-card/88 p-5 text-center shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur sm:p-8">
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

        <div className="mt-7 border-t border-cyan-300/25 pt-3 text-[10px] text-cyan-100/75 sm:text-xs">
          <div>Copyright © 2026 By Karl FURGEROT</div>
          <a
            href="mailto:karl.furgerot@gmail.com"
            className="text-cyan-300 underline-offset-2 hover:underline"
          >
            karl.furgerot@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
};
