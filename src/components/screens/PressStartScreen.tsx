import React, { useEffect } from "react";
import { Card, PrimaryButton } from "@/components/app-shell";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { fr } from "@/i18n/fr";

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

      <Card className="relative z-10 w-full max-w-2xl p-5 text-center sm:p-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-200/80">
          {fr.pressStart.brand}
        </div>
        <h1 className="mt-4 text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {fr.pressStart.title}
        </h1>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
          {fr.pressStart.subtitle}
        </p>

        <div className="mt-8">
          <PrimaryButton
            onClick={onStart}
            className="h-12 w-full animate-pixel-pulse uppercase tracking-wide sm:w-auto sm:px-12"
          >
            {fr.pressStart.button}
          </PrimaryButton>
        </div>

        <div className="mt-4 text-[10px] text-slate-400 sm:text-xs">
          {fr.pressStart.controls}
        </div>

        <div className="mt-7 border-t border-cyan-300/25 pt-3 text-[10px] text-cyan-100/75 sm:text-xs">
          <div>{fr.pressStart.copyright}</div>
          <a
            href="mailto:karl.furgerot@gmail.com"
            className="text-cyan-300 underline-offset-2 hover:underline"
          >
            karl.furgerot@gmail.com
          </a>
        </div>
      </Card>
    </div>
  );
};
