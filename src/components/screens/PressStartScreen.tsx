import React, { useEffect } from "react";
import { Card, PrimaryButton } from "@/components/app-shell";
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
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#f7f8f3] px-4 py-8 text-[#18211f]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

      <Card tone="saas" className="relative z-10 w-full max-w-2xl p-5 text-center sm:p-8">
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#647067]">
          {fr.pressStart.brand}
        </div>
        <h1 className="mt-4 text-xl font-black tracking-tight text-[#18211f] sm:text-3xl">
          {fr.pressStart.title}
        </h1>
        <p className="mt-4 text-[11px] leading-relaxed text-[#647067] sm:text-xs">
          {fr.pressStart.subtitle}
        </p>

        <div className="mt-8">
          <PrimaryButton
            tone="saas"
            onClick={onStart}
            className="h-12 w-full uppercase tracking-wide sm:w-auto sm:px-12"
          >
            {fr.pressStart.button}
          </PrimaryButton>
        </div>

        <div className="mt-4 text-[10px] text-[#647067] sm:text-xs">{fr.pressStart.controls}</div>

        <div className="mt-7 border-t border-[#d8e2d9] pt-3 text-[10px] text-[#647067] sm:text-xs">
          <div>{fr.pressStart.copyright}</div>
          <a
            href="mailto:karl.furgerot@gmail.com"
            className="font-semibold text-[#24443d] underline-offset-2 hover:underline"
          >
            karl.furgerot@gmail.com
          </a>
        </div>
      </Card>
    </div>
  );
};
