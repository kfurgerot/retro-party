import React from "react";
import { cn } from "@/lib/utils";

interface SessionFrameProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  height?: "screen" | "min";
}

export const SessionFrame = ({
  children,
  className,
  contentClassName,
  height = "screen",
}: SessionFrameProps) => (
  <div
    className={cn(
      "relative w-full overflow-hidden bg-[#f7f8f3] text-[#18211f]",
      height === "screen" ? "h-svh" : "min-h-svh",
      className,
    )}
    style={{ fontFamily: "'DM Sans', sans-serif" }}
  >
    <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
    <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

    <div className={cn("relative z-10", contentClassName)}>{children}</div>
  </div>
);
