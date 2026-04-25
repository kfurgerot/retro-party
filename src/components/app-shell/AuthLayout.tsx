import React from "react";
import { Card } from "./Card";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  stepLabel?: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, stepLabel, children }) => {
  return (
    <div className="relative flex min-h-svh w-full items-start justify-center overflow-hidden bg-[#f7f8f3] text-[#18211f] px-4 pb-8 pt-4 sm:pt-6">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />
      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-6">
        {stepLabel ? (
          <div className="mb-3 flex justify-end text-[10px] uppercase tracking-[0.16em] text-[#24443d]/80">
            <span className="rounded-full border border-[#163832]/35 px-2 py-0.5">{stepLabel}</span>
          </div>
        ) : null}
        <h1 className="text-center text-2xl font-semibold tracking-tight text-[#24443d]">
          {title}
        </h1>
        {subtitle ? <p className="mt-2 text-center text-sm text-[#647067]">{subtitle}</p> : null}
        <div className="mt-5 flex-1">{children}</div>
      </Card>
    </div>
  );
};
