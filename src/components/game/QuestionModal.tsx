import React, { useMemo } from "react";
import { QuestionState, Player } from "@/types/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { CTA_SESSION_PRIMARY, SESSION_DIALOG_CONTENT } from "@/lib/uiTokens";

type Props = {
  question: QuestionState;
  players: Player[];
  myPlayerId?: string | null;
  onVote: (vote: "up" | "down") => void;
  onValidate: () => void;
};

const TYPE_THEME: Record<
  QuestionState["type"],
  { title: string; icon: string; accent: string; chip: string }
> = {
  blue: {
    title: fr.questionModal.blueTitle,
    icon: "B",
    accent: "text-sky-800",
    chip: "border-sky-300/70 bg-sky-50 text-sky-800",
  },
  green: {
    title: fr.questionModal.greenTitle,
    icon: "V",
    accent: "text-emerald-800",
    chip: "border-emerald-300/70 bg-emerald-50 text-emerald-800",
  },
  red: {
    title: fr.questionModal.redTitle,
    icon: "R",
    accent: "text-rose-800",
    chip: "border-rose-300/70 bg-rose-50 text-rose-800",
  },
  purple: {
    title: fr.questionModal.violetTitle,
    icon: "I",
    accent: "text-violet-800",
    chip: "border-violet-300/70 bg-violet-50 text-violet-800",
  },
  violet: {
    title: fr.questionModal.violetTitle,
    icon: "I",
    accent: "text-violet-800",
    chip: "border-violet-300/70 bg-violet-50 text-violet-800",
  },
  bonus: {
    title: fr.questionModal.bonusTitle,
    icon: "*",
    accent: "text-amber-900",
    chip: "border-amber-300/80 bg-amber-50 text-amber-900",
  },
};

export function QuestionModal({ question, players, myPlayerId, onVote, onValidate }: Props) {
  const isTarget = myPlayerId != null && question.targetPlayerId === myPlayerId;
  const theme = TYPE_THEME[question.type];

  const targetName = useMemo(() => {
    return (
      players.find((p) => p.id === question.targetPlayerId)?.name ?? fr.questionModal.defaultPlayer
    );
  }, [players, question.targetPlayerId]);

  const upCount = question.votes.up.length;
  const downCount = question.votes.down.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className={cn("w-full max-w-2xl", SESSION_DIALOG_CONTENT)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-bold",
                  theme.chip,
                )}
              >
                {theme.icon}
              </span>
              <div
                className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", theme.accent)}
              >
                {theme.title}
              </div>
            </div>
            <div className="mt-2 text-sm text-[#647067]">
              {fr.questionModal.questionFor} <span className="font-semibold">{targetName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-1 text-emerald-800">
              👍 {upCount}
            </span>
            <span className="rounded-full border border-rose-300/70 bg-rose-50 px-2 py-1 text-rose-800">
              👎 {downCount}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#d8e2d9] bg-white/62 p-4 text-base leading-relaxed text-[#18211f] sm:text-xl">
          {question.text}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {!isTarget ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onVote("up")}
                className="h-11 rounded-xl border border-emerald-700 bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                👍 A creuser
              </Button>
              <Button
                onClick={() => onVote("down")}
                className="h-11 rounded-xl border border-rose-700 bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800"
              >
                👎 Passer
              </Button>
            </div>
          ) : (
            <div className="text-sm text-[#647067]">{fr.questionModal.answerInstruction}</div>
          )}

          {isTarget && (
            <Button
              onClick={onValidate}
              className={cn("h-11 rounded-xl px-5 text-sm font-semibold", CTA_SESSION_PRIMARY)}
            >
              {fr.questionModal.validateAnswer}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
