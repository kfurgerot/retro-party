import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/net/api";
import { fr } from "@/i18n/fr";
import { PageShell } from "@/components/app-shell";

const inputCls =
  "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50 transition";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError(fr.resetPassword.missingToken);
      return;
    }
    if (password.length < 8) {
      setError(fr.resetPassword.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(fr.resetPassword.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await api.resetPassword({ token, password });
      setSuccess(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.resetPassword.unknownError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell accentColor="rgba(99,102,241,0.08)" accentGlow="rgba(99,102,241,0.04)" maxWidth="sm">
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
              ⚡
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
              Agile Suite
            </span>
          </div>

          <h1 className="mb-1.5 text-center text-2xl font-extrabold tracking-tight text-slate-50">
            {fr.resetPassword.title}
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500">
            Choisis un nouveau mot de passe pour ton compte.
          </p>

          {!token && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {fr.resetPassword.invalidLink}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {success}
            </div>
          )}

          <form className="space-y-3" onSubmit={onSubmit}>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={fr.resetPassword.newPassword}
              disabled={loading || !token}
              className={inputCls}
            />
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={fr.resetPassword.confirmPassword}
              disabled={loading || !token}
              className={inputCls}
            />

            <button
              type="submit"
              disabled={loading || !token}
              className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
              style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
            >
              {loading ? fr.resetPassword.sending : fr.resetPassword.validate}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate("/prepare")}
            className="mt-5 w-full text-center text-xs text-slate-600 transition hover:text-slate-400"
          >
            ← {fr.resetPassword.backLogin}
          </button>
        </div>
      </div>
    </PageShell>
  );
};

export default ResetPasswordPage;
