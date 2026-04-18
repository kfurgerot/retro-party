import React from "react";
import { Player, AVATARS, QuestionSummary } from "@/types/game";
import { fr } from "@/i18n/fr";
import { PageShell } from "@/components/app-shell";

interface ResultsScreenProps {
  players: Player[];
  questionHistory: QuestionSummary[];
  onPlayAgain: () => void;
  accentColor?: string;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  players,
  questionHistory,
  onPlayAgain,
  accentColor = "#ec4899",
}) => {
  const sorted = [...players].sort((a, b) => b.stars - a.stars || (b.points ?? 0) - (a.points ?? 0));
  const winner = sorted[0] ?? null;
  const podium = sorted.slice(0, 3);
  const others = sorted.slice(3);

  const totalStars = players.reduce((s, p) => s + p.stars, 0);
  const totalPoints = players.reduce((s, p) => s + (p.points ?? 0), 0);
  const totalUpVotes = questionHistory.reduce((s, q) => s + (q.upVotes ?? 0), 0);
  const totalDownVotes = questionHistory.reduce((s, q) => s + (q.downVotes ?? 0), 0);
  const totalVotes = totalUpVotes + totalDownVotes;
  const usefulRatio = totalVotes > 0 ? Math.round((totalUpVotes / totalVotes) * 100) : 0;

  const topQuestions = [...questionHistory]
    .filter((q) => q.upVotes > 0)
    .sort((a, b) => b.upVotes - a.upVotes || a.downVotes - b.downVotes)
    .slice(0, 5);
  const topQuestion = topQuestions[0] ?? null;

  const stats = [
    { label: fr.results.totalKudobox, value: String(totalStars) },
    { label: fr.results.totalPoints, value: String(totalPoints) },
    { label: fr.results.playersTitle, value: String(players.length) },
    { label: fr.results.questionsCount, value: String(questionHistory.length) },
  ];

  return (
    <PageShell
      accentColor={`${accentColor}10`}
      accentGlow="rgba(99,102,241,0.04)"
      maxWidth="6xl"
    >
      {/* Winner banner */}
      {winner && (
        <div
          className="mb-6 rounded-2xl border p-6 text-center"
          style={{ borderColor: `${accentColor}30`, background: `${accentColor}0c` }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
            {fr.results.summaryTitle}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
            {fr.results.title}
          </h1>
          <div className="mt-6 flex flex-col items-center gap-3">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl border text-4xl"
              style={{ borderColor: `${accentColor}30`, background: `${accentColor}15` }}
            >
              {AVATARS[winner.avatar] ?? "?"}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{fr.results.winner}</div>
              <div className="mt-1 text-xl font-extrabold tracking-tight text-slate-50">{winner.name}</div>
            </div>
            <div className="text-sm text-slate-400">
              {fr.results.winnerAnnouncement.replace("{name}", winner.name)}
            </div>
          </div>

          {/* Stats chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
              >
                <span className="text-xl font-extrabold leading-none tracking-tight text-slate-50">
                  {s.value}
                </span>
                <span className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Podium & Rankings */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
              {fr.results.podiumTitle}
            </h2>
            <div className="space-y-2">
              {podium.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border px-4 py-3"
                  style={
                    idx === 0
                      ? { borderColor: `${accentColor}35`, background: `${accentColor}0c` }
                      : { borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }
                  }
                >
                  <span className="text-2xl leading-none">{MEDAL[idx] ?? `#${idx + 1}`}</span>
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl border text-xl"
                    style={{ borderColor: `${accentColor}20`, background: `${accentColor}0c` }}
                  >
                    {AVATARS[p.avatar] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {fr.results.stars}: {p.stars} · {fr.results.points}: {p.points ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {others.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-600">
                  {fr.results.playersRankTitle}
                </h3>
                <div className="space-y-1.5 max-h-[30svh] overflow-auto pr-1">
                  {others.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                    >
                      <span className="w-5 text-center text-xs text-slate-600">#{idx + 4}</span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-lg">
                        {AVATARS[p.avatar] ?? "?"}
                      </div>
                      <span className="flex-1 truncate text-sm text-slate-300">{p.name}</span>
                      <span className="text-xs text-slate-500">{p.stars}⭐ · {p.points ?? 0}pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question insights */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">
            {fr.results.questionInsightsTitle}
          </h2>

          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{fr.results.usefulRate}</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-50">{usefulRatio}%</div>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{fr.results.totalVotes}</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-50">{totalVotes}</div>
            </div>
          </div>

          {topQuestion && (
            <div
              className="mb-4 rounded-xl border p-4"
              style={{ borderColor: `${accentColor}25`, background: `${accentColor}08` }}
            >
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                {fr.results.mostUsefulCard}
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{topQuestion.text}</div>
              <div className="mt-1.5 text-xs text-slate-500">
                {fr.results.votesSummary
                  .replace("{up}", String(topQuestion.upVotes))
                  .replace("{down}", String(topQuestion.downVotes))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[34svh] overflow-auto pr-1">
            {topQuestions.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-slate-500">
                {fr.results.noUpvoteCards}
              </div>
            ) : (
              topQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
                    <span className="text-[11px] text-slate-500">
                      {fr.results.votesSummary
                        .replace("{up}", String(q.upVotes))
                        .replace("{down}", String(q.downVotes))}
                    </span>
                  </div>
                  <div className="text-sm text-slate-200">{q.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-7 flex justify-center">
        <button
          type="button"
          onClick={onPlayAgain}
          className="h-12 rounded-xl px-10 text-sm font-bold text-white transition"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
            boxShadow: `0 4px 20px ${accentColor}40`,
          }}
        >
          {fr.results.playAgain}
        </button>
      </div>
    </PageShell>
  );
};
