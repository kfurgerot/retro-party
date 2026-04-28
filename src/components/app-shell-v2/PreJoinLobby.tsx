import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type SessionPreview } from "@/net/api";
import { useAuth } from "@/contexts/AuthContext";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LogIn,
  Pencil,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react";

const STATUS_LABELS: Record<SessionPreview["status"], string> = {
  lobby: "En attente",
  live: "En cours",
  ended: "Terminée",
  abandoned: "Abandonnée",
};

const STATUS_COLORS: Record<SessionPreview["status"], string> = {
  lobby: "99,102,241",
  live: "16,185,129",
  ended: "100,116,139",
  abandoned: "234,179,8",
};

function buildLiveUrl(preview: SessionPreview, displayName: string, avatar: number): string {
  const code = preview.code;
  const name = encodeURIComponent(displayName);
  const av = String(Math.max(0, Math.min(30, Math.floor(avatar))) || 0);
  switch (preview.module) {
    case "skills-matrix":
      return `/skills-matrix?mode=join&code=${code}&name=${name}&avatar=${av}&auto=1`;
    case "radar-party":
      return `/radar-party?mode=join&code=${code}&name=${name}&avatar=${av}&auto=1`;
    case "planning-poker":
      return `/play?experience=planning-poker&mode=join&code=${code}&name=${name}&avatar=${av}&auto=1`;
    default:
      return `/play?mode=join&code=${code}&name=${name}&avatar=${av}&auto=1`;
  }
}

type Props = { code: string };

