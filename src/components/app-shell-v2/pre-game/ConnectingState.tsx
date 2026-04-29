import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PreGameShell } from "./PreGameShell";

export type ConnectingStateProps = {
  accentRgb: string;
  /** "creating" = Création de la session, "joining" = Connexion à la session */
  mode: "creating" | "joining";
  /** Code de la session quand on rejoint (affiché en monospace) */
  code?: string | null;
  /** Message d'erreur si la connexion échoue */
  error?: string | null;
  onRetry?: () => void;
  onBack?: () => void;
};

export function ConnectingState({
  accentRgb,
  mode,
  code,
  error,
  onRetry,
  onBack,
}: ConnectingStateProps) {
  // Petit délai avant d'afficher le spinner pour éviter le flicker quand la
  // socket répond instantanément (cas LAN / dev).
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowSpinner(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  const title = error
    ? mode === "creating"
      ? "Impossible de créer la session"
      : "Impossible de rejoindre la session"
    : mode === "creating"
      ? "Création de la session…"
      : "Connexion à la session…";

  const subtitle = error
    ? error
    : mode === "creating"
      ? "On prépare ton lobby. Encore un instant."
      : code
        ? `On te connecte à la session ${code}.`
        : "Connexion en cours.";

  return (
    <PreGameShell accentRgb={accentRgb}>
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
          {!error ? (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border"
              style={{
                borderColor: `rgba(${accentRgb},0.4)`,
                background: `rgba(${accentRgb},0.12)`,
                boxShadow: `0 0 0 1px rgba(${accentRgb},0.2), 0 12px 32px rgba(${accentRgb},0.25)`,
              }}
            >
              {showSpinner ? (
                <Loader2
                  className="animate-spin"
                  style={{ color: `rgb(${accentRgb})` }}
                  size={28}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <span aria-hidden className="text-[28px]">
                ⚠
              </span>
            </div>
          )}

          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-[var(--ds-text-primary)]">
              {title}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[var(--ds-text-muted)]">{subtitle}</p>
          </div>

          {error ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ds-focus-ring h-10 rounded-lg px-4 text-[13px] font-semibold text-white transition"
                  style={{
                    background: `linear-gradient(135deg, rgb(${accentRgb}), rgba(${accentRgb},0.78))`,
                  }}
                >
                  Réessayer
                </button>
              ) : null}
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="ds-focus-ring h-10 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-semibold text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
                >
                  Retour
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </PreGameShell>
  );
}
