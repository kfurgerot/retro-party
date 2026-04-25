import React from "react";
import { Card } from "@/components/app-shell";
import { AVATARS } from "@/types/game";
import { PlanningPokerPlayer } from "@/types/planningPoker";

type Props = {
  spectators: PlanningPokerPlayer[];
  compact?: boolean;
};

export const SpectatorsPanel: React.FC<Props> = ({ spectators, compact = false }) => {
  return (
    <Card className="grid content-start gap-2 p-3 sm:p-4">
      <div className="text-xs uppercase tracking-[0.1em] text-[#647067]">Spectateurs</div>
      <div className="grid gap-1.5">
        {spectators.length > 0 ? (
          spectators.map((spectator) => (
            <div
              key={spectator.socketId}
              className="flex items-center justify-between rounded border border-[#d8e2d9] bg-white/70 px-2 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className={compact ? "text-base" : "text-lg"}>
                  {AVATARS[spectator.avatar] ?? ":)"}
                </span>
                <span className="truncate text-xs text-[#18211f]">{spectator.name}</span>
              </div>
              <div className="text-[10px] text-[#647067]">
                {spectator.connected ? "ONLINE" : "OFF"}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded border border-[#d8e2d9] bg-white/70 px-2 py-1.5 text-xs text-[#647067]">
            Aucun spectateur.
          </div>
        )}
      </div>
    </Card>
  );
};
