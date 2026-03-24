import React, { useMemo } from "react";
import { AVATARS } from "@/types/game";
import { PlanningPokerPlayer } from "@/types/planningPoker";

type Props = {
  players: PlanningPokerPlayer[];
  revealed: boolean;
};

type Seat = {
  player: PlanningPokerPlayer;
  x: number;
  y: number;
};

function buildSeats(players: PlanningPokerPlayer[]): Seat[] {
  const count = Math.max(1, players.length);
  const angleStep = (Math.PI * 2) / count;
  const radiusX = 40;
  const radiusY = 31;
  return players.map((player, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      player,
      x: 50 + Math.cos(angle) * radiusX,
      y: 50 + Math.sin(angle) * radiusY,
    };
  });
}

function playerCardLabel(player: PlanningPokerPlayer, revealed: boolean) {
  if (!player.hasVoted) return "-";
  if (!revealed) return "Vote";
  return player.vote ?? "-";
}

export const PlanningPokerRoundBoard: React.FC<Props> = ({ players, revealed }) => {
  const seats = useMemo(() => buildSeats(players), [players]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cyan-300/28 bg-slate-950/40 p-2.5 sm:p-4 lg:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.12),_transparent_64%)]" />

      <div className="relative h-full w-full">
        <div className="absolute left-1/2 top-1/2 h-[42%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/22 bg-slate-900/55 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] sm:h-[44%] sm:w-[68%] lg:h-[50%] lg:w-[74%]" />

        <div className="absolute left-1/2 top-1/2 z-10 w-[74%] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center sm:w-[66%] sm:px-4 sm:py-3">
          <p className="text-xs font-medium text-cyan-50 sm:text-sm">{revealed ? "Revelation des votes" : "En attente des votes..."}</p>
        </div>

        {seats.map(({ player, x, y }) => {
          const voted = player.hasVoted;
          const cardClass = !voted
            ? "border-slate-500/40 bg-slate-800/55 text-slate-300"
            : revealed
            ? "border-cyan-300/45 bg-cyan-500/18 text-cyan-100"
            : "border-emerald-300/45 bg-emerald-500/16 text-emerald-100";

          return (
            <div
              key={player.socketId}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-slate-900/85 text-base shadow-[0_0_0_1px_rgba(34,211,238,0.12)] sm:h-10 sm:w-10 sm:text-lg">
                  {AVATARS[player.avatar] ?? ":)"}
                </div>
                <div className="max-w-[78px] truncate text-center text-[10px] text-cyan-50 sm:max-w-[90px] sm:text-[11px]">{player.name}</div>
                {player.isHost ? <div className="text-[10px] text-cyan-200">Host</div> : null}
                <div className={`min-h-7 min-w-12 rounded-md border px-1.5 py-0.5 text-center text-[11px] font-medium sm:min-h-8 sm:min-w-14 sm:px-2 sm:py-1 sm:text-xs ${cardClass}`}>
                  {playerCardLabel(player, revealed)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
