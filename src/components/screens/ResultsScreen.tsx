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
  const winner = sorted[0] ?? null;
  const podium = sorted.slice(0, 3);
  const others = sorted.slice(3);
  const totalStars = players.reduce((sum, p) => sum + p.stars, 0);
  const totalPoints = players.reduce((sum, p) => sum + (p.points ?? 0), 0);
  const topQuestions = [...questionHistory]
    .filter((q) => q.upVotes > 0)
    .sort((a, b) => b.upVotes - a.upVotes || a.downVotes - b.downVotes)
    .slice(0, 5);
  const topQuestion = topQuestions[0] ?? null;

  return (
    <div className="scanlines relative min-h-svh w-full overflow-hidden px-3 py-4 sm:px-6 sm:py-8">
      <RetroScreenBackground />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <Card className="neon-surface p-4 text-center sm:p-6">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">{fr.results.summaryTitle}</div>
          <div className="mt-1 text-xl font-bold text-cyan-100 sm:text-3xl">{fr.results.title}</div>
          <div className="mt-1 text-xs text-slate-300 sm:text-sm">{fr.results.subtitle}</div>
          {winner && (
            <div className="mt-3 rounded-md border border-amber-300/45 bg-amber-500/12 px-3 py-2 text-sm font-semibold text-amber-100">
              {fr.results.winnerAnnouncement.replace("{name}", winner.name)}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-left sm:mx-auto sm:max-w-md">
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

        <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="neon-surface min-h-0 p-3 sm:p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">{fr.results.podiumTitle}</div>
            <div className="mt-3 grid gap-2">
              {podium.map((p, idx) => (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    idx === 0
                      ? "border-amber-300/60 bg-amber-500/12"
                      : "border-cyan-300/25 bg-slate-900/55"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-cyan-300/30 bg-slate-950/55 text-xl">
                        {AVATARS[p.avatar] ?? "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-cyan-50">{p.name}</div>
                        <div className="text-xs text-slate-300">
                          {fr.results.stars}: {p.stars} • {fr.results.points}: {p.points ?? 0}
                        </div>
                      </div>
                    </div>
                    <span className="rounded border border-cyan-300/35 bg-slate-900/45 px-2 py-0.5 text-[11px] text-cyan-100">
                      {idx + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">{fr.results.playersRankTitle}</div>
            <div className="mt-2 grid max-h-[34svh] gap-2 overflow-auto pr-1">
              {others.length === 0 ? (
                <div className="rounded-md border border-cyan-300/25 bg-slate-900/55 px-3 py-2 text-xs text-slate-300">
                  {fr.results.noOtherPlayers}
                </div>
              ) : (
                others.map((p, idx) => (
                  <div key={p.id} className="rounded-md border border-cyan-300/25 bg-slate-900/55 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-cyan-300/30 bg-slate-950/55 text-lg">
                          {AVATARS[p.avatar] ?? "?"}
                        </span>
                        <div className="truncate text-sm text-cyan-50">{p.name}</div>
                      </div>
                      <span className="text-xs text-slate-300">#{idx + 4}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="neon-surface min-h-0 p-3 sm:p-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/80">{fr.results.questionInsightsTitle}</div>
            {topQuestion && (
              <div className="mt-2 rounded-md border border-cyan-300/35 bg-cyan-500/10 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-cyan-100/80">{fr.results.mostUsefulCard}</div>
                <div className="mt-1 text-sm font-semibold text-cyan-50">{topQuestion.text}</div>
                <div className="mt-1 text-xs text-slate-300">
                  {fr.results.votesSummary
                    .replace("{up}", String(topQuestion.upVotes))
                    .replace("{down}", String(topQuestion.downVotes))}
                </div>
              </div>
            )}
            <div className="mt-2 grid max-h-[42svh] gap-2 overflow-auto pr-1">
              {topQuestions.length === 0 ? (
                <div className="rounded-md border border-cyan-300/25 bg-slate-900/55 px-3 py-2 text-sm text-slate-300">
                  {fr.results.noUpvoteCards}
                </div>
              ) : (
                topQuestions.map((q, idx) => (
                  <div key={q.id} className="rounded-md border border-cyan-300/25 bg-slate-900/55 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-cyan-100">#{idx + 1}</div>
                      <div className="text-[11px] text-slate-300">
                        {fr.results.votesSummary
                          .replace("{up}", String(q.upVotes))
                          .replace("{down}", String(q.downVotes))}
                      </div>
                    </div>
                    <div className="mt-1 text-sm leading-snug text-slate-100">{q.text}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button onClick={onPlayAgain} className={cn("h-11 px-8 font-semibold", CTA_NEON_PRIMARY)}>
            {fr.results.playAgain}
          </Button>
        </div>
      </div>
    </div>
  );
};
