import React from "react";
import { Player, AVATARS, QuestionSummary } from "@/types/game";
import { PixelCard } from "../game/PixelCard";
import { PixelButton } from "../game/PixelButton";
import { cn } from "@/lib/utils";

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
  const sorted = [...players].sort((a, b) => b.stars - a.stars);
  const totalStars = players.reduce((sum, p) => sum + p.stars, 0);
  const topQuestions = [...questionHistory]
    .filter((q) => q.upVotes > 0)
    .sort((a, b) => b.upVotes - a.upVotes || a.downVotes - b.downVotes)
    .slice(0, 5);

  return (
    <div className="scanlines flex w-full flex-col items-center gap-6 p-6">
      <PixelCard className="w-full max-w-3xl p-6 text-center">
        <div className="font-pixel text-2xl">Fin de partie</div>
        <div className="mt-2 text-sm opacity-80">Total kudobox: {totalStars}</div>
      </PixelCard>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        {sorted.map((p, idx) => (
          <PixelCard
            key={p.id}
            className={cn("p-4", idx === 0 && "border-4 border-yellow-400")}
            style={{ borderColor: idx === 0 ? "#facc15" : p.color }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded border-4 border-black bg-white">
                <span className="text-3xl">{AVATARS[p.avatar] ?? "?"}</span>
              </div>
              <div className="flex-1">
                <div className="font-pixel text-lg">{p.name}</div>
                <div className="text-sm opacity-80">Stars: {p.stars}</div>
              </div>
              {idx === 0 && <div className="text-xl">#1</div>}
            </div>
          </PixelCard>
        ))}
      </div>

      <PixelCard className="w-full max-w-3xl p-5">
        <div className="font-pixel text-lg">Cartes les plus votees utiles</div>
        {topQuestions.length === 0 ? (
          <div className="mt-2 text-sm opacity-80">
            Aucune carte n&apos;a recu de pouce vers le haut.
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {topQuestions.map((q, idx) => (
              <div key={q.id} className="rounded border-2 border-black/40 bg-black/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">#{idx + 1}</div>
                  <div className="text-xs opacity-80">
                    +{q.upVotes} / -{q.downVotes}
                  </div>
                </div>
                <div className="mt-1 text-sm leading-snug">{q.text}</div>
              </div>
            ))}
          </div>
        )}
      </PixelCard>

      <PixelButton onClick={onPlayAgain} variant="primary">
        Rejouer
      </PixelButton>
    </div>
  );
};
