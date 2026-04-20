import React from "react";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { Card } from "./Card";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  stepLabel?: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, stepLabel, children }) => {
  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-8 pt-4 sm:pt-6">
      <RetroScreenBackground />
      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-6">
        {stepLabel ? (
          <div className="mb-3 flex justify-end text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
            <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">{stepLabel}</span>
          </div>
        ) : null}
        <h1 className="text-center text-2xl font-semibold tracking-tight text-cyan-200">{title}</h1>
        {subtitle ? <p className="mt-2 text-center text-sm text-slate-300">{subtitle}</p> : null}
        <div className="mt-5 flex-1">{children}</div>
      </Card>
    </div>
  );
};
