import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type DashboardActivitiesResponse,
  type DashboardActivity,
  type SuiteModuleId,
} from "@/net/api";
import { EXPERIENCES, EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { ArrowRight, Filter, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type ModuleFilter = "all" | SuiteModuleId;

export default function AppSessions() {
  const [data, setData] = useState<DashboardActivitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .getDashboardActivities()
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const sessions = useMemo<DashboardActivity[]>(() => {
    if (!data) return [];
    let list = data.modules.flatMap((m) =>
      m.activities.filter((a) => a.activityType === "session"),
    );
    if (moduleFilter !== "all") list = list.filter((s) => s.moduleId === moduleFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.details ?? "").toLowerCase().includes(q) ||
          (s.sessionCode ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => Date.parse(b.occurredAt || "") - Date.parse(a.occurredAt || ""));
  }, [data, moduleFilter, query]);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Sessions
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
          Toutes vos sessions
        </h1>
        <p className="text-[14px] text-[var(--ds-text-muted)]">
          Reprenez ou consultez vos ateliers passés. Filtrez par module ou cherchez par nom / code.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-faint)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une session…"
            className="h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] pl-9 pr-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter size={13} className="shrink-0 text-[var(--ds-text-faint)]" />
          <FilterChip active={moduleFilter === "all"} onClick={() => setModuleFilter("all")}>
            Tous
          </FilterChip>
          {EXPERIENCES.map((exp) => (
            <FilterChip
              key={exp.id}
              active={moduleFilter === exp.id}
              onClick={() => setModuleFilter(exp.id)}
              accent={exp.accent}
              accentRgb={exp.accentRgb}
            >
              {exp.icon} {exp.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          Erreur : {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)]">
        {loading ? (
          <Skeleton />
        ) : sessions.length === 0 ? (
          <Empty
            label={
              query || moduleFilter !== "all"
                ? "Aucune session ne correspond aux filtres."
                : "Aucune session animée pour l'instant — lancez-en une depuis ⌘K."
            }
          />
        ) : (
          sessions.map((s) => <Row key={s.id} activity={s} />)
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  accent,
  accentRgb,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  accentRgb?: string;
  children: React.ReactNode;
}) {
  const activeStyle =
    active && accentRgb
      ? {
          background: `rgba(${accentRgb},0.14)`,
          borderColor: `rgba(${accentRgb},0.4)`,
          color: accent,
        }
      : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={activeStyle}
      className={cn(
        "ds-focus-ring h-8 shrink-0 rounded-full border px-3 text-[12px] font-medium transition",
        active
          ? "border-[var(--ds-border-strong)] bg-[var(--ds-surface-2)] text-[var(--ds-text-primary)]"
          : "border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]",
      )}
    >
      {children}
    </button>
  );
}

function Row({ activity }: { activity: DashboardActivity }) {
  const exp = EXPERIENCE_BY_ID[activity.moduleId];
  const code = activity.sessionCode || extractCode(activity.details);
  return (
    <Link
      to={resumePath(activity)}
      className="group flex items-center gap-3 border-b border-[var(--ds-border-faint)] px-4 py-3 last:border-b-0 hover:bg-[var(--ds-surface-1)]"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg border text-[15px]"
        style={{
          background: `rgba(${exp.accentRgb},0.12)`,
          borderColor: `rgba(${exp.accentRgb},0.3)`,
        }}
      >
        {activity.moduleIcon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-[var(--ds-text-primary)]">
          {activity.title}
        </div>
        <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
          {exp.label} · {activity.activityLabel}
          {code ? (
            <>
              {" "}
              · <span className="font-mono">{code}</span>
            </>
          ) : null}
        </div>
      </div>
      <StatusBadge status={activity.status} />
      <span className="hidden w-24 text-right text-[11.5px] text-[var(--ds-text-faint)] sm:block">
        {activity.occurredAt ? formatRelative(activity.occurredAt) : ""}
      </span>
      <ArrowRight
        size={13}
        className="text-[var(--ds-text-faint)] opacity-0 transition group-hover:opacity-100"
      />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; rgb: string }> = {
    open: { label: "En cours", rgb: "16,185,129" },
    lobby: { label: "Lobby", rgb: "99,102,241" },
    in_progress: { label: "En cours", rgb: "16,185,129" },
    ended: { label: "Terminée", rgb: "100,116,139" },
    closed: { label: "Terminée", rgb: "100,116,139" },
  };
  const m = map[status] ?? { label: status, rgb: "100,116,139" };
  return (
    <span
      className="hidden rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider sm:inline-block"
      style={{
        background: `rgba(${m.rgb},0.14)`,
        color: `rgb(${m.rgb})`,
        border: `1px solid rgba(${m.rgb},0.3)`,
      }}
    >
      {m.label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="divide-y divide-[var(--ds-border-faint)]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--ds-surface-2)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--ds-surface-2)]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--ds-surface-1)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 text-center text-[13px] text-[var(--ds-text-faint)]">{label}</div>
  );
}

function resumePath(a: DashboardActivity): string {
  const code = a.sessionCode || extractCode(a.details);
  if (a.moduleId === "skills-matrix")
    return code ? `/skills-matrix?mode=join&code=${code}` : "/skills-matrix";
  if (a.moduleId === "radar-party")
    return code ? `/radar-party?mode=join&code=${code}` : "/radar-party";
  if (a.moduleId === "planning-poker")
    return code
      ? `/play?experience=planning-poker&mode=join&code=${code}`
      : "/play?experience=planning-poker";
  return code ? `/play?mode=join&code=${code}` : "/play";
}

function extractCode(details: string | null): string | null {
  if (!details) return null;
  const m = details.match(/Code\s+([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : null;
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
