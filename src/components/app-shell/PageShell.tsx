import React from "react";
import { cn } from "@/lib/utils";

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  accentColor?: string;
  accentGlow?: string;
  maxWidth?: "4xl" | "5xl" | "6xl";
  noPadding?: boolean;
}

export const PageShell = ({
  children,
  className,
  accentColor = "rgba(99,102,241,0.08)",
  accentGlow = "rgba(236,72,153,0.04)",
  maxWidth = "4xl",
  noPadding = false,
  ...props
}: PageShellProps) => {
  const maxWidthClass = { "4xl": "max-w-4xl", "5xl": "max-w-5xl", "6xl": "max-w-6xl" }[maxWidth];

  return (
    <div
      className={cn("relative min-h-svh overflow-hidden text-slate-100", className)}
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
      {...props}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 15% 5%, ${accentColor} 0%, transparent 70%),
            radial-gradient(ellipse 50% 35% at 85% 90%, ${accentGlow} 0%, transparent 70%)
          `,
        }}
      />
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
