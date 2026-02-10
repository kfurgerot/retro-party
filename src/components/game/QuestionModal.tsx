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

const TYPE_THEME: Record<
  QuestionState["type"],
  { title: string; icon: string; border: string; glow: string; badge: string; panel: string }
> = {
  blue: {
    title: "BLEU | Comprendre (faits et realite)",
    icon: "B",
    border: "border-[hsl(var(--tile-blue))]",
    glow: "shadow-[6px_6px_0_rgba(0,0,0,0.55),0_0_24px_hsl(var(--tile-blue)/0.45)]",
    badge: "bg-[hsl(var(--tile-blue))] text-black",
    panel: "bg-[linear-gradient(180deg,hsl(var(--tile-blue)/0.25)_0%,hsl(var(--card))_40%)]",
  },
  green: {
    title: "VERT | Ameliorer (solutions et idees)",
    icon: "V",
    border: "border-[hsl(var(--tile-green))]",
    glow: "shadow-[6px_6px_0_rgba(0,0,0,0.55),0_0_24px_hsl(var(--tile-green)/0.45)]",
    badge: "bg-[hsl(var(--tile-green))] text-black",
    panel: "bg-[linear-gradient(180deg,hsl(var(--tile-green)/0.25)_0%,hsl(var(--card))_40%)]",
  },
  red: {
    title: "ROUGE | Frictions, problemes et irritants",
    icon: "R",
    border: "border-[hsl(var(--tile-red))]",
    glow: "shadow-[6px_6px_0_rgba(0,0,0,0.55),0_0_24px_hsl(var(--tile-red)/0.45)]",
    badge: "bg-[hsl(var(--tile-red))] text-white",
    panel: "bg-[linear-gradient(180deg,hsl(var(--tile-red)/0.25)_0%,hsl(var(--card))_40%)]",
  },
  violet: {
    title: "VIOLET | Vision, projection et sens",
    icon: "I",
    border: "border-[hsl(var(--tile-violet))]",
    glow: "shadow-[6px_6px_0_rgba(0,0,0,0.55),0_0_24px_hsl(var(--tile-violet)/0.45)]",
    badge: "bg-[hsl(var(--tile-violet))] text-black",
    panel: "bg-[linear-gradient(180deg,hsl(var(--tile-violet)/0.25)_0%,hsl(var(--card))_40%)]",
  },
  bonus: {
    title: "BONUS | Kudobox",
    icon: "*",
    border: "border-[hsl(var(--tile-star))]",
    glow: "shadow-[6px_6px_0_rgba(0,0,0,0.55),0_0_24px_hsl(var(--tile-star)/0.45)]",
    badge: "bg-[hsl(var(--tile-star))] text-black",
    panel: "bg-[linear-gradient(180deg,hsl(var(--tile-star)/0.25)_0%,hsl(var(--card))_40%)]",
  },
};

export function QuestionModal({ question, players, myPlayerId, onVote, onValidate }: Props) {
  const isTarget = myPlayerId != null && question.targetPlayerId === myPlayerId;
  const theme = TYPE_THEME[question.type];

  const targetName = useMemo(() => {
    return players.find((p) => p.id === question.targetPlayerId)?.name ?? "Joueur";
  }, [players, question.targetPlayerId]);

  const upCount = question.votes.up.length;
  const downCount = question.votes.down.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-2xl">
        <PixelCard
          className={`relative overflow-hidden border-4 p-6 ${theme.border} ${theme.glow} ${theme.panel}`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:repeating-linear-gradient(180deg,transparent_0,transparent_4px,rgba(255,255,255,0.08)_4px,rgba(255,255,255,0.08)_6px)]" />
          <div className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-2 border-white/70 bg-black/70" />
          <div className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-2 border-white/70 bg-black/70" />
          <div className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-2 border-white/70 bg-black/70" />
          <div className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-2 border-white/70 bg-black/70" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-7 min-w-7 items-center justify-center border-2 border-black px-1 text-xs font-bold ${theme.badge}`}
                >
                  {theme.icon}
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wide">{theme.title}</div>
              </div>
              <div className="mt-2 text-sm opacity-90">
                Question pour <span className="font-semibold">{targetName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded border-2 border-emerald-300/70 bg-emerald-500/20 px-2 py-1">
                +1 {upCount}
              </span>
              <span className="rounded border-2 border-rose-300/70 bg-rose-500/20 px-2 py-1">
                -1 {downCount}
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-4 border-2 border-white/20 bg-black/35 p-4 text-base leading-relaxed sm:text-xl">
            {question.text}
          </div>

          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-3">
            {!isTarget ? (
              <div className="flex gap-2">
                <PixelButton
                  onClick={() => onVote("up")}
                  className="border-emerald-400 bg-emerald-500/80 text-black"
                >
                  + Utile
                </PixelButton>
                <PixelButton
                  onClick={() => onVote("down")}
                  className="border-rose-400 bg-rose-500/80 text-white"
                >
                  - A creuser
                </PixelButton>
              </div>
            ) : (
              <div className="text-sm opacity-80">
                Reponds a voix haute, puis valide quand tu as termine.
              </div>
            )}

            {isTarget && (
              <PixelButton onClick={onValidate} variant="primary">
                Valider ma reponse
              </PixelButton>
            )}
          </div>
        </PixelCard>
      </div>
    </div>
  );
}
