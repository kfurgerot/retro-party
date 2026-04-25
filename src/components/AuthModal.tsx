import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/net/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type AuthTab = "login" | "register" | "forgot";

export const AuthModal = ({
  open,
  onOpenChange,
  onSuccess,
  initialTab = "login",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  initialTab?: AuthTab;
}) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setError(null);
    setInfo(null);
    setPassword("");
  };

  const handleTab = (t: AuthTab) => {
    setTab(t);
    if (t !== "register") setAcceptedTerms(false);
    reset();
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
        if (!acceptedTerms) {
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
    "h-11 w-full rounded-2xl border border-[#cfd9d1] bg-white/80 px-4 text-sm text-[#18211f] placeholder:text-[#8b9891] outline-none transition focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20";

  const titleByTab: Record<AuthTab, string> = {
    login: "Connexion",
    register: "Créer un compte",
    forgot: "Réinitialiser le mot de passe",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-[#d8e2d9] bg-[#f7f8f3] p-0 shadow-2xl [&>button]:text-[#647067] [&>button]:hover:text-[#24443d]">
        <div className="rounded-t-2xl border-b border-[#d8e2d9] bg-white/70 p-5">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#163832] text-sm text-white">
              ⚡
            </div>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
              Agile Suite
            </span>
          </div>
          <div className="text-base font-black text-[#12201d]">{titleByTab[tab]}</div>
          <p className="mt-1 text-xs leading-5 text-[#647067]">
            {tab === "login"
              ? "Retrouve tes sessions et tes templates."
              : tab === "register"
                ? "Configure ton profil et accède à tout l'espace AgileSuite."
                : "On t'envoie un lien sécurisé pour définir un nouveau mot de passe."}
          </p>
        </div>

        <div className="p-5">
          <div className="mb-4 flex gap-1 rounded-2xl border border-[#d8e2d9] bg-white/58 p-1">
            {(["login", "register", "forgot"] as AuthTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTab(t)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-xs font-semibold transition-all",
                  tab === t
                    ? "bg-[#163832] text-white shadow-sm"
                    : "text-[#66766f] hover:text-[#24443d]",
                )}
              >
                {t === "login" ? "Connexion" : t === "register" ? "Inscription" : "Mot de passe"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "register" && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#66766f]">
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
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#66766f]">
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
                <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#66766f]">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  required
                  className={inputCls}
                />
              </div>
            )}

            {tab === "register" && (
              <label className="flex items-start gap-3 rounded-2xl border border-[#d8e2d9] bg-white/62 p-3 text-xs leading-5 text-[#647067]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#163832]"
                  required
                />
                <span>
                  J'accepte les{" "}
                  <Link
                    to="/cgu"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#24443d] underline-offset-4 hover:underline"
                  >
                    Conditions Générales d'Utilisation
                  </Link>{" "}
                  d'AgileSuite.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-2xl bg-[#163832] text-sm font-black text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] disabled:opacity-50"
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
