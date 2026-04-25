import React from "react";
import { cn } from "@/lib/utils";

interface PixelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: "cyan" | "magenta" | "gold" | "none";
}

export const PixelCard: React.FC<PixelCardProps> = ({
  children,
  glow = "none",
  className,
  ...props
}) => {
  const glowStyles = {
    cyan: "shadow-[0_14px_34px_rgba(22,56,50,0.16)]",
    magenta: "shadow-[0_14px_34px_rgba(22,56,50,0.14)]",
    gold: "shadow-[0_14px_34px_rgba(245,158,11,0.16)]",
    none: "shadow-sm",
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-[#d8e2d9] bg-white/70 p-4 text-[#18211f] backdrop-blur",
        glowStyles[glow],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
