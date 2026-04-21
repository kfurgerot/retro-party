import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { api } from "@/net/api";

type AuthTab = "login" | "register" | "forgot";

const inputCls =
  "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50 transition";

type PrepareAuthFormProps = {
  onSuccess: () => void;
};

export const PrepareAuthForm = ({ onSuccess }: PrepareAuthFormProps) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email.trim(), password);
        onSuccess();
      } else if (tab === "register") {
        if (!displayName.trim()) {
          setError(fr.prepare.displayNameRequired);
          setLoading(false);
          return;
        }
        await register(email.trim(), password, displayName.trim());
        onSuccess();
      } else {
        if (!email.trim()) {
          setError(fr.prepare.forgotPasswordNeedEmail);
          setLoading(false);
          return;
        }
        const response = await api.forgotPassword({ email: email.trim() });
        setInfo(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
          {tab === "login"
            ? "Connexion"
            : tab === "register"
              ? "Créer un compte"
              : "Mot de passe oublié"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {tab === "forgot"
            ? "On t'envoie un lien de réinitialisation par e-mail."
            : "Accède à tes templates et questions personnalisées."}
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(["login", "register", "forgot"] as AuthTab[]).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            onClick={() => {
              setTab(nextTab);
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === nextTab
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {nextTab === "login"
              ? "Connexion"
              : nextTab === "register"
                ? "Inscription"
                : "Récupération"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {tab === "register" && (
          <input
            value={displayName}
            onChange={(next) => setDisplayName(next.target.value)}
            placeholder={fr.prepare.hostPlaceholder}
            className={inputCls}
            autoFocus
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(next) => setEmail(next.target.value)}
          placeholder={fr.prepare.emailPlaceholder}
          required
          className={inputCls}
          autoFocus={tab !== "register"}
        />
        {tab !== "forgot" && (
          <input
            type="password"
            value={password}
            onChange={(next) => setPassword(next.target.value)}
            placeholder="Mot de passe"
            required
            className={inputCls}
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
        >
          {loading
            ? "…"
            : tab === "login"
              ? fr.prepare.signIn
              : tab === "register"
                ? fr.prepare.createAccount
                : "Envoyer"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="mt-5 w-full text-center text-xs text-slate-600 transition hover:text-slate-400"
      >
        ← Retour au portail
      </button>
    </div>
  );
};
