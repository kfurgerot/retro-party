import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { api } from "@/net/api";

type AuthTab = "login" | "register" | "forgot";

const inputCls =
  "w-full h-11 rounded-xl border border-[#cfd9d1] bg-white/80 px-4 text-sm text-[#18211f] placeholder:text-[#8b9891] outline-none focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20 transition";

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
        if (!acceptedTerms) {
          setError("Tu dois accepter les CGU pour créer un compte.");
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
        <h1 className="text-3xl font-black tracking-tight text-[#12201d]">
          {tab === "login"
            ? "Connexion"
            : tab === "register"
              ? "Créer un compte"
              : "Mot de passe oublié"}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-[#647067]">
          {tab === "forgot"
            ? "On t'envoie un lien de réinitialisation par e-mail."
            : "Accède à tes templates et questions personnalisées."}
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl border border-[#d8e2d9] bg-white/58 p-1 shadow-sm">
        {(["login", "register", "forgot"] as AuthTab[]).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            onClick={() => {
              setTab(nextTab);
              if (nextTab !== "register") setAcceptedTerms(false);
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === nextTab
                ? "bg-[#163832] text-white shadow-sm"
                : "text-[#66766f] hover:text-[#24443d]"
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
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
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
        {tab === "register" && (
          <label className="flex items-start gap-3 rounded-2xl border border-[#d8e2d9] bg-white/62 p-3 text-xs leading-5 text-[#647067]">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
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
              </Link>
              .
            </span>
          </label>
        )}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-[#163832] text-sm font-black text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] disabled:opacity-50"
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
        className="mt-5 w-full text-center text-xs font-bold text-[#66766f] transition hover:text-[#24443d]"
      >
        ← Retour au portail
      </button>
    </div>
  );
};
