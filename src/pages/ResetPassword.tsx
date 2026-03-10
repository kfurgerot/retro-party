import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { api } from "@/net/api";

const neutralSecondaryBtn =
  "border-cyan-300/50 bg-cyan-500/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)] hover:bg-cyan-500/25 hover:text-cyan-50";
const activeCyanBtn =
  "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400";
const fieldClass =
  "border-cyan-300/20 bg-slate-900/45 text-cyan-100 placeholder:text-cyan-200/55 hover:bg-slate-900/65 focus-visible:ring-cyan-300/45";

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
      setError("Token manquant ou invalide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.resetPassword({ token, password });
      setSuccess(response.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-xl border-cyan-300/40 bg-slate-900/55 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_24px_rgba(34,211,238,0.12)] backdrop-blur">
        <CardHeader className="space-y-2">
          <p className="text-center text-[10px] uppercase tracking-[0.22em] text-cyan-200/75">Retro Party</p>
          <CardTitle className="text-center text-base font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
            Reinitialiser le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Lien invalide: token manquant.
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          {success && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </p>
          )}

          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <Label htmlFor="new-password" className="text-cyan-100">
                Nouveau mot de passe
              </Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || !token}
                className={fieldClass}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="confirm-password" className="text-cyan-100">
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !token}
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" variant="secondary" className={activeCyanBtn} disabled={loading || !token}>
                {loading ? "Envoi..." : "Valider"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={neutralSecondaryBtn}
                onClick={() => navigate("/prepare")}
              >
                Retour connexion
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
