import React from "react";
import { cn } from "@/lib/utils";

interface StickyFooterProps {
  children: React.ReactNode;
  maxWidth?: "4xl" | "5xl";
  className?: string;
}

export const StickyFooter = ({ children, maxWidth = "4xl", className }: StickyFooterProps) => (
  <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
    <div
      className={cn(
        "pointer-events-auto mx-auto w-full rounded-2xl border border-white/[0.07] bg-[#0a0a14]/96 p-3 shadow-[0_-1px_0_rgba(255,255,255,0.04),0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur",
        maxWidth === "5xl" ? "max-w-5xl" : "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  </div>
);
