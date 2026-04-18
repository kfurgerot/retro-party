import React, { useEffect, useMemo, useRef, useState } from "react";
import { AVATARS } from "@/types/game";
import { PLANNING_POKER_DECKS } from "@/lib/planningPoker";
import { PlanningPokerPlayer, PlanningPokerVoteSystem } from "@/types/planningPoker";

type Props = {
  players: PlanningPokerPlayer[];
  revealed: boolean;
  votesOpen: boolean;
  storyTitle: string;
  round: number;
  voteSystem: PlanningPokerVoteSystem;
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

const normalizeVoteValue = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  if (normalized === "☕" || normalized === "☕️" || normalized === "â˜•" || normalized === "â?•") {
    return "☕";
  }
  return normalized;
};

const getVoteBorderStyle = (
  vote: string | null,
  voteSystem: PlanningPokerVoteSystem
): React.CSSProperties | undefined => {
  const normalizedVote = normalizeVoteValue(vote);
  if (!normalizedVote) return undefined;

  const activeDeck = PLANNING_POKER_DECKS[voteSystem] ?? PLANNING_POKER_DECKS.fibonacci;
  const index = activeDeck.indexOf(normalizedVote);
  if (index < 0) return undefined;

  const ratio = activeDeck.length <= 1 ? 0 : index / (activeDeck.length - 1);
  // Indigo gradient: low values → indigo-400, high values → violet-500
  const hue = 239 - ratio * 20;
  const lightness = 62 + ratio * 8;
  const borderColor = `hsl(${hue} 72% ${lightness}%)`;
  const glow = `hsla(${hue} 75% 58% / 0.35)`;

  return {
    borderColor,
    boxShadow: `0 0 0 1px hsla(${hue} 75% 68% / 0.35), 0 8px 16px ${glow}`,
  };
};

const SeatVoteCard: React.FC<{
  player: PlanningPokerPlayer;
  revealed: boolean;
  voteSystem: PlanningPokerVoteSystem;
}> = ({ player, revealed, voteSystem }) => {
  const [flipped, setFlipped] = useState(false);
  const [votePulse, setVotePulse] = useState(false);
  const previousVoteRef = useRef<string | null>(player.vote ?? null);
  const previousHasVotedRef = useRef<boolean>(player.hasVoted);
  const normalizedVote = normalizeVoteValue(player.vote);
  const valueLabel = normalizedVote ?? "-";
  const revealedCardStyle = useMemo(
    () => (revealed ? getVoteBorderStyle(normalizedVote, voteSystem) : undefined),
    [normalizedVote, revealed, voteSystem]
  );

  useEffect(() => {
    if (!player.hasVoted || !revealed) {
      setFlipped(false);
      return;
    }
    const timer = window.setTimeout(() => setFlipped(true), 60);
    return () => window.clearTimeout(timer);
  }, [player.hasVoted, player.vote, revealed]);

  useEffect(() => {
    const hasVoteChanged = previousVoteRef.current !== (player.vote ?? null);
    const hasStartedVoting = !previousHasVotedRef.current && player.hasVoted;
    previousVoteRef.current = player.vote ?? null;
    previousHasVotedRef.current = player.hasVoted;

    if (!player.hasVoted || !player.vote || (!hasVoteChanged && !hasStartedVoting)) return;
    setVotePulse(true);
    const timer = window.setTimeout(() => setVotePulse(false), 320);
    return () => window.clearTimeout(timer);
  }, [player.hasVoted, player.vote]);

  if (!player.hasVoted) {
    return (
      <div className="flex h-[44px] w-[30px] items-center justify-center rounded-xl border border-slate-300/70 bg-white text-[11px] font-semibold text-slate-400 shadow-[0_6px_14px_rgba(2,6,23,0.35)] sm:h-[56px] sm:w-[38px] sm:text-xs">
        ⏳
      </div>
    );
  }

  return (
    <div
      className={`h-[44px] w-[30px] [perspective:700px] transition-transform duration-300 sm:h-[56px] sm:w-[38px] ${
        votePulse ? "-translate-y-1 scale-105" : ""
      }`}
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-300/70 bg-white text-base shadow-[0_6px_14px_rgba(2,6,23,0.35)] [backface-visibility:hidden] sm:text-lg">
          {!revealed ? "✅" : null}
        </div>
        <div
          style={revealedCardStyle}
          className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-300/70 bg-white text-[11px] font-bold text-slate-900 shadow-[0_6px_14px_rgba(2,6,23,0.35)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:text-xs"
        >
          {revealed ? valueLabel : ""}
        </div>
      </div>
    </div>
  );
};

export const PlanningPokerRoundBoard: React.FC<Props> = ({
  players,
  revealed,
  votesOpen,
  storyTitle,
  round,
  voteSystem,
}) => {
  const seats = useMemo(() => buildSeats(players), [players]);
  const displayedStory = storyTitle.trim() || `Story #${round}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-indigo-500/20 bg-slate-950/40 p-2.5 sm:p-4 lg:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.08),_transparent_64%)]" />

      <div className="relative h-full w-full">
        {/* Oval table surface */}
        <div className="absolute left-1/2 top-1/2 h-[42%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06] bg-slate-900/55 sm:h-[44%] sm:w-[68%] lg:h-[50%] lg:w-[74%]" />

        {/* Story card */}
        <div className="absolute left-1/2 top-1/2 z-10 w-[74%] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-indigo-500/30 bg-indigo-500/8 px-3 py-2 text-center sm:w-[66%] sm:px-4 sm:py-3">
          <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-indigo-200/80 sm:text-[11px]">{displayedStory}</p>
          <p className="text-xs font-medium text-slate-200 sm:text-sm">
            {revealed ? "Revelation des votes" : votesOpen ? "En attente des votes..." : "En attente du lancement des votes"}
          </p>
        </div>

        {/* Player seats */}
        {seats.map(({ player, x, y }) => (
          <div
            key={player.socketId}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className="flex flex-col items-center gap-1">
              <SeatVoteCard player={player} revealed={revealed} voteSystem={voteSystem} />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-slate-900/85 text-base shadow-[0_0_0_1px_rgba(99,102,241,0.1)] sm:h-10 sm:w-10 sm:text-lg">
                {AVATARS[player.avatar] ?? ":)"}
              </div>
              <div className="max-w-[78px] truncate text-center text-[10px] text-slate-300 sm:max-w-[90px] sm:text-[11px]">{player.name}</div>
              {player.isHost ? <div className="text-[10px] text-indigo-400">Host</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
