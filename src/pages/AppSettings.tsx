import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, KeyRound, LogOut, Mail, User as UserIcon } from "lucide-react";

export default function AppSettings() {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.displayName || "");
  }, [user]);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    const next = displayName.trim();
    if (next.length < 2) {
      setProfileMsg({
        kind: "err",
        text: "Le nom d'affichage doit contenir au moins 2 caractères.",
      });
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile(next);
      setProfileMsg({ kind: "ok", text: "Profil mis à jour." });
    } catch (err) {
      setProfileMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Une erreur est survenue.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({
        kind: "err",
        text: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: "err", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setPwSaving(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setPwMsg({ kind: "ok", text: message || "Mot de passe mis à jour." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Une erreur est survenue.",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      setLogoutLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-10 text-center text-[13px] text-[var(--ds-text-faint)]">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Paramètres
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
          Votre compte
        </h1>
        <p className="text-[14px] text-[var(--ds-text-muted)]">
          Profil, sécurité, session — tout ce qui concerne votre compte AgileSuite.
        </p>
      </header>

      <Section
        icon={<UserIcon size={14} />}
        title="Profil"
        description="Le nom d'affichage est visible par les autres participants quand vous animez."
      >
        <form onSubmit={handleProfile} className="space-y-4">
          <Field label="Adresse e-mail" hint="Non modifiable depuis cet écran.">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-muted)]">
              <Mail size={13} className="text-[var(--ds-text-faint)]" />
              {user.email}
            </div>
          </Field>
          <Field label="Nom d'affichage">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              autoComplete="name"
              className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              placeholder="Karl Furgerot"
            />
          </Field>
          <FormFooter
            message={profileMsg}
            submitLabel={profileSaving ? "Enregistrement…" : "Enregistrer"}
            disabled={profileSaving || displayName.trim() === (user.displayName || "")}
          />
        </form>
      </Section>

      <Section
        icon={<KeyRound size={14} />}
        title="Sécurité"
        description="Changez votre mot de passe régulièrement, surtout sur les comptes admin d'équipe."
      >
        <form onSubmit={handlePassword} className="space-y-4">
          <Field label="Mot de passe actuel">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[13px] text-[var(--ds-text-primary)] focus:border-indigo-400/60 focus:outline-none"
            />
          </Field>
          <Field label="Nouveau mot de passe" hint="8 caractères minimum.">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[13px] text-[var(--ds-text-primary)] focus:border-indigo-400/60 focus:outline-none"
            />
          </Field>
          <Field label="Confirmer le nouveau mot de passe">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="ds-focus-ring h-10 w-full rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[13px] text-[var(--ds-text-primary)] focus:border-indigo-400/60 focus:outline-none"
            />
          </Field>
          <FormFooter
            message={pwMsg}
            submitLabel={pwSaving ? "Mise à jour…" : "Mettre à jour"}
            disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
          />
        </form>
      </Section>

      <Section
        icon={<LogOut size={14} />}
        title="Session"
        description="Déconnectez-vous de cet appareil. Vous pourrez vous reconnecter à tout moment."
      >
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutLoading}
          className="ds-focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 text-[13px] font-semibold text-rose-200 transition hover:bg-rose-500/15 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={13} />
          {logoutLoading ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[var(--ds-text-muted)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-[var(--ds-text-primary)]">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--ds-text-muted)]">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-[var(--ds-text-secondary)]">{label}</span>
        {hint ? <span className="text-[11px] text-[var(--ds-text-faint)]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function FormFooter({
  message,
  submitLabel,
  disabled,
}: {
  message: { kind: "ok" | "err"; text: string } | null;
  submitLabel: string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div aria-live="polite" className="min-h-[18px] text-[12px]">
        {message?.kind === "ok" ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <CheckCircle2 size={12} />
            {message.text}
          </span>
        ) : message?.kind === "err" ? (
          <span className="text-rose-300">{message.text}</span>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="ds-focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.25)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
