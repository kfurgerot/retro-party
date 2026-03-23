import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  pointsLabel,
  starsLabel,
  myPoints,
  myStars,
  roundLabel,
  currentRound,
  maxRounds,
  roundProgressPct,
  neonCardClass,
  onLeave,
  leaveLabel,
  leaveBtnClass,
}) => {
  if (mode === "mobile") {
    return (
      <Card className={cn(neonCardClass, "rounded-xl px-3 py-2.5")}>
        <div className="flex items-center gap-2 text-sm font-bold text-cyan-50">
          <span className="mr-1 text-[10px] uppercase tracking-[0.1em] text-cyan-100/80">{currentTurnLabel}</span>
          <span className="truncate">{currentPlayerName}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-cyan-300/40 bg-cyan-500/14 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-cyan-100/80">{pointsLabel}</div>
            <div className="text-lg font-black leading-none text-cyan-50">{myPoints}</div>
          </div>
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/12 px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-amber-100/85">{starsLabel}</div>
            <div className="text-lg font-black leading-none text-amber-100">{myStars}</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-900/60">
          <div className="h-full rounded bg-cyan-400/90" style={{ width: `${roundProgressPct}%` }} />
        </div>
        <div className="mt-1 text-[10px] text-slate-300">
          {roundLabel} {currentRound}/{maxRounds}
        </div>
      </Card>
    );
  }

  return (
    <div className="hidden xl:flex xl:flex-wrap xl:items-center xl:justify-between xl:gap-2">
      <Card className={cn(neonCardClass, "min-w-[240px] rounded-xl px-4 py-3")}>
        <div className="flex items-center gap-2 text-lg font-bold text-cyan-50 sm:text-xl">
          <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">{currentTurnLabel}</span>
          <span className="truncate">{currentPlayerName}</span>
        </div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-[300px] flex-1 rounded-xl px-4 py-3")}>
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-cyan-100/80">
          <span>{roundLabel}</span>
          <span>{currentRound} / {maxRounds}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-slate-900/60">
          <div className="h-full rounded bg-cyan-400/90" style={{ width: `${roundProgressPct}%` }} />
        </div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-[140px] rounded-xl border-cyan-300/45 bg-cyan-500/14 px-4 py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/85">{pointsLabel}</div>
        <div className="text-2xl font-black leading-none text-cyan-50">{myPoints}</div>
      </Card>

      <Card className={cn(neonCardClass, "min-w-[140px] rounded-xl border-amber-300/45 bg-amber-500/14 px-4 py-3")}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-amber-100/90">{starsLabel}</div>
        <div className="text-2xl font-black leading-none text-amber-100">{myStars}</div>
      </Card>

      {onLeave && leaveLabel ? (
        <Button className={cn("hidden xl:inline-flex", leaveBtnClass)} variant="secondary" onClick={onLeave}>
          {leaveLabel}
        </Button>
      ) : null}
    </div>
  );
};
