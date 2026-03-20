import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActionBadge } from "./ActionBadge";

interface TurnQueueItem {
  id: string;
  name: string;
  isCurrent: boolean;
  isNext: boolean;
}

interface TurnBannerProps {
  mode: "mobile" | "desktop";
  currentTurnLabel: string;
  currentPlayerName: string;
  primaryAction: string;
  pointsLabel: string;
  starsLabel: string;
  myPoints: number;
  myStars: number;
  isMyTurn: boolean;
  youLabel: string;
  roundLabel: string;
  currentRound: number;
  maxRounds: number;
  roundProgressPct: number;
  nextUpLabel: string;
  nextPlayerName: string;
  turnQueue: TurnQueueItem[];
  neonCardClass: string;
  onLeave?: () => void;
  leaveLabel?: string;
  leaveBtnClass?: string;
}

export const TurnBanner: React.FC<TurnBannerProps> = ({
  mode,
  currentTurnLabel,
  currentPlayerName,
  primaryAction,
  pointsLabel,
  starsLabel,
  myPoints,
  myStars,
  isMyTurn,
  youLabel,
  roundLabel,
  currentRound,
  maxRounds,
  roundProgressPct,
  nextUpLabel,
  nextPlayerName,
  turnQueue,
  neonCardClass,
  onLeave,
  leaveLabel,
  leaveBtnClass,
}) => {
  if (mode === "mobile") {
    return (
      <Card className={cn(neonCardClass, "px-2.5 py-2")}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-100/80">{currentTurnLabel}</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded border border-cyan-300/30 bg-slate-900/45 px-1.5 py-0.5 text-[10px] text-cyan-100">
              {pointsLabel}: {myPoints}
            </span>
            <span className="inline-flex rounded border border-cyan-300/30 bg-slate-900/45 px-1.5 py-0.5 text-[10px] text-cyan-100">
              {starsLabel}: {myStars}
            </span>
            {isMyTurn ? <ActionBadge tone="active" label={youLabel} /> : null}
          </div>
        </div>

        <div className="truncate text-sm font-bold text-cyan-50">{currentPlayerName}</div>
        <div className="truncate text-[10px] text-cyan-100/85">{primaryAction}</div>

        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {turnQueue.slice(0, 3).map((entry) => (
            <ActionBadge
              key={`mobile-turn-${entry.id}`}
              tone={entry.isCurrent ? "active" : entry.isNext ? "next" : "neutral"}
              label={entry.name}
              className="shrink-0 normal-case tracking-normal"
            />
          ))}
          {turnQueue.length > 3 ? (
            <ActionBadge
              tone="neutral"
              label={`+${turnQueue.length - 3}`}
              className="shrink-0 tracking-normal"
            />
          ) : null}
        </div>

        <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-slate-900/60">
          <div className="h-full rounded bg-cyan-400/90" style={{ width: `${roundProgressPct}%` }} />
        </div>
        <div className="mt-1 text-[10px] text-slate-300">
          {roundLabel} {currentRound}/{maxRounds}
        </div>
      </Card>
    );
  }

  return (
    <div className="hidden xl:flex xl:flex-wrap xl:items-center xl:justify-between xl:gap-3">
      <Card className={cn(neonCardClass, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">{roundLabel}</div>
        <div className="text-lg font-bold sm:text-xl">
          {currentRound} / {maxRounds}
        </div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">{currentTurnLabel}</div>
        <div className="truncate text-lg font-bold sm:text-xl">{currentPlayerName}</div>
        <div className="mt-1">
          <ActionBadge tone={isMyTurn ? "active" : "neutral"} label={isMyTurn ? youLabel : nextUpLabel} />
        </div>
        <div className="mt-1 truncate text-xs text-slate-300">
          {nextUpLabel}: <span className="font-semibold text-slate-200">{nextPlayerName}</span>
        </div>
      </Card>

      <Card
        className={cn(
          neonCardClass,
          "min-w-[220px] max-w-[420px] px-3 py-2 sm:px-4 sm:py-3",
          isMyTurn ? "border-cyan-300/45 bg-cyan-500/10" : ""
        )}
      >
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">Action</div>
        <div className="truncate text-sm font-semibold text-cyan-100">{primaryAction}</div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">{pointsLabel}</div>
        <div className="text-lg font-bold sm:text-xl">{myPoints}</div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-0 px-3 py-2 sm:px-4 sm:py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">{starsLabel}</div>
        <div className="text-lg font-bold sm:text-xl">{myStars}</div>
      </Card>

      {onLeave && leaveLabel ? (
        <Button className={cn("hidden xl:inline-flex", leaveBtnClass)} variant="secondary" onClick={onLeave}>
          {leaveLabel}
        </Button>
      ) : null}
    </div>
  );
};
