import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
  tone?: "game" | "saas";
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  className,
  tone = "game",
}) => {
  return (
    <div className={cn("mb-3", className)}>
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.14em]",
          tone === "saas" ? "text-[#66766f]" : "text-cyan-100/80",
        )}
      >
        {title}
      </div>
      {description ? (
        <p className={cn("mt-1 text-xs", tone === "saas" ? "text-[#647067]" : "text-slate-300")}>
          {description}
        </p>
      ) : null}
    </div>
  );
};
