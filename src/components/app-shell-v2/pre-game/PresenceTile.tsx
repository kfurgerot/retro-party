import { Crown, Plus } from "lucide-react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

export type PresenceState = "ready" | "idle" | "joining" | "typing" | "offline";

export type PresenceTileProps = {
  name: string;
  avatar: number;
  accentRgb: string;
  state?: PresenceState;
  isHost?: boolean;
  isSelf?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const STATE_COLOR: Record<PresenceState, string> = {
  ready: "16,185,129",
  idle: "148,163,184",
  joining: "234,179,8",
  typing: "99,102,241",
  offline: "100,116,139",
};

const STATE_LABEL: Record<PresenceState, string> = {
  ready: "Prêt",
  idle: "En lobby",
  joining: "Arrive…",
  typing: "Écrit…",
  offline: "Hors ligne",
};

export function PresenceTile({
  name,
  avatar,
  accentRgb,
  state = "idle",
  isHost = false,
  isSelf = false,
  size = "md",
  className,
}: PresenceTileProps) {
  const dim = size === "lg" ? 80 : size === "sm" ? 44 : 60;
  const fontSize = size === "lg" ? 36 : size === "sm" ? 22 : 28;
  const stateColor = STATE_COLOR[state];
  const muted = state === "offline";
  const avatarChar = AVATARS[avatar] ?? "?";

  return (
    <div className={cn("ds-tile-pop flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-2xl transition",
            state === "ready" && "animate-pulse",
          )}
          style={{
            boxShadow:
              state === "ready"
                ? `0 0 0 2px rgba(${stateColor},0.6), 0 0 18px rgba(${stateColor},0.35)`
                : isSelf
                  ? `0 0 0 2px rgba(${accentRgb},0.45)`
                  : "none",
          }}
        />
        <div
          className={cn(
            "relative flex h-full w-full items-center justify-center rounded-2xl border transition",
            muted && "opacity-50 grayscale",
          )}
          style={{
            fontSize,
            borderColor: `rgba(${accentRgb},0.3)`,
            background: `linear-gradient(135deg, rgba(${accentRgb},0.16), rgba(${accentRgb},0.04))`,
          }}
        >
          <span aria-hidden>{avatarChar}</span>
        </div>

        {isHost ? (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-[var(--ds-bg)] shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
            style={{
              borderColor: "rgba(234,179,8,0.5)",
              background: "rgb(234,179,8)",
            }}
            title="Host"
          >
            <Crown size={11} />
          </span>
        ) : null}

        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
          style={{
            background: `rgb(${stateColor})`,
            borderColor: "var(--ds-bg)",
          }}
        />
      </div>

      <div className="w-full text-center">
        <div
          className={cn(
            "truncate font-medium text-[var(--ds-text-primary)]",
            size === "sm" ? "text-[11px]" : "text-[12.5px]",
            muted && "text-[var(--ds-text-faint)]",
          )}
          title={name}
        >
          {isSelf ? `${name} · vous` : name}
        </div>
        <div className="text-[10.5px] font-medium" style={{ color: `rgb(${stateColor})` }}>
          {STATE_LABEL[state]}
        </div>
      </div>
    </div>
  );
}

export type EmptyTileProps = {
  size?: PresenceTileProps["size"];
  label?: string;
  onClick?: () => void;
  className?: string;
};

export function EmptyPresenceTile({
  size = "md",
  label = "Inviter",
  onClick,
  className,
}: EmptyTileProps) {
  const dim = size === "lg" ? 80 : size === "sm" ? 44 : 60;
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={label}
        className={cn(
          "ds-focus-ring flex items-center justify-center rounded-2xl border border-dashed border-[var(--ds-border-strong)] bg-[var(--ds-surface-0)] text-[var(--ds-text-faint)] transition",
          onClick &&
            "cursor-pointer hover:border-[var(--ds-text-faint)] hover:text-[var(--ds-text-secondary)]",
        )}
        style={{ width: dim, height: dim }}
      >
        <Plus size={size === "sm" ? 14 : 18} />
      </button>
      <div
        className={cn(
          "text-[var(--ds-text-faint)]",
          size === "sm" ? "text-[10.5px]" : "text-[11.5px]",
        )}
      >
        {label}
      </div>
    </div>
  );
}
