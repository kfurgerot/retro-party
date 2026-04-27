import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Team } from "@/net/api";
import { ArrowRight, Plus, Users, Crown, AlertCircle } from "lucide-react";

export default function AppTeams() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await api.listTeams();
      setTeams(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createTeam({
        name: name.trim(),
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Équipes
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
          Vos équipes
        </h1>
        <p className="text-[14px] text-[var(--ds-text-muted)]">
          Regroupez vos collaborateurs pour suivre leur maturité et leurs compétences dans le temps.
        </p>
      </header>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {creating ? (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5"
        >
          <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
            Créer une équipe
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ds-text-secondary)]">
                Nom
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Squad Apollo"
                maxLength={80}
                className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ds-text-secondary)]">
                Description (optionnel)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mission, contexte, anything…"
                maxLength={280}
                rows={3}
                className="ds-focus-ring w-full resize-none rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 py-2 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="ds-focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Création…" : "Créer l'équipe"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setName("");
                  setDescription("");
                }}
                className="ds-focus-ring inline-flex h-10 items-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ds-focus-ring inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition hover:bg-indigo-400"
        >
          <Plus size={13} />
          Nouvelle équipe
        </button>
      )}

      {teams === null ? (
        <Skeleton />
      ) : teams.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <Link
      to={`/app/teams/${team.id}`}
      className="ds-card-hover group flex flex-col rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
          <Users size={16} />
        </div>
        {team.role === "owner" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
            <Crown size={9} />
            Owner
          </span>
        ) : (
          <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-[var(--ds-text-muted)]">
            {team.role ?? "Membre"}
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate text-[15px] font-semibold text-[var(--ds-text-primary)]">
        {team.name}
      </h3>
      <p className="mt-0.5 line-clamp-2 min-h-[2.4em] text-[12.5px] text-[var(--ds-text-muted)]">
        {team.description || "Pas de description"}
      </p>
      <div className="mt-4 flex items-center justify-between text-[11.5px] text-[var(--ds-text-faint)]">
        <span>
          {team.memberCount ?? 1} membre{(team.memberCount ?? 1) > 1 ? "s" : ""}
        </span>
        <ArrowRight size={13} className="opacity-0 transition group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[var(--ds-text-muted)]">
        <Users size={20} />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold text-[var(--ds-text-primary)]">
        Aucune équipe pour l'instant
      </h3>
      <p className="mt-1 text-[13px] text-[var(--ds-text-muted)]">
        Créez une équipe pour inviter vos collaborateurs et suivre leur progression.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[180px] animate-pulse rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)]"
        />
      ))}
    </div>
  );
}
