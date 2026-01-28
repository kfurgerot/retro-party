import React, { useMemo } from "react";
import { QuestionState, Player } from "@/types/game";
import { PixelCard } from "./PixelCard";
import { PixelButton } from "./PixelButton";

type Props = {
  question: QuestionState;
  players: Player[];
  myPlayerId?: string | null;
  onVote: (vote: "up" | "down") => void;
  onValidate: () => void;
};

const COLOR: Record<string, string> = {
  blue: "bg-tile-blue border-[hsl(var(--tile-blue))]",
  green: "bg-tile-green border-[hsl(var(--tile-green))]",
  red: "bg-tile-red border-[hsl(var(--tile-red))]",
  violet: "bg-tile-violet border-[hsl(var(--tile-violet))]",
  bonus: "bg-tile-star border-[hsl(var(--tile-star))]",
};

const TITLE: Record<string, string> = {
  blue: "BLEU — Comprendre (faits & réalité)",
  green: "VERT — Améliorer (solutions & idées)",
  red: "ROUGE — Frictions, problèmes & irritants",
  violet: "VIOLET — Vision, projection & sens",
  bonus: "BONUS — Kudobox ⭐",
};

export function QuestionModal({ question, players, myPlayerId, onVote, onValidate }: Props) {
  const isTarget = myPlayerId != null && question.targetPlayerId === myPlayerId;

  const targetName = useMemo(() => {
    return players.find((p) => p.id === question.targetPlayerId)?.name ?? "Joueur";
  }, [players, question.targetPlayerId]);

  const upCount = question.votes.up.length;
  const downCount = question.votes.down.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl">
        <PixelCard className={`border-4 ${COLOR[question.type]} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold">{TITLE[question.type]}</div>
              <div className="mt-1 text-sm opacity-80">
                Question pour <span className="font-semibold">{targetName}</span>
              </div>
            </div>
            <div className="text-sm">
              👍 {upCount} &nbsp; 👎 {downCount}
            </div>
          </div>

          <div className="mt-4 text-xl leading-relaxed">{question.text}</div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {!isTarget ? (
              <div className="flex gap-2">
                <PixelButton onClick={() => onVote("up")}>👍 Utile</PixelButton>
                <PixelButton onClick={() => onVote("down")}>👎 À creuser</PixelButton>
              </div>
            ) : (
              <div className="text-sm opacity-80">
                Réponds à voix haute, puis valide quand tu as terminé.
              </div>
            )}

            {isTarget && (
              <PixelButton onClick={onValidate} variant="primary">
                ✅ J’ai répondu (valider)
              </PixelButton>
            )}
          </div>
        </PixelCard>
      </div>
    </div>
  );
}
