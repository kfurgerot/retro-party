import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type DashboardActivitiesResponse,
  type DashboardActivity,
  type SuiteModuleId,
  type Team,
} from "@/net/api";
import { EXPERIENCES, EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { Filter, Play, Plus, Search, Settings2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamPicker } from "@/components/app-shell-v2/TeamPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

type ModuleFilter = "all" | SuiteModuleId;
type TeamFilter = "all" | "none" | string;

export default function AppTemplates() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardActivitiesResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.getDashboardActivities(), api.listTeams()])
      .then(([activities, teamsRes]) => {
        if (!alive) return;
        setData(activities);
        setTeams(teamsRes.items);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const updateActivityTeam = (activityId: string, teamId: string | null) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map((m) => ({
          ...m,
          activities: m.activities.map((a) => (a.id === activityId ? { ...a, teamId } : a)),
        })),
      };
    });
  };

  const templates = useMemo<DashboardActivity[]>(() => {
    if (!data) return [];
    let list = data.modules.flatMap((m) =>
      m.activities.filter((a) => a.activityType === "template"),
    );
    if (moduleFilter !== "all") list = list.filter((t) => t.moduleId === moduleFilter);
    if (teamFilter === "none") list = list.filter((t) => t.teamId === null);
    else if (teamFilter !== "all") list = list.filter((t) => t.teamId === teamFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.details ?? "").toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => Date.parse(b.occurredAt || "") - Date.parse(a.occurredAt || ""));
  }, [data, moduleFilter, teamFilter, query]);

  const creatableExperiences = useMemo(() => EXPERIENCES.filter((exp) => exp.prepareRoute), []);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
            Templates
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
            Vos templates
          </h1>
          <p className="text-[14px] text-[var(--ds-text-muted)]">
            Préparez vos ateliers en avance, dupliquez ce qui marche, lancez en un clic.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ds-focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-indigo-400/40 bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400 sm:self-auto"
            >
              <Plus size={14} />
              Créer un template
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-primary)]"
          >
            <DropdownMenuLabel className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
              Choisir un module
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--ds-border)]" />
            {creatableExperiences.map((exp) => (
              <DropdownMenuItem
                key={exp.id}
                onSelect={() => navigate(exp.prepareRoute!)}
                className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-[13px] focus:bg-[var(--ds-surface-2)]"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md border text-[14px]"
                  style={{
                    background: `rgba(${exp.accentRgb},0.14)`,
                    borderColor: `rgba(${exp.accentRgb},0.3)`,
                  }}
                >
                  {exp.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[var(--ds-text-primary)]">
                    {exp.label}
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
                    {exp.tagline}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
            placeholder="Rechercher un template…"
            className="h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] pl-9 pr-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter size={13} className="shrink-0 text-[var(--ds-text-faint)]" />
          <Chip active={moduleFilter === "all"} onClick={() => setModuleFilter("all")}>
            Tous
          </Chip>
          {EXPERIENCES.map((exp) => (
            <Chip
              key={exp.id}
              active={moduleFilter === exp.id}
              onClick={() => setModuleFilter(exp.id)}
              accent={exp.accent}
              accentRgb={exp.accentRgb}
            >
              {exp.icon} {exp.label}
            </Chip>
          ))}
        </div>
      </div>

      {teams.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Users size={13} className="shrink-0 text-[var(--ds-text-faint)]" />
          <Chip active={teamFilter === "all"} onClick={() => setTeamFilter("all")}>
            Toutes équipes
          </Chip>
          <Chip active={teamFilter === "none"} onClick={() => setTeamFilter("none")}>
            Sans équipe
          </Chip>
          {teams.map((team) => (
            <Chip
              key={team.id}
              active={teamFilter === team.id}
              onClick={() => setTeamFilter(team.id)}
            >
              {team.name}
            </Chip>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          Erreur : {error}
        </div>
      ) : null}

      {loading ? (
        <SkeletonGrid />
      ) : templates.length === 0 ? (
        <EmptyState moduleFilter={moduleFilter} query={query} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card
              key={t.id}
              activity={t}
              teams={teams}
              onTeamChange={(teamId) => updateActivityTeam(t.id, teamId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
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

function Card({
  activity,
  teams,
  onTeamChange,
}: {
  activity: DashboardActivity;
  teams: Team[];
  onTeamChange: (teamId: string | null) => void;
}) {
  const exp = EXPERIENCE_BY_ID[activity.moduleId];
  const editPath = templateEditPath(activity);
  return (
    <article className="ds-card-hover group flex flex-col rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-[15px]"
          style={{
            background: `rgba(${exp.accentRgb},0.12)`,
            borderColor: `rgba(${exp.accentRgb},0.3)`,
          }}
        >
          {activity.moduleIcon}
        </span>
        <div className="flex items-center gap-1.5">
          {activity.status === "archived" ? (
            <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-faint)]">
              Archivé
            </span>
          ) : null}
          <TeamPicker
            teams={teams}
            currentTeamId={activity.teamId}
            kind={activity.kind}
            itemId={activity.rawId}
            onChange={onTeamChange}
          />
        </div>
      </div>
      <h3 className="mt-3 truncate text-[14px] font-semibold text-[var(--ds-text-primary)]">
        {activity.title}
      </h3>
      <p className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[12px] text-[var(--ds-text-muted)]">
        {activity.details || exp.tagline}
      </p>
      <div className="mt-4 flex items-center gap-1.5">
        <Link
          to={exp.hostRoute}
          className="ds-focus-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-white transition"
          style={{ background: exp.accent }}
        >
          <Play size={11} />
          Lancer
        </Link>
        <Link
          to={editPath}
          className="ds-focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2.5 text-[12px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
        >
          <Settings2 size={11} />
          Éditer
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ moduleFilter, query }: { moduleFilter: ModuleFilter; query: string }) {
  if (query || moduleFilter !== "all") {
    return (
      <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-10 text-center text-[13px] text-[var(--ds-text-faint)]">
        Aucun template ne correspond aux filtres.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-6 py-10 text-center">
      <h3 className="text-[16px] font-semibold text-[var(--ds-text-primary)]">
        Aucun template pour l'instant
      </h3>
      <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
        Préparez votre prochain atelier en avance — vous pourrez le réutiliser et l'améliorer.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {EXPERIENCES.filter((e) => e.prepareRoute).map((exp) => (
          <Link
            key={exp.id}
            to={exp.prepareRoute!}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            {exp.icon} Préparer {exp.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-[160px] animate-pulse rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)]"
        />
      ))}
    </div>
  );
}

function templateEditPath(a: DashboardActivity): string {
  const id = a.id.replace(/^template:/, "");
  if (a.moduleId === "skills-matrix") return `/prepare/skills-matrix/${id}`;
  if (a.moduleId === "planning-poker") return `/prepare/poker/${id}`;
  return `/prepare/templates/${id}`;
}
