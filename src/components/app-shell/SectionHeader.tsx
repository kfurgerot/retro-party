import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, description, className }) => {
  return (
    <div className={cn("mb-3", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100/80">{title}</div>
      {description ? <p className="mt-1 text-xs text-slate-300">{description}</p> : null}
    </div>
  );
};

