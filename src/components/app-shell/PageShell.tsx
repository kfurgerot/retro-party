import React from "react";
import { cn } from "@/lib/utils";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: string;
  accentGlow?: string;
  maxWidth?: "sm" | "4xl" | "5xl" | "6xl";
  noPadding?: boolean;
  tone?: "game" | "saas";
}

export const PageShell = ({
  children,
  className,
  accentColor = "rgba(99,102,241,0.08)",
  accentGlow = "rgba(236,72,153,0.04)",
  maxWidth = "4xl",
  noPadding = false,
  tone = "saas",
  ...props
}: PageShellProps) => {
  const maxWidthClass = {
    sm: "max-w-sm",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
  }[maxWidth];

  return (
    <div
      className={cn(
        "relative min-h-svh overflow-hidden",
        tone === "saas" ? "bg-[#f7f8f3] text-[#18211f]" : "text-slate-100",
        className,
      )}
      style={{
        background: tone === "saas" ? undefined : "#0a0a14",
        fontFamily: "'DM Sans', sans-serif",
      }}
      {...props}
    >
      {tone === "saas" ? (
        <>
          <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
          <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />
        </>
      ) : (
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 15% 5%, ${accentColor} 0%, transparent 70%),
              radial-gradient(ellipse 50% 35% at 85% 90%, ${accentGlow} 0%, transparent 70%)
            `,
          }}
        />
      )}
      <div
        className={cn(
          "relative z-10 mx-auto",
          !noPadding && "px-4 pb-28 pt-5 sm:px-5 sm:pt-7",
          maxWidthClass,
        )}
      >
        {children}
      </div>
    </div>
  );
};
