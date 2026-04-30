import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type InvitationPreview } from "@/net/api";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, CheckCircle2, AlertTriangle, Mail, Users } from "lucide-react";

type Status = "loading" | "ready" | "accepting" | "accepted" | "error";

export default function InvitationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);

  // Load preview once.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Lien d'invitation invalide.");
      return;
    }
    let alive = true;
    api
      .getInvitationPreview(token)
      .then((res) => {
        if (!alive) return;
        setPreview(res.invitation);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : "Erreur";
        // Map server messages to friendly French.
        if (/expired/i.test(msg)) setError("Cette invitation a expiré.");
        else if (/already used/i.test(msg)) setError("Cette invitation a déjà été utilisée.");
        else if (/not found/i.test(msg)) setError("Invitation introuvable.");
        else setError(msg);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const userEmail = (user?.email ?? "").toLowerCase();
  const inviteEmail = (preview?.email ?? "").toLowerCase();
  const emailMatches = !!userEmail && userEmail === inviteEmail;

  // Auto-accept once authed AND email matches.
  useEffect(() => {
    if (status !== "ready" || !preview || !user || !emailMatches) return;
    let alive = true;
    setStatus("accepting");
    api
      .acceptTeamInvitation(token)
      .then(({ team }) => {
        if (!alive) return;
        setStatus("accepted");
        // small delay so the user sees the success state
        window.setTimeout(() => {
          navigate(`/app/teams/${team.id}`);
        }, 800);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Erreur");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [status, preview, user, emailMatches, token, navigate]);

  return (
    <Shell>
      {status === "loading" || authLoading ? (
        <CardSkeleton />
      ) : status === "error" ? (
        <ErrorCard message={error ?? "Une erreur est survenue."} />
      ) : preview ? (
        <InvitationCard
          preview={preview}
          authedUserEmail={userEmail || null}
          emailMatches={emailMatches}
          status={status}
          onSignIn={() => navigate("/", { state: { invitation: token, email: preview.email } })}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-svh flex-col text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] opacity-80"
        style={{
          background: "radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.18), transparent 70%)",
        }}
      />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="ds-fade-in flex flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  );
}

function InvitationCard({
  preview,
  authedUserEmail,
  emailMatches,
  status,
  onSignIn,
}: {
  preview: InvitationPreview;
  authedUserEmail: string | null;
  emailMatches: boolean;
  status: Status;
  onSignIn: () => void;
}) {
  const inviter = preview.inviterName || preview.inviterEmail || "Un collègue";
  const expires = new Date(preview.expiresAt);
  const expiresLabel = expires.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] shadow-[0_12px_36px_rgba(0,0,0,0.45)]">
      <div
        aria-hidden
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)",
        }}
      />
      <div className="p-6 sm:p-8">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
          Invitation à une équipe
        </p>
        <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-tight text-[var(--ds-text-primary)]">
          {inviter} vous invite à rejoindre{" "}
          <span style={{ color: "rgb(99,102,241)" }}>{preview.team.name}</span>
        </h1>

        <div className="mt-5 space-y-2.5 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] p-4 text-[12.5px]">
          <div className="flex items-center gap-2 text-[var(--ds-text-muted)]">
            <Users size={13} className="text-[var(--ds-text-faint)]" />
            <span className="font-medium text-[var(--ds-text-primary)]">{preview.team.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--ds-text-muted)]">
            <Mail size={13} className="text-[var(--ds-text-faint)]" />
            <span>Invitation pour</span>
            <span className="font-medium text-[var(--ds-text-primary)]">{preview.email}</span>
          </div>
          <div className="text-[11.5px] text-[var(--ds-text-faint)]">
            Valable jusqu'au {expiresLabel}
          </div>
        </div>

        {/* Action zone */}
        <div className="mt-6">
          {status === "accepting" ? (
            <ActionRow tone="loading" label="On vous fait entrer dans l'équipe…" />
          ) : status === "accepted" ? (
            <ActionRow tone="success" label="Bienvenue ! Redirection vers l'équipe…" />
          ) : !authedUserEmail ? (
            <SignedOutActions onSignIn={onSignIn} email={preview.email} />
          ) : !emailMatches ? (
            <EmailMismatchWarning authedEmail={authedUserEmail} invitedEmail={preview.email} />
          ) : (
            // authed and matches — auto-accept will fire from the parent effect
            <ActionRow tone="loading" label="Préparation de l'acceptation…" />
          )}
        </div>
      </div>
    </article>
  );
}

function SignedOutActions({ onSignIn, email }: { onSignIn: () => void; email: string }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onSignIn}
        className="ds-focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
      >
        Continuer avec mon compte
        <ArrowRight size={14} />
      </button>
      <p className="text-center text-[11.5px] text-[var(--ds-text-faint)]">
        Connectez-vous ou créez un compte avec{" "}
        <span className="font-medium text-[var(--ds-text-secondary)]">{email}</span> pour rejoindre
        automatiquement l'équipe.
      </p>
    </div>
  );
}

function EmailMismatchWarning({
  authedEmail,
  invitedEmail,
}: {
  authedEmail: string;
  invitedEmail: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-[12.5px] text-amber-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Adresse e-mail différente</p>
          <p className="mt-0.5 text-[12px] text-amber-100/80">
            Cette invitation est destinée à <strong>{invitedEmail}</strong>, mais vous êtes connecté
            avec <strong>{authedEmail}</strong>. Déconnectez-vous puis reconnectez-vous avec
            l'e-mail invité.
          </p>
        </div>
      </div>
      <Link
        to="/"
        className="ds-focus-ring flex h-10 w-full items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[12.5px] font-semibold text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}

function ActionRow({ tone, label }: { tone: "loading" | "success"; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3.5 py-3 text-[13px]">
      {tone === "success" ? (
        <CheckCircle2 size={14} className="text-emerald-400" />
      ) : (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "rgb(99,102,241)" }}
        />
      )}
      <span className="text-[var(--ds-text-secondary)]">{label}</span>
    </div>
  );
}

function CardSkeleton() {
  return (
    <article className="rounded-3xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-8">
      <div className="h-3 w-24 rounded bg-[var(--ds-surface-2)]" />
      <div className="mt-3 h-6 w-3/4 rounded bg-[var(--ds-surface-2)]" />
      <div className="mt-2 h-6 w-1/2 rounded bg-[var(--ds-surface-2)]" />
      <div className="mt-6 h-20 rounded-2xl bg-[var(--ds-surface-2)]" />
      <div className="mt-6 h-11 rounded-xl bg-[var(--ds-surface-2)]" />
    </article>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-300">
        <AlertTriangle size={20} />
      </div>
      <h1 className="mt-4 text-[18px] font-semibold text-[var(--ds-text-primary)]">
        Invitation indisponible
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--ds-text-muted)]">{message}</p>
      <Link
        to="/"
        className="ds-focus-ring mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[12.5px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
      >
        Retour à l'accueil
      </Link>
    </article>
  );
}
