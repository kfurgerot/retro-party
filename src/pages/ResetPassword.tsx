import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/net/api";
import { fr } from "@/i18n/fr";
import { PageShell } from "@/components/app-shell";

const inputCls =
  "w-full h-11 rounded-xl border border-[#cfd9d1] bg-white/80 px-4 text-sm text-[#18211f] placeholder:text-[#8b9891] outline-none focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20 transition";

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
    <PageShell
      accentColor="rgba(99,102,241,0.08)"
      accentGlow="rgba(99,102,241,0.04)"
      maxWidth="sm"
      tone="saas"
    >
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#163832] text-sm text-white shadow-sm">
              ⚡
            </div>
            <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
              Agile Suite
            </span>
          </div>

          <h1 className="mb-1.5 text-center text-3xl font-black tracking-tight text-[#12201d]">
            {fr.resetPassword.title}
          </h1>
          <p className="mb-6 text-center text-sm leading-6 text-[#647067]">
            Choisis un nouveau mot de passe pour ton compte.
          </p>

          {!token && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {fr.resetPassword.invalidLink}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
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
              className="h-11 w-full rounded-xl bg-[#163832] text-sm font-black text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] disabled:opacity-40"
            >
              {loading ? fr.resetPassword.sending : fr.resetPassword.validate}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate("/prepare")}
            className="mt-5 w-full text-center text-xs font-bold text-[#66766f] transition hover:text-[#24443d]"
          >
            ← {fr.resetPassword.backLogin}
          </button>
        </div>
      </div>
    </PageShell>
  );
};

export default ResetPasswordPage;
