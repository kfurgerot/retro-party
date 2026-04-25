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
        highlighted ? "border-[#163832]/35 bg-[#edf5ef]" : "border-[#d8e2d9] bg-white/68",
      )}
    >
      <div className="min-w-0">
        {roleLabel ? (
          <div className="text-[10px] uppercase tracking-[0.08em] text-[#647067]">{roleLabel}</div>
        ) : null}
        <div className="truncate text-sm font-semibold">
          {avatar ? `${avatar} ` : ""}
          {name}
        </div>
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
};