export function PreJoinLobby({ code }: Props) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<SessionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Identity (anonymous fallback only — auth users use their profile).
  const [guestName, setGuestName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    if (!code) return;
    let alive = true;
    api
      .previewSession(code)
      .then((res) => {
        if (alive) setPreview(res);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Code introuvable");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [code]);

  useEffect(() => {
    // Pull a remembered guest name from localStorage as a friendly default.
    try {
      const saved = window.localStorage.getItem("agile.guest.name");
      if (saved && !user) setGuestName(saved.trim().slice(0, 80));
    } catch {
      // ignored
    }
  }, [user]);

  const startEditName = () => {
    setDraftName(user ? user.displayName || "" : guestName);
    setEditingName(true);
  };

  const submitNameEdit = () => {
    const trimmed = draftName.trim().slice(0, 80);
    if (!user && trimmed.length >= 2) {
      setGuestName(trimmed);
      try {
        window.localStorage.setItem("agile.guest.name", trimmed);
      } catch {
        // ignored
      }
    }
    setEditingName(false);
  };

  const handleEnter = () => {
    if (!preview) return;
    const displayName = (user ? user.displayName : guestName).trim();
    if (!displayName || displayName.length < 2) {
      setEditingName(true);
      setDraftName(user?.displayName ?? guestName);
      return;
    }
    if (preview.status === "ended" || preview.status === "abandoned") {
      navigate(`/r/${preview.code}`);
      return;
    }
    navigate(buildLiveUrl(preview, displayName, 0), { replace: true });
  };

  if (loading || authLoading) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] py-12 text-center text-[13px] text-[var(--ds-text-muted)]">
          Chargement de la session…
        </div>
      </Shell>
    );
  }

  if (error || !preview) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
            <AlertCircle size={18} />
          </div>
          <h1 className="mt-3 text-[18px] font-semibold text-[var(--ds-text-primary)]">
            Session introuvable
          </h1>
          <p className="mt-1 text-[13px] text-rose-200">
            {error || "Le code de session n'existe pas ou a expiré."}
          </p>
          <Link
            to="/join"
            className="ds-focus-ring mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            Saisir un autre code
          </Link>
        </div>
      </Shell>
    );
  }

  const exp = EXPERIENCE_BY_ID[preview.module];
  const displayName = user?.displayName?.trim() || guestName;
  const ctaLabel = (() => {
    if (preview.status === "ended") return "Voir les résultats";
    if (preview.status === "abandoned") return "Voir la session";
    if (preview.status === "live") return "Rejoindre la session en cours";
    return "Entrer dans le lobby";
  })();
  const canEnter = displayName.trim().length >= 2 || user !== null;

  return (
    <Shell accentRgb={exp.accentRgb}>
      {/* Header card */}
      <article className="overflow-hidden rounded-3xl border border-[var(--ds-border)] bg-gradient-to-br from-[var(--ds-surface-2)] via-[var(--ds-surface-1)] to-[var(--ds-surface-0)] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border text-[24px]"
            style={{
              background: `rgba(${exp.accentRgb},0.14)`,
              borderColor: `rgba(${exp.accentRgb},0.4)`,
            }}
          >
            {exp.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
              {exp.label}
            </p>
            <h1 className="mt-0.5 text-[20px] font-semibold tracking-tight text-[var(--ds-text-primary)]">
              {preview.title || `Session ${preview.code}`}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider"
                style={{
                  background: `rgba(${STATUS_COLORS[preview.status]},0.14)`,
                  color: `rgb(${STATUS_COLORS[preview.status]})`,
                  border: `1px solid rgba(${STATUS_COLORS[preview.status]},0.3)`,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: `rgb(${STATUS_COLORS[preview.status]})` }}
                />
                {STATUS_LABELS[preview.status]}
              </span>
              {preview.participantCount !== null ? (
                <span className="inline-flex items-center gap-1 text-[var(--ds-text-muted)]">
                  <Users size={11} />
                  {preview.participantCount} participant
                  {preview.participantCount > 1 ? "s" : ""}
                </span>
              ) : null}
              <span className="font-mono text-[var(--ds-text-faint)]">{preview.code}</span>
            </div>
          </div>
        </div>
      </article>

      {/* Identity card */}
      <section className="mt-4 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Vous rejoignez en tant que
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[13px] font-semibold text-[var(--ds-text-primary)]">
            {(displayName || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNameEdit();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  onBlur={submitNameEdit}
                  maxLength={80}
                  placeholder={user ? "Modifier le nom (compte)" : "Votre prénom"}
                  className="ds-focus-ring h-9 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
                />
              </div>
            ) : (
              <>
                <div className="truncate text-[14px] font-medium text-[var(--ds-text-primary)]">
                  {displayName || "—"}
                </div>
                <div className="truncate text-[11.5px] text-[var(--ds-text-faint)]">
                  {user ? user.email : "Invité"}
                </div>
              </>
            )}
          </div>
          {!editingName ? (
            <button
              type="button"
              onClick={startEditName}
              className="ds-focus-ring inline-flex h-8 items-center gap-1 rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-2 text-[11.5px] font-medium text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            >
              <Pencil size={11} />
              Modifier
            </button>
          ) : null}
        </div>
        {!user ? (
          <div className="mt-4 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 py-2 text-[11.5px] text-[var(--ds-text-faint)]">
            <Link
              to="/"
              className="text-[var(--ds-text-secondary)] underline-offset-2 hover:underline"
            >
              Connectez-vous
            </Link>{" "}
            pour retrouver vos sessions sur tous vos appareils.
          </div>
        ) : null}
      </section>

      {/* CTA */}
      <button
        type="button"
        onClick={handleEnter}
        disabled={!canEnter}
        className="ds-focus-ring mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: exp.accent,
          boxShadow: `0 8px 24px rgba(${exp.accentRgb},0.35)`,
        }}
      >
        {preview.status === "ended" || preview.status === "abandoned" ? (
          <Sparkles size={14} />
        ) : (
          <LogIn size={14} />
        )}
        {ctaLabel}
        <ArrowRight size={14} />
      </button>

      {!canEnter ? (
        <p className="mt-2 text-center text-[11.5px] text-[var(--ds-text-faint)]">
          Indiquez votre prénom pour entrer dans la session.
        </p>
      ) : null}

      <p className="mt-4 text-center text-[11.5px] text-[var(--ds-text-faint)]">
        <Link to="/join" className="hover:text-[var(--ds-text-muted)]">
          Saisir un autre code
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children, accentRgb }: { children: React.ReactNode; accentRgb?: string }) {
  return (
    <div
      className="relative flex min-h-svh flex-col text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-70"
        style={{
          background: accentRgb
            ? `radial-gradient(60% 60% at 50% 0%, rgba(${accentRgb},0.18), transparent 70%)`
            : "radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.18), transparent 70%)",
        }}
      />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-[11px] font-bold text-white">
            A
          </div>
          AgileSuite
        </Link>
        <CheckCircle2 size={14} className="text-[var(--ds-text-faint)]" />
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="ds-fade-in">{children}</div>
      </main>
    </div>
  );
}
