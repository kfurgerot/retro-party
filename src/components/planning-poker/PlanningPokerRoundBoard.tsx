import React, { useEffect, useMemo, useState } from "react";
import { AVATARS } from "@/types/game";
import { PlanningPokerPlayer } from "@/types/planningPoker";

type Props = {
  players: PlanningPokerPlayer[];
  revealed: boolean;
  storyTitle: string;
  round: number;
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

const SeatVoteCard: React.FC<{ player: PlanningPokerPlayer; revealed: boolean }> = ({ player, revealed }) => {
  const [flipped, setFlipped] = useState(false);
  const valueLabel =
    player.vote === "?" || player.vote === "☕" ? "?" : player.vote ?? "-";

  useEffect(() => {
    if (!player.hasVoted || !revealed) {
      setFlipped(false);
      return;
    }
    const timer = window.setTimeout(() => setFlipped(true), 60);
    return () => window.clearTimeout(timer);
  }, [player.hasVoted, player.vote, revealed]);

  if (!player.hasVoted) {
    return (
      <div className="flex h-[44px] w-[30px] items-center justify-center rounded-md border border-slate-300/70 bg-white text-[11px] font-semibold text-slate-400 shadow-[0_6px_14px_rgba(2,6,23,0.35)] sm:h-[56px] sm:w-[38px] sm:text-xs">
        -
      </div>
    );
  }

  return (
    <div className="h-[44px] w-[30px] [perspective:700px] sm:h-[56px] sm:w-[38px]">
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 rounded-md border border-slate-300/70 bg-white shadow-[0_6px_14px_rgba(2,6,23,0.35)] [backface-visibility:hidden]" />
        <div className="absolute inset-0 flex items-center justify-center rounded-md border border-slate-300/70 bg-white text-[11px] font-bold text-slate-900 shadow-[0_6px_14px_rgba(2,6,23,0.35)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:text-xs">
          {revealed ? valueLabel : ""}
        </div>
      </div>
    </div>
  );
};

export const PlanningPokerRoundBoard: React.FC<Props> = ({ players, revealed, storyTitle, round }) => {
  const seats = useMemo(() => buildSeats(players), [players]);
  const displayedStory = storyTitle.trim() || `Story #${round}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cyan-300/28 bg-slate-950/40 p-2.5 sm:p-4 lg:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.12),_transparent_64%)]" />

      <div className="relative h-full w-full">
        <div className="absolute left-1/2 top-1/2 h-[42%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/22 bg-slate-900/55 shadow-[0_0_0_1px_rgba(34,211,238,0.08)] sm:h-[44%] sm:w-[68%] lg:h-[50%] lg:w-[74%]" />

        <div className="absolute left-1/2 top-1/2 z-10 w-[74%] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center sm:w-[66%] sm:px-4 sm:py-3">
          <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/80 sm:text-[11px]">{displayedStory}</p>
          <p className="text-xs font-medium text-cyan-50 sm:text-sm">{revealed ? "Revelation des votes" : "En attente des votes..."}</p>
        </div>

        {seats.map(({ player, x, y }) => (
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
              <SeatVoteCard player={player} revealed={revealed} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
