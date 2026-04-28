import { FormEvent, useEffect, useState } from "react";
import { api, type ActionItem } from "@/net/api";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  // Source: either a session code OR a team id (mutually exclusive).
  sessionCode?: string;
  teamId?: string;
  // Whether the current viewer can create / edit items. Defaults to: auth user.
  canEdit?: boolean;
  title?: string;
  emptyHint?: string;
};

export function ActionItemsCard({
  sessionCode,
  teamId,
  canEdit,
  title = "Action items",
  emptyHint = "Aucun action item — capturez les engagements pris en session.",
}: Props) {
  const { user } = useAuth();
  const editable = canEdit ?? !!user;

  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    const loader = sessionCode
      ? api.listSessionActionItems(sessionCode)
      : teamId
        ? api.listTeamActionItems(teamId)
        : Promise.resolve({ items: [] });
    loader
      .then((res) => alive && setItems(res.items))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Erreur"));
    return () => {
      alive = false;
    };
  }, [sessionCode, teamId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionCode || draft.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createSessionActionItem(sessionCode, { title: draft.trim() });
      setItems((prev) => (prev ? [res.item, ...prev] : [res.item]));
      setDraft("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (item: ActionItem) => {
    const nextStatus = item.status === "done" ? "open" : "done";
    try {
      const res = await api.updateActionItem(item.id, { status: nextStatus });
      setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? res.item : i)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const removeItem = async (item: ActionItem) => {
    try {
      await api.deleteActionItem(item.id);
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const open = items?.filter((i) => i.status === "open") ?? [];
  const done = items?.filter((i) => i.status === "done") ?? [];

  return (
    <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
            <ListChecks size={15} />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">{title}</h2>
            <p className="text-[11.5px] text-[var(--ds-text-muted)]">
              {open.length} ouvert{open.length > 1 ? "s" : ""}
              {done.length > 0 ? ` · ${done.length} terminé${done.length > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>
        {editable && sessionCode && !creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="ds-focus-ring inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-2.5 text-[12px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            <Plus size={12} />
            Ajouter
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {creating && sessionCode ? (
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Décrire l'action concrète…"
            maxLength={200}
            className="ds-focus-ring h-10 flex-1 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={submitting || draft.trim().length < 2}
              className="ds-focus-ring inline-flex h-10 items-center rounded-lg bg-indigo-500 px-4 text-[12.5px] font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {submitting ? "…" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDraft("");
              }}
              className="ds-focus-ring inline-flex h-10 items-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {items === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-6 text-center text-[12.5px] text-[var(--ds-text-muted)]">
          {emptyHint}
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {[...open, ...done].map((item) => (
            <Row
              key={item.id}
              item={item}
              editable={editable}
              onToggle={() => void toggleStatus(item)}
              onRemove={() => void removeItem(item)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  item,
  editable,
  onToggle,
  onRemove,
}: {
  item: ActionItem;
  editable: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const done = item.status === "done";
  return (
    <li
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] p-3 transition",
        done ? "opacity-70" : "hover:bg-[var(--ds-surface-1)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!editable}
        aria-label={done ? "Réouvrir" : "Marquer comme fait"}
        className={cn(
          "ds-focus-ring mt-0.5 shrink-0 transition",
          editable ? "cursor-pointer" : "cursor-default",
        )}
      >
        {done ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <Circle size={16} className="text-[var(--ds-text-faint)] hover:text-emerald-300" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] text-[var(--ds-text-primary)]",
            done ? "line-through text-[var(--ds-text-muted)]" : "",
          )}
        >
          {item.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ds-text-faint)]">
          <span className="font-mono">{item.sessionCode}</span>
          {item.ownerDisplayName ? <span>· @{item.ownerDisplayName}</span> : null}
          <span>· {formatRelative(item.createdAt)}</span>
        </div>
      </div>
      {editable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer"
          className="ds-focus-ring shrink-0 rounded-md border border-transparent p-1.5 text-[var(--ds-text-faint)] opacity-0 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      ) : null}
    </li>
  );
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} j`;
  const w = Math.round(d / 7);
  return `${w} sem`;
}
