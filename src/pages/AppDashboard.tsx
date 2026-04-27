import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DashboardActivitiesResponse, type DashboardActivity } from "@/net/api";
import { EXPERIENCES, EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { ExperienceCard } from "@/components/app-shell-v2/ExperienceCard";
import { ArrowRight, Sparkles, History, FolderKanban, Play } from "lucide-react";

export default function AppDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardActivitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getDashboardActivities()
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Erreur");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const moduleStats = useMemo(() => {
    const map = new Map<string, { totalActivities: number; lastActivityAt: string | null }>();
    data?.modules.forEach((m) => {
      map.set(m.moduleId, { totalActivities: m.totalActivities, lastActivityAt: m.lastActivityAt });
    });
    return map;
  }, [data]);

  const recentSessions = useMemo<DashboardActivity[]>(() => {
    if (!data) return [];
    return data.modules
      .flatMap((m) => m.activities.filter((a) => a.activityType === "session"))
      .sort((a, b) => Date.parse(b.occurredAt || "") - Date.parse(a.occurredAt || ""))
      .slice(0, 5);
  }, [data]);

  const recentTemplates = useMemo<DashboardActivity[]>(() => {
    if (!data) return [];
    return data.modules
      .flatMap((m) => m.activities.filter((a) => a.activityType === "template"))
      .sort((a, b) => Date.parse(b.occurredAt || "") - Date.parse(a.occurredAt || ""))
      .slice(0, 4);
  }, [data]);

  const totalSessions = useMemo(() => {
    if (!data) return 0;
    return data.modules.reduce(
      (acc, m) => acc + m.activities.filter((a) => a.activityType === "session").length,
      0,
    );
  }, [data]);

  const lastSession = recentSessions[0] ?? null;
  const firstName = (user?.displayName || user?.email || "").split(/\s+/)[0]?.split("@")[0] || "";

  return (
    <div className="space-y-10 pb-12">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Dashboard
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
          Bonjour {firstName || "👋"}
        </h1>
        <p className="text-[14px] text-[var(--ds-text-muted)]">
          Lancez une session, reprenez un template, ou consultez vos derniers ateliers.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          Impossible de charger l'activité : {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Sessions animées" value={totalSessions} icon={<Sparkles size={14} />} />
        <StatTile
          label="Templates"
          value={recentTemplates.length}
          icon={<FolderKanban size={14} />}
        />
        <StatTile
          label="Dernière activité"
          value={data?.modules.find((m) => m.lastActivityAt)?.lastActivityAt ? "Récemment" : "—"}
          icon={<History size={14} />}
          textValue
        />
      </section>

      {lastSession ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-gradient-to-br from-[var(--ds-surface-2)] to-[var(--ds-surface-0)] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ds-text-faint)]">
                Reprendre
              </div>
              <h2 className="mt-1 text-[20px] font-semibold text-[var(--ds-text-primary)]">
                {lastSession.title}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-[var(--ds-text-muted)]">
                <span>{lastSession.moduleIcon}</span>
                <span>{lastSession.moduleLabel}</span>
                {lastSession.details ? (
                  <>
                    <span>·</span>
                    <span className="font-mono">{lastSession.details}</span>
                  </>
                ) : null}
              </div>
            </div>
            <Link
              to={resumePath(lastSession)}
              className="ds-focus-ring inline-flex h-10 items-center gap-2 self-start rounded-lg bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400 sm:self-auto"
            >
              <Play size={13} />
              Reprendre la session
              <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Vos experiences" linkTo="/app/experiences" linkLabel="Tout voir" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
          {EXPERIENCES.map((exp) => {
            const stats = moduleStats.get(exp.id);
            return (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                totalActivities={stats?.totalActivities ?? 0}
                lastActivityAt={stats?.lastActivityAt ?? null}
              />
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Sessions récentes" />
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)]">
            {loading ? (
              <SkeletonRows />
            ) : recentSessions.length === 0 ? (
              <EmptyRow label="Aucune session pour l'instant — lancez-en une depuis ⌘K." />
            ) : (
              recentSessions.map((s) => <SessionRow key={s.id} activity={s} />)
            )}
          </div>
        </div>
        <div>
          <SectionHeader title="Templates" />
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)]">
            {loading ? (
              <SkeletonRows />
            ) : recentTemplates.length === 0 ? (
              <EmptyRow label="Aucun template — préparez votre prochain atelier en avance." />
            ) : (
              recentTemplates.map((t) => <TemplateRow key={t.id} activity={t} />)
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  linkTo,
  linkLabel,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold text-[var(--ds-text-primary)]">{title}</h2>
      {linkTo ? (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
        >
          {linkLabel}
          <ArrowRight size={12} />
        </Link>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  textValue,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  textValue?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4">
      <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-wider text-[var(--ds-text-faint)]">
        <span className="text-[var(--ds-text-muted)]">{icon}</span>
        {label}
      </div>
      <div
        className={`mt-2 ${textValue ? "text-[15px]" : "text-[26px]"} font-semibold tracking-tight text-[var(--ds-text-primary)]`}
      >
        {value}
      </div>
    </div>
  );
}

function SessionRow({ activity }: { activity: DashboardActivity }) {
  const exp = EXPERIENCE_BY_ID[activity.moduleId];
  return (
    <Link
      to={resumePath(activity)}
      className="flex items-center gap-3 border-b border-[var(--ds-border-faint)] px-4 py-3 last:border-b-0 hover:bg-[var(--ds-surface-1)]"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg border text-[14px]"
        style={{
          background: `rgba(${exp.accentRgb},0.12)`,
          borderColor: `rgba(${exp.accentRgb},0.3)`,
        }}
      >
        {activity.moduleIcon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--ds-text-primary)]">
          {activity.title}
        </div>
        <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
          {activity.activityLabel}
          {activity.details ? ` · ${activity.details}` : ""}
        </div>
      </div>
      <span className="text-[11px] text-[var(--ds-text-faint)]">
        {activity.occurredAt ? formatRelative(activity.occurredAt) : ""}
      </span>
    </Link>
  );
}

function TemplateRow({ activity }: { activity: DashboardActivity }) {
  const exp = EXPERIENCE_BY_ID[activity.moduleId];
  const editPath = templateEditPath(activity);
  return (
    <Link
      to={editPath}
      className="flex items-center gap-3 border-b border-[var(--ds-border-faint)] px-4 py-3 last:border-b-0 hover:bg-[var(--ds-surface-1)]"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg border text-[14px]"
        style={{
          background: `rgba(${exp.accentRgb},0.12)`,
          borderColor: `rgba(${exp.accentRgb},0.3)`,
        }}
      >
        <FolderKanban size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-[var(--ds-text-primary)]">
          {activity.title}
        </div>
        <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
          {activity.moduleLabel}
          {activity.details ? ` · ${activity.details}` : ""}
        </div>
      </div>
    </Link>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--ds-border-faint)]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--ds-surface-2)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--ds-surface-2)]" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--ds-surface-1)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ds-text-faint)]">{label}</div>
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

function templateEditPath(a: DashboardActivity): string {
  const id = a.id.replace(/^template:/, "");
  if (a.moduleId === "skills-matrix") return `/prepare/skills-matrix/${id}`;
  if (a.moduleId === "planning-poker") return `/prepare/poker/${id}`;
  return `/prepare/templates/${id}`;
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
  if (d < 7) return `${d} j`;
  const w = Math.round(d / 7);
  return `${w} sem`;
}
