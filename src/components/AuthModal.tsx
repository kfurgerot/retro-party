import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api, OAuthProviderId } from "@/net/api";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type AuthTab = "login" | "register" | "forgot";

const GoogleLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 533.5 544.3"
    className={className}
    aria-hidden="true"
    focusable="false"
    role="img"
  >
    <path
      fill="#4285F4"
      d="M533.5 278.4c0-18.5-1.5-36.3-4.4-53.5H272v101.2h147.1c-6.3 34-25.4 62.8-54.1 82.1v68.2h87.4c51.1-47 81.1-116.2 81.1-197.9z"
    />
    <path
      fill="#34A853"
      d="M272 544.3c73.5 0 135.2-24.3 180.3-66.1l-87.4-68.2c-24.3 16.3-55.4 25.9-92.9 25.9-71.3 0-131.8-48.1-153.3-112.7H28.4v70.7C73.4 482.4 165.1 544.3 272 544.3z"
    />
    <path
      fill="#FBBC05"
      d="M118.7 323.2C113.3 307 110.2 289.8 110.2 272c0-17.8 3.1-35 8.5-51.2v-70.7H28.4C10.2 186.3 0 227.7 0 272s10.2 85.7 28.4 121.9l90.3-70.7z"
    />
    <path
      fill="#EA4335"
      d="M272 108.1c40 0 75.9 13.8 104.2 41l78.2-78.2C407.1 26.9 345.5 0 272 0 165.1 0 73.4 61.9 28.4 150.1l90.3 70.7C140.2 156.2 200.7 108.1 272 108.1z"
    />
  </svg>
);

const MicrosoftLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" role="img">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
  </svg>
);

export const AuthModal = ({
  open,
  onOpenChange,
  onSuccess,
  initialTab = "login",
  postAuthPath = null,
  oauthError = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  initialTab?: AuthTab;
  postAuthPath?: string | null;
  oauthError?: string | null;
}) => {
  const { login, register, startOAuthLogin, oauthProviders } = useAuth();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (oauthError) setError(oauthError);
  }, [open, oauthError]);

  const reset = () => {
    setError(null);
    setInfo(null);
    setPassword("");
  };

  const handleTab = (t: AuthTab) => {
    setTab(t);
    reset();
  };

  const handleOAuthStart = (provider: OAuthProviderId) => {
    setError(null);
    setInfo(null);
    if (!oauthProviders[provider]) {
      setError(
        provider === "google"
          ? "Connexion Google non configurée sur cet environnement."
          : "Connexion Microsoft non configurée sur cet environnement.",
      );
      return;
    }
    if (tab === "register" && !termsAccepted) {
      setError("Tu dois accepter les CGU pour créer un compte.");
      return;
    }
    const fallbackPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextPath =
      typeof postAuthPath === "string" && postAuthPath.trim() ? postAuthPath : fallbackPath;
    startOAuthLogin(provider, nextPath);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email.trim(), password);
        onSuccess();
        onOpenChange(false);
      } else if (tab === "register") {
        if (!displayName.trim()) {
          setError("Le nom d'affichage est requis.");
          setLoading(false);
          return;
        }
        if (!termsAccepted) {
          setError("Tu dois accepter les CGU pour créer un compte.");
          setLoading(false);
          return;
        }
        await register(email.trim(), password, displayName.trim());
        onSuccess();
        onOpenChange(false);
      } else {
        if (!email.trim()) {
          setError("Saisis ton adresse e-mail.");
          setLoading(false);
          return;
        }
        const res = await api.forgotPassword({ email: email.trim() });
        setInfo(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50";

  const titleByTab: Record<AuthTab, string> = {
    login: "Connexion",
    register: "Créer un compte",
    forgot: "Réinitialiser le mot de passe",
  };
  const oauthDisabled = loading || (tab === "register" && !termsAccepted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100">
        <DialogTitle className="sr-only">{titleByTab[tab]}</DialogTitle>
        <DialogDescription className="sr-only">
          {tab === "login"
            ? "Connexion a Agile Suite."
            : tab === "register"
              ? "Creation de compte Agile Suite."
              : "Demande de reinitialisation de mot de passe Agile Suite."}
        </DialogDescription>
        <div className="rounded-t-2xl border-b border-white/[0.08] bg-gradient-to-r from-indigo-500/14 via-violet-500/9 to-pink-500/12 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
              ⚡
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
              Agile Suite
            </span>
          </div>
          <div className="text-base font-semibold text-slate-100">{titleByTab[tab]}</div>
          <p className="mt-1 text-xs text-slate-400">
            {tab === "login"
              ? "Retrouve tes sessions et tes templates."
              : tab === "register"
                ? "Configure ton profil et accède à tout l'espace AgileSuite."
                : "On t'envoie un lien sécurisé pour définir un nouveau mot de passe."}
          </p>
        </div>

        <div className="p-5">
          <div className="mb-4 flex gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
            {(["login", "register", "forgot"] as AuthTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTab(t)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-semibold transition-all",
                  tab === t
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                {t === "login" ? "Connexion" : t === "register" ? "Inscription" : "Mot de passe"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {info}
            </div>
          )}

          {tab !== "forgot" && (
            <div className="mb-4 space-y-2">
              <button
                type="button"
                onClick={() => handleOAuthStart("google")}
                disabled={oauthDisabled || !oauthProviders.google}
                className="flex h-12 w-full items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.03] px-3.5 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <GoogleLogo className="h-4 w-4" />
                  </span>
                  Continuer avec Google
                </span>
                {!oauthProviders.google && (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    Non configuré
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleOAuthStart("microsoft")}
                disabled={oauthDisabled || !oauthProviders.microsoft}
                className="flex h-12 w-full items-center justify-between rounded-2xl border border-[#2F6FED]/40 bg-[#0b1220] px-3.5 text-sm font-semibold text-slate-100 transition hover:border-[#2F6FED]/65 hover:bg-[#0f1a2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#111827] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <MicrosoftLogo className="h-4 w-4" />
                  </span>
                  Continuer avec Microsoft
                </span>
                {!oauthProviders.microsoft && (
                  <span className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    Non configuré
                  </span>
                )}
              </button>
              <div className="pt-1 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Ou avec ton adresse e-mail
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "register" && (
              <div className="space-y-1">
                <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Nom d'affichage
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ton nom"
                  className={inputCls}
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@entreprise.com"
                required
                className={inputCls}
                autoFocus={tab !== "register"}
              />
            </div>

            {tab !== "forgot" && (
              <div className="space-y-1">
                <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    required
                    className={cn(inputCls, "pr-10")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {tab === "register" && (
              <label className="flex cursor-pointer items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500"
                />
                <span className="text-xs leading-relaxed text-slate-400">
                  J'ai lu et j'accepte les{" "}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Conditions Générales d'Utilisation
                  </Link>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (tab === "register" && !termsAccepted)}
              className="mt-1 h-11 w-full rounded-2xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
            >
              {loading
                ? "..."
                : tab === "login"
                  ? "Se connecter"
                  : tab === "register"
                    ? "Créer mon compte"
                    : "Envoyer le lien"}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
