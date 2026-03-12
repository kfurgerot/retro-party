import React from "react";
import { Player, AVATARS, QuestionSummary } from "@/types/game";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RetroScreenBackground } from "./RetroScreenBackground";
import { CTA_NEON_PRIMARY } from "@/lib/uiTokens";

interface ResultsScreenProps {
  players: Player[];
  questionHistory: QuestionSummary[];
  onPlayAgain: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  players,
  questionHistory,
  onPlayAgain,
}) => {
  const sorted = [...players].sort(
    (a, b) => b.stars - a.stars || (b.points ?? 0) - (a.points ?? 0)
  );
  const totalStars = players.reduce((sum, p) => sum + p.stars, 0);
  const totalPoints = players.reduce((sum, p) => sum + (p.points ?? 0), 0);
  const topQuestions = [...questionHistory]
    .filter((q) => q.upVotes > 0)
    .sort((a, b) => b.upVotes - a.upVotes || a.downVotes - b.downVotes)
    .slice(0, 5);

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
      <RetroScreenBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5">
        <Card className="neon-surface p-5 text-center sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">{fr.results.title}</div>
          <div className="mt-2 text-xl font-bold text-cyan-100 sm:text-3xl">{fr.results.title}</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:mx-auto sm:max-w-md">
            <div className="neon-card rounded-md px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.1em] text-cyan-100/80">{fr.results.totalKudobox}</div>
              <div className="text-lg font-bold text-cyan-50">{totalStars}</div>
            </div>
            <div className="neon-card rounded-md px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.1em] text-cyan-100/80">{fr.results.totalPoints}</div>
              <div className="text-lg font-bold text-cyan-50">{totalPoints}</div>
            </div>
          </div>
        </Card>

      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
        {sorted.map((p, idx) => (
          <Card
            key={p.id}
            className={cn(
              "neon-card rounded-lg p-4",
              idx === 0 && "border-amber-300/70 bg-[linear-gradient(180deg,rgba(251,191,36,0.14)_0%,rgba(10,20,40,0.75)_35%)]"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-cyan-300/35 bg-slate-900/65">
                <span className="text-3xl">{AVATARS[p.avatar] ?? "?"}</span>
              </div>
              <div className="flex-1">
                <div className="truncate text-base font-bold text-cyan-50">{p.name}</div>
                <div className="mt-1 text-sm text-slate-200">{fr.results.stars}: {p.stars}</div>
                <div className="text-sm text-slate-300">{fr.results.points}: {p.points ?? 0}</div>
              </div>
              {idx === 0 && (
                <div className="rounded border border-amber-300/60 bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-100">
                  {fr.results.winner}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="neon-surface w-full p-4 sm:p-5">
        <div className="text-base font-bold text-cyan-100">{fr.results.topUsefulCards}</div>
        {topQuestions.length === 0 ? (
          <div className="mt-2 text-sm text-slate-300">
            {fr.results.noUpvoteCards}
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {topQuestions.map((q, idx) => (
              <div key={q.id} className="rounded-md border border-cyan-300/25 bg-slate-900/55 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-cyan-50">#{idx + 1}</div>
                  <div className="text-xs text-slate-300">
                    +{q.upVotes} / -{q.downVotes}
                  </div>
                </div>
                <div className="mt-1 text-sm leading-snug text-slate-100">{q.text}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-center">
        <Button onClick={onPlayAgain} className={cn("h-11 px-8 font-semibold", CTA_NEON_PRIMARY)}>
          {fr.results.playAgain}
        </Button>
      </div>
      </div>
    </div>
  );
};
