import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionStatus = "lobby" | "live" | "ended" | "abandoned";

const STATUS_LABEL: Record<SessionStatus, string> = {
  lobby: "En attente",
  live: "En cours",
  ended: "Terminée",
  abandoned: "Abandonnée",
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  lobby: "99,102,241",
  live: "16,185,129",
  ended: "100,116,139",
  abandoned: "234,179,8",
};

export type SessionPreviewCardProps = {
  /** Libellé module ("Retro Party", "Planning Party"…) */
  moduleLabel: string;
  moduleIcon: string;
  /** Titre de la session (libellé saisi par l'host ou fallback) */
  title?: string | null;
  code?: string | null;
  status?: SessionStatus;
  participantCount?: number | null;
  accentRgb: string;
  size?: "sm" | "md";
  className?: string;
};

export function SessionPreviewCard({
  moduleLabel,
  moduleIcon,
  title,
  code,
  status = "lobby",
  participantCount,
  accentRgb,
  size = "md",
  className,
}: SessionPreviewCardProps) {
  const isSm = size === "sm";
  const statusColor = STATUS_COLOR[status];

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--ds-border)]",
        isSm ? "p-4" : "p-5",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, rgba(${accentRgb},0.10), var(--ds-surface-1) 60%)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(70% 100% at 100% 0%, rgba(${accentRgb},0.18), transparent 65%)`,
        }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border",
            isSm ? "h-10 w-10 text-[20px]" : "h-12 w-12 text-[24px]",
          )}
          style={{
            background: `rgba(${accentRgb},0.16)`,
            borderColor: `rgba(${accentRgb},0.4)`,
          }}
        >
          <span aria-hidden>{moduleIcon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: `rgba(${accentRgb},0.9)` }}
          >
            {moduleLabel}
          </p>
          <h2
            className={cn(
              "mt-0.5 truncate font-semibold tracking-tight text-[var(--ds-text-primary)]",
              isSm ? "text-[15px]" : "text-[18px]",
            )}
          >
            {title || (code ? `Session ${code}` : "Nouvelle session")}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider"
              style={{
                background: `rgba(${statusColor},0.14)`,
                color: `rgb(${statusColor})`,
                border: `1px solid rgba(${statusColor},0.3)`,
              }}
            >
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  status === "live" && "animate-pulse",
                )}
                style={{ background: `rgb(${statusColor})` }}
              />
              {STATUS_LABEL[status]}
            </span>
            {participantCount !== undefined && participantCount !== null ? (
              <span className="inline-flex items-center gap-1 text-[var(--ds-text-muted)]">
                <Users size={11} />
                {participantCount} participant{participantCount > 1 ? "s" : ""}
              </span>
            ) : null}
            {code ? <span className="font-mono text-[var(--ds-text-faint)]">{code}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
