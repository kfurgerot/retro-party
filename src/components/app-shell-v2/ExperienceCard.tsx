import { Link } from "react-router-dom";
import { ArrowUpRight, Play, Settings2 } from "lucide-react";
import type { Experience } from "@/design-system/tokens";
import { cn } from "@/lib/utils";

type Props = {
  experience: Experience;
  lastActivityAt?: string | null;
  totalActivities?: number;
  variant?: "default" | "compact";
};

export function ExperienceCard({
  experience,
  lastActivityAt,
  totalActivities,
  variant = "default",
}: Props) {
  const compact = variant === "compact";
  return (
    <article
      className={cn(
        "ds-card-hover group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)]",
        compact ? "p-4" : "p-5",
      )}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
        style={{ background: `rgba(${experience.accentRgb},0.45)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl border text-[20px]"
          style={{
            background: `rgba(${experience.accentRgb},0.12)`,
            borderColor: `rgba(${experience.accentRgb},0.35)`,
          }}
        >
          {experience.icon}
        </div>
        {totalActivities !== undefined ? (
          <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--ds-text-muted)]">
            {totalActivities} activité{totalActivities > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <div className="relative mt-4">
        <h3 className="text-[15.5px] font-semibold text-[var(--ds-text-primary)]">
          {experience.label}
        </h3>
        <p className="mt-0.5 text-[12.5px] text-[var(--ds-text-muted)]">{experience.tagline}</p>
        {!compact ? (
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--ds-text-secondary)]">
            {experience.description}
          </p>
        ) : null}
      </div>

      <div className="relative mt-5 flex items-center gap-1.5">
        <Link
          to={experience.hostRoute}
          className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white transition"
          style={{ background: experience.accent }}
        >
          <Play size={12} />
          Lancer
        </Link>
        {experience.prepareRoute ? (
          <Link
            to={experience.prepareRoute}
            className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            <Settings2 size={12} />
            Préparer
          </Link>
        ) : null}
        <span className="ml-auto text-[11px] text-[var(--ds-text-faint)]">
          {lastActivityAt ? formatRelative(lastActivityAt) : "Jamais utilisé"}
        </span>
      </div>

      <ArrowUpRight
        size={14}
        className="absolute right-4 top-4 text-[var(--ds-text-faint)] opacity-0 transition group-hover:opacity-100"
      />
    </article>
  );
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "—";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `il y a ${d} j`;
  const w = Math.round(d / 7);
  if (w < 5) return `il y a ${w} sem`;
  const mo = Math.round(d / 30);
  return `il y a ${mo} mois`;
}
