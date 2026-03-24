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
  const radiusX = 38;
  const radiusY = 30;
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
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_62%)]" />

      <div className="relative h-full w-full">
        <div className="absolute left-1/2 top-1/2 h-[40%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-50 shadow-sm" />

        <div className="absolute left-1/2 top-1/2 z-10 w-[62%] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
          <p className="text-sm font-medium text-slate-700">{revealed ? "Revelation des votes" : "En attente des votes..."}</p>
        </div>

        {seats.map(({ player, x, y }) => {
          const voted = player.hasVoted;
          const cardClass = !voted
            ? "border-slate-300 bg-slate-100 text-slate-400"
            : revealed
            ? "border-blue-300 bg-blue-100 text-blue-800"
            : "border-emerald-300 bg-emerald-100 text-emerald-800";

          return (
            <div
              key={player.socketId}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg shadow-sm">
                  {AVATARS[player.avatar] ?? ":)"}
                </div>
                <div className="max-w-[90px] truncate text-center text-[11px] text-slate-600">{player.name}</div>
                {player.isHost ? <div className="text-[10px] text-blue-600">Host</div> : null}
                <div className={`min-h-8 min-w-14 rounded-md border px-2 py-1 text-center text-xs font-medium ${cardClass}`}>
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
