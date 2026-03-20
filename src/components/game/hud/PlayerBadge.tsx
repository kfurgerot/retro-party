import React from "react";
import { cn } from "@/lib/utils";

interface PlayerBadgeProps {
  name: string;
  avatar?: string;
  roleLabel?: string;
  highlighted?: boolean;
  rightSlot?: React.ReactNode;
}

export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  name,
  avatar,
  roleLabel,
  highlighted = false,
  rightSlot,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
        highlighted ? "border-cyan-300/60 bg-cyan-500/10" : "border-cyan-300/25 bg-slate-900/60"
      )}
    >
      <div className="min-w-0">
        {roleLabel ? <div className="text-[10px] uppercase tracking-[0.08em] text-cyan-200/80">{roleLabel}</div> : null}
        <div className="truncate text-sm font-semibold">
          {avatar ? `${avatar} ` : ""}
          {name}
        </div>
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
};

