import React, { useMemo } from "react";
import { QuestionState, Player } from "@/types/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";
import { CTA_NEON_PRIMARY, GAME_DIALOG_CONTENT } from "@/lib/uiTokens";

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
    accent: "text-sky-100",
    chip: "border-sky-300/45 bg-sky-500/20 text-sky-100",
  },
  green: {
    title: fr.questionModal.greenTitle,
    icon: "V",
    accent: "text-emerald-100",
    chip: "border-emerald-300/45 bg-emerald-500/20 text-emerald-100",
  },
  red: {
    title: fr.questionModal.redTitle,
    icon: "R",
    accent: "text-rose-100",
    chip: "border-rose-300/45 bg-rose-500/20 text-rose-100",
  },
  purple: {
    title: fr.questionModal.violetTitle,
    icon: "I",
    accent: "text-violet-100",
    chip: "border-violet-300/45 bg-violet-500/20 text-violet-100",
  },
  violet: {
    title: fr.questionModal.violetTitle,
    icon: "I",
    accent: "text-violet-100",
    chip: "border-violet-300/45 bg-violet-500/20 text-violet-100",
  },
  bonus: {
    title: fr.questionModal.bonusTitle,
    icon: "*",
    accent: "text-amber-100",
    chip: "border-amber-300/45 bg-amber-500/20 text-amber-100",
  },
};

export function QuestionModal({ question, players, myPlayerId, onVote, onValidate }: Props) {
  const isTarget = myPlayerId != null && question.targetPlayerId === myPlayerId;
  const theme = TYPE_THEME[question.type];

  const targetName = useMemo(() => {
    return players.find((p) => p.id === question.targetPlayerId)?.name ?? fr.questionModal.defaultPlayer;
  }, [players, question.targetPlayerId]);

  const upCount = question.votes.up.length;
  const downCount = question.votes.down.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className={cn("w-full max-w-2xl", GAME_DIALOG_CONTENT)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-bold", theme.chip)}>
                {theme.icon}
              </span>
              <div className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", theme.accent)}>{theme.title}</div>
            </div>
            <div className="mt-2 text-sm text-cyan-100/90">
              {fr.questionModal.questionFor} <span className="font-semibold">{targetName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-emerald-300/60 bg-emerald-500/18 px-2 py-1 text-emerald-100">
              +1 {upCount}
            </span>
            <span className="rounded-full border border-rose-300/60 bg-rose-500/18 px-2 py-1 text-rose-100">
              -1 {downCount}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-300/25 bg-slate-900/55 p-4 text-base leading-relaxed text-cyan-50 sm:text-xl">
          {question.text}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {!isTarget ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onVote("up")}
                className="h-11 rounded-xl border border-emerald-300/65 bg-emerald-500/22 px-4 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/34"
              >
                + {fr.questionModal.useful}
              </Button>
              <Button
                onClick={() => onVote("down")}
                className="h-11 rounded-xl border border-rose-300/65 bg-rose-500/22 px-4 text-sm font-semibold text-rose-50 hover:bg-rose-500/34"
              >
                - {fr.questionModal.toExplore}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-300">{fr.questionModal.answerInstruction}</div>
          )}

          {isTarget && (
            <Button onClick={onValidate} className={cn("h-11 rounded-xl px-5 text-sm font-semibold", CTA_NEON_PRIMARY)}>
              {fr.questionModal.validateAnswer}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
