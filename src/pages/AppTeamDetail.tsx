import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type DashboardActivity,
  type Team,
  type TeamInsights,
  type TeamInvitation,
  type TeamMember,
} from "@/net/api";
import { useAuth } from "@/contexts/useAuth";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  FolderKanban,
  History,
  Mail,
  Radar,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ActionItemsCard } from "@/components/app-shell-v2/ActionItemsCard";

export default function AppTeamDetail() {
  const { teamId = "" } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [insights, setInsights] = useState<TeamInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamRes, dashRes, insightsRes] = await Promise.all([
        api.getTeam(teamId),
        api.getDashboardActivities(teamId),
        api.getTeamInsights(teamId),
      ]);
      setTeam(teamRes.team);
      setMembers(teamRes.members);
      setPendingInvitations(teamRes.pendingInvitations ?? []);
      setName(teamRes.team.name);
      setDescription(teamRes.team.description ?? "");
      setActivities(dashRes.modules.flatMap((m) => m.activities));
      setInsights(insightsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const isOwner = team?.role === "owner";

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!team || !name.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await api.updateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setTeam((prev) => (prev ? { ...prev, ...res.team } : res.team));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!team || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await api.inviteTeamMember(team.id, { email: inviteEmail.trim() });
      const target = inviteEmail.trim();
      setInviteEmail("");
      if (res.kind === "member") {
        setInviteSuccess(`${target} a été ajouté·e à l'équipe.`);
      } else if (res.emailSent) {
        setInviteSuccess(`Invitation envoyée à ${target}.`);
      } else {
        setInviteSuccess(
          `Invitation enregistrée pour ${target}, mais l'envoi de l'e-mail a échoué — vérifiez la configuration SMTP.`,
        );
      }
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!team) return;
    try {
      await api.cancelTeamInvitation(team.id, invitationId);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleRemove = async (memberUserId: string) => {
    if (!team) return;
    try {
      await api.removeTeamMember(team.id, memberUserId);
      if (memberUserId === user?.id) {
        navigate("/app/teams");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleDelete = async () => {
    if (!team) return;
    try {
      await api.deleteTeam(team.id);
      navigate("/app/teams");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] py-12 text-center text-[13px] text-[var(--ds-text-muted)]">
        Chargement…
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {error || "Équipe introuvable"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <BackLink />

      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
          <Users size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
            Équipe
          </p>
          {editing ? (
            <form onSubmit={handleSaveEdit} className="mt-1 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="ds-focus-ring h-11 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[18px] font-semibold text-[var(--ds-text-primary)] focus:border-indigo-400/60 focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Description (optionnel)"
                className="ds-focus-ring w-full resize-none rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 py-2 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingEdit || !name.trim()}
                  className="ds-focus-ring inline-flex h-9 items-center rounded-lg bg-indigo-500 px-4 text-[12.5px] font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {savingEdit ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(team.name);
                    setDescription(team.description ?? "");
                  }}
                  className="ds-focus-ring inline-flex h-9 items-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[12.5px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[30px]">
                {team.name}
              </h1>
              {team.description ? (
                <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-[var(--ds-text-muted)]">
                  {team.description}
                </p>
              ) : null}
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-2 text-[12px] font-medium text-[var(--ds-text-faint)] underline-offset-2 hover:text-[var(--ds-text-primary)] hover:underline"
                >
                  Modifier
                </button>
              ) : null}
            </>
          )}
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {isOwner ? (
        <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
          <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
            Inviter un membre
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
            Si la personne n'a pas encore de compte, elle recevra un e-mail pour rejoindre l'équipe.
          </p>
          <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Mail
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-faint)]"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] pl-9 pr-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="ds-focus-ring inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-4 text-[13px] font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              <UserPlus size={13} />
              {inviting ? "Invitation…" : "Inviter"}
            </button>
          </form>
          {inviteError ? <p className="mt-2 text-[12px] text-rose-300">{inviteError}</p> : null}
          {inviteSuccess ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-emerald-300">
              <CheckCircle2 size={12} />
              {inviteSuccess}
            </p>
          ) : null}
        </section>
      ) : null}

      {isOwner && pendingInvitations.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--ds-text-primary)]">
            Invitations en attente ({pendingInvitations.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)]">
            {pendingInvitations.map((inv) => (
              <PendingInvitationRow
                key={inv.id}
                invitation={inv}
                onCancel={() => handleCancelInvitation(inv.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Sessions liées"
          value={activities.filter((a) => a.activityType === "session").length}
          icon={<History size={14} />}
          to="/app/sessions"
        />
        <StatTile
          label="Templates liés"
          value={activities.filter((a) => a.activityType === "template").length}
          icon={<FolderKanban size={14} />}
          to="/app/templates"
        />
        <StatTile label="Membres" value={members.length} icon={<Users size={14} />} />
      </section>

      {insights ? <InsightsSection insights={insights} /> : null}

      <ActionItemsCard
        teamId={team.id}
        title="Action items de l'équipe"
        emptyHint="Aucun action item lié à cette équipe — ajoutez-en depuis la page d'une session terminée."
      />

      <section>
        <h2 className="mb-3 text-[14px] font-semibold text-[var(--ds-text-primary)]">
          Membres ({members.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)]">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isCurrentUser={m.userId === user?.id}
              canRemove={isOwner && m.role !== "owner"}
              canLeave={!isOwner && m.userId === user?.id}
              onRemove={() => handleRemove(m.userId)}
            />
          ))}
        </div>
      </section>

      {isOwner ? (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <h2 className="text-[14px] font-semibold text-rose-200">Zone dangereuse</h2>
          <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
            La suppression est irréversible. Les sessions et templates restent intacts.
          </p>
          {confirmDelete ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-rose-200">Vraiment supprimer ?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 text-[12.5px] font-semibold text-rose-100 hover:bg-rose-500/25"
              >
                <Trash2 size={12} />
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="ds-focus-ring inline-flex h-9 items-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ds-focus-ring mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-[12.5px] font-semibold text-rose-200 hover:bg-rose-500/15"
            >
              <Trash2 size={12} />
              Supprimer l'équipe
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  isCurrentUser,
  canRemove,
  canLeave,
  onRemove,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canRemove: boolean;
  canLeave: boolean;
  onRemove: () => void;
}) {
  const initials = (member.displayName || member.email)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 border-b border-[var(--ds-border-faint)] px-4 py-3 last:border-b-0">
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[12px] font-semibold text-[var(--ds-text-primary)]">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-[var(--ds-text-primary)]">
            {member.displayName}
          </span>
          {isCurrentUser ? (
            <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-[var(--ds-text-muted)]">
              Vous
            </span>
          ) : null}
        </div>
        <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">{member.email}</div>
      </div>
      <span
        className={`hidden rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider sm:inline-block ${
          member.role === "owner"
            ? "border border-amber-400/30 bg-amber-500/10 text-amber-300"
            : "border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-muted)]"
        }`}
      >
        {member.role === "owner" ? (
          <span className="inline-flex items-center gap-1">
            <Crown size={9} />
            Owner
          </span>
        ) : (
          member.role
        )}
      </span>
      {canRemove || canLeave ? (
        <button
          type="button"
          onClick={onRemove}
          title={canLeave ? "Quitter l'équipe" : "Retirer le membre"}
          className="ds-focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-faint)] hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <UserMinus size={13} />
        </button>
      ) : null}
    </div>
  );
}

const RADAR_AXIS_LABELS: Record<keyof TeamInsights["radar"]["axes"], string> = {
  collaboration: "Collaboration",
  fun: "Fun",
  learning: "Apprentissages",
  alignment: "Alignement",
  ownership: "Ownership",
  process: "Processus",
  resources: "Ressources",
  roles: "Rôles",
  speed: "Vitesse",
  value: "Valeur",
};

function InsightsSection({ insights }: { insights: TeamInsights }) {
  const radar = insights.radar;
  const skills = insights.skillsLatest;
  const hasRadar = radar.sessionsCount > 0;
  const axes = Object.entries(radar.axes) as Array<[keyof TeamInsights["radar"]["axes"], number]>;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5 lg:col-span-2">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
              <Radar size={15} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
                Radar moyen équipe
              </h2>
              <p className="text-[11.5px] text-[var(--ds-text-muted)]">
                Moyenne des résultats Radar Party liés à l'équipe
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ds-text-muted)]">
            {radar.sessionsCount} session{radar.sessionsCount > 1 ? "s" : ""}
          </span>
        </header>

        {hasRadar ? (
          <div className="mt-5 space-y-2.5">
            {axes.map(([axis, value]) => (
              <div key={axis} className="flex items-center gap-3">
                <span className="w-[120px] shrink-0 text-[12px] font-medium text-[var(--ds-text-secondary)]">
                  {RADAR_AXIS_LABELS[axis]}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--ds-surface-0)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-300/90"
                    style={{ width: `${Math.min(100, Math.max(0, (value / 10) * 100))}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--ds-text-primary)]">
                  {value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-6 text-center text-[12.5px] text-[var(--ds-text-muted)]">
            <Sparkles size={16} className="mx-auto text-[var(--ds-text-faint)]" />
            <p className="mt-2">
              Lancez une session Radar et liez-la à l'équipe pour voir la moyenne ici.
            </p>
          </div>
        )}

        {radar.recent.length > 0 ? (
          <div className="mt-5 border-t border-[var(--ds-border-faint)] pt-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ds-text-faint)]">
              Sessions récentes
            </p>
            <ul className="mt-2 space-y-1">
              {radar.recent.map((s) => (
                <li
                  key={s.sessionId}
                  className="flex items-center justify-between text-[12.5px] text-[var(--ds-text-secondary)]"
                >
                  <span className="min-w-0 truncate">{s.title || `Code ${s.code}`}</span>
                  <span className="text-[var(--ds-text-faint)]">
                    {s.memberCount} part. · {formatDate(s.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
            🧩
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
              Skills Matrix
            </h2>
            <p className="text-[11.5px] text-[var(--ds-text-muted)]">
              Cartographie la plus récente
            </p>
          </div>
        </header>
        {skills ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] p-4">
              <div className="text-[13px] font-medium text-[var(--ds-text-primary)]">
                {skills.title || `Code ${skills.code}`}
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--ds-text-faint)]">
                <span className="font-mono">{skills.code}</span>
                {" · "}
                {formatDate(skills.updatedAt)}
              </div>
            </div>
            <Link
              to={`/skills-matrix?mode=join&code=${skills.code}`}
              className="ds-focus-ring inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 text-[12.5px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
            >
              Ouvrir la matrice
              <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-6 text-center text-[12.5px] text-[var(--ds-text-muted)]">
            Aucune Skills Matrix liée à l'équipe.
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function StatTile({
  label,
  value,
  icon,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  to?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-wider text-[var(--ds-text-faint)]">
        <span className="text-[var(--ds-text-muted)]">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--ds-text-primary)]">
        {value}
      </div>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="ds-card-hover rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4">
      {inner}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/app/teams"
      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
    >
      <ArrowLeft size={13} />
      Toutes les équipes
    </Link>
  );
}

function PendingInvitationRow({
  invitation,
  onCancel,
}: {
  invitation: TeamInvitation;
  onCancel: () => void;
}) {
  const expiresLabel = formatDate(invitation.expiresAt);
  return (
    <div className="flex items-center gap-3 border-b border-[var(--ds-border-faint)] px-4 py-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
        <Mail size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-[var(--ds-text-primary)]">
            {invitation.email}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            <Clock size={9} />
            En attente
          </span>
        </div>
        <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
          Expire le {expiresLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        title="Annuler l'invitation"
        className="ds-focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-faint)] hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
      >
        <X size={13} />
      </button>
    </div>
  );
}
