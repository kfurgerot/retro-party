import { cn } from "@/lib/utils";
import { EmptyPresenceTile, PresenceTile, type PresenceState } from "./PresenceTile";

export type PresenceParticipant = {
  id: string;
  name: string;
  avatar: number;
  isHost?: boolean;
  isSelf?: boolean;
  state?: PresenceState;
};

export type PresenceGridProps = {
  participants: PresenceParticipant[];
  accentRgb: string;
  /** Nombre de slots affichés. Les slots vides invitent à inviter d'autres joueurs. */
  minSlots?: number;
  size?: "sm" | "md" | "lg";
  onInvite?: () => void;
  className?: string;
  emptyLabel?: string;
};

export function PresenceGrid({
  participants,
  accentRgb,
  minSlots = 6,
  size = "md",
  onInvite,
  className,
  emptyLabel = "Inviter",
}: PresenceGridProps) {
  const sorted = [...participants].sort((a, b) => {
    const hostGap = Number(b.isHost) - Number(a.isHost);
    if (hostGap !== 0) return hostGap;
    const selfGap = Number(b.isSelf) - Number(a.isSelf);
    if (selfGap !== 0) return selfGap;
    return a.name.localeCompare(b.name, "fr");
  });

  const emptyCount = Math.max(0, minSlots - sorted.length);

  return (
    <div
      className={cn(
        "grid gap-3",
        size === "sm"
          ? "grid-cols-[repeat(auto-fill,minmax(72px,1fr))]"
          : size === "lg"
            ? "grid-cols-[repeat(auto-fill,minmax(108px,1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(92px,1fr))]",
        className,
      )}
    >
      {sorted.map((p) => (
        <PresenceTile
          key={p.id}
          name={p.name}
          avatar={p.avatar}
          accentRgb={accentRgb}
          state={p.state ?? "idle"}
          isHost={p.isHost}
          isSelf={p.isSelf}
          size={size}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <EmptyPresenceTile
          key={`empty-${i}`}
          size={size}
          label={emptyLabel}
          onClick={i === 0 ? onInvite : undefined}
        />
      ))}
    </div>
  );
}
