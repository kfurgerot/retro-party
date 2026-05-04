import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LogIn, Sparkles } from "lucide-react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/useAuth";
import { IdentityCard } from "./IdentityCard";
import { AvatarCarousel } from "./AvatarCarousel";
import { PreGameShell, PreGameStickyFooter } from "./PreGameShell";
import { SessionPreviewCard, type SessionStatus } from "./SessionPreviewCard";

export type IdentityStepSessionPreview = {
  code?: string | null;
  title?: string | null;
  status?: SessionStatus;
  participantCount?: number | null;
};

export type IdentityStepProps = {
  connected: boolean;

  /** Identité du module (icône + libellé) */
  moduleLabel: string;
  moduleIcon: string;
  accentRgb: string;

  /** Override visuel (au-dessus du titre principal) */
  brandLabel?: string;

  /** Pré-remplissage */
  initialName?: string;
  initialAvatar?: number;

  /** Aperçu d'une session en cours de rejoindre (mode join). Null en host. */
  sessionPreview?: IdentityStepSessionPreview | null;

  /** Étape n / total dans le wizard global */
  overallStepStart?: number;
  overallStepTotal?: number;

  /** Texte du CTA primaire. Défaut: "Entrer dans la session". */
  primaryLabel?: string;

  onSubmit: (payload: { name: string; avatar: number }) => void;
  onBack: () => void;
};

const NAME_MIN = 2;
const NAME_MAX = 24;
const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

export function IdentityStep({
  connected,
  moduleLabel,
  moduleIcon,
  accentRgb,
  brandLabel,
  initialName,
  initialAvatar,
  sessionPreview,
  overallStepStart,
  overallStepTotal,
  primaryLabel,
  onSubmit,
  onBack,
}: IdentityStepProps) {
  const { user } = useAuth();

  const [name, setName] = useState(() => cleanName(initialName ?? user?.displayName ?? ""));
  const [avatar, setAvatar] = useState(() => {
    const n = Number.isFinite(initialAvatar) ? Number(initialAvatar) : 0;
    return Math.max(0, Math.min(AVATARS.length - 1, n));
  });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const hasInitialName = useMemo(
    () => cleanName(initialName ?? user?.displayName ?? "").length >= NAME_MIN,
    [initialName, user?.displayName],
  );

  useEffect(() => {
    if (!hasInitialName) nameInputRef.current?.focus();
  }, [hasInitialName]);

  const validName = name.length >= NAME_MIN;
  const canSubmit = connected && validName;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ name: cleanName(name), avatar });
  };

  const showStepBadge =
    typeof overallStepStart === "number" && typeof overallStepTotal === "number";

  const isAuthenticated = !!user;
  const heading = isAuthenticated && hasInitialName ? "Ton entrée en scène" : "Ton identité";
  const subhead =
    isAuthenticated && hasInitialName
      ? "On a repris ton profil. Ajuste ton avatar si tu veux changer d'humeur."
      : "Choisis comment ton équipe te verra dans cette session.";

  const ctaLabel = primaryLabel ?? "Entrer dans la session";

  return (
    <PreGameShell accentRgb={accentRgb}>
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="ds-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text-primary)]"
        >
          <ArrowLeft size={14} />
          Retour
        </button>
        {showStepBadge ? (
          <span className="inline-flex items-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-2.5 py-1 text-[11px] font-medium text-[var(--ds-text-muted)]">
            Étape {overallStepStart} / {overallStepTotal}
          </span>
        ) : null}
      </div>

      {/* Heading */}
      {brandLabel ? (
        <p
          className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: `rgb(${accentRgb})` }}
        >
          {brandLabel}
        </p>
      ) : null}
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--ds-text-primary)] sm:text-[30px]">
        {heading}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--ds-text-muted)]">{subhead}</p>

      {/* Body */}
      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: identity setup */}
        <div className="min-w-0 space-y-4">
          {/* Live preview */}
          <IdentityCard
            name={name || "Sans nom"}
            avatar={avatar}
            accentRgb={accentRgb}
            size="lg"
            editable={false}
            connected={connected}
            connectingLabel="Connexion…"
            connectedLabel="Connecté"
            subtitle={isAuthenticated ? "Compte connecté" : "Invité"}
            email={isAuthenticated ? (user?.email ?? null) : null}
          />

          {/* Name field */}
          <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
            <label
              htmlFor="ds-identity-name"
              className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]"
            >
              Comment t'appelle-t-on ?
            </label>
            <input
              ref={nameInputRef}
              id="ds-identity-name"
              value={name}
              maxLength={NAME_MAX}
              placeholder="Prénom ou pseudo"
              autoComplete="off"
              onChange={(e) => setName(cleanName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) submit();
              }}
              className="ds-focus-ring h-11 w-full rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 text-[14px] text-[var(--ds-text-primary)] outline-none placeholder:text-[var(--ds-text-faint)] transition focus:border-[var(--ds-border-strong)] focus:bg-[var(--ds-surface-2)]"
            />
            {!validName && name.length > 0 ? (
              <p className="mt-2 text-[12px] text-amber-300">
                Au moins {NAME_MIN} caractères pour que ton équipe te reconnaisse.
              </p>
            ) : null}
          </div>

          {/* Avatar picker */}
          <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
            <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
              Avatar
            </p>
            <AvatarCarousel
              value={avatar}
              onChange={setAvatar}
              accentRgb={accentRgb}
              layout="carousel"
            />
          </div>
        </div>

        {/* Right: session preview */}
        <div className="min-w-0 space-y-4">
          <SessionPreviewCard
            moduleLabel={moduleLabel}
            moduleIcon={moduleIcon}
            accentRgb={accentRgb}
            title={sessionPreview?.title}
            code={sessionPreview?.code}
            status={sessionPreview?.status ?? "lobby"}
            participantCount={sessionPreview?.participantCount ?? null}
          />

          {sessionPreview?.code ? (
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4 text-[12.5px] text-[var(--ds-text-muted)]">
              <Sparkles size={12} className="mb-1 inline-block" /> Tu rejoins une session existante.
              Une fois ton identité confirmée, tu seras envoyé directement dans le lobby.
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4 text-[12.5px] text-[var(--ds-text-muted)]">
              Tu vas créer une nouvelle session. Tu pourras inviter ton équipe une fois dans le
              lobby.
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <PreGameStickyFooter>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="ds-focus-ring h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-5 text-[13px] font-semibold text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            className={cn(
              "ds-focus-ring inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[13.5px] font-bold text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "sm:flex-none sm:min-w-[200px]",
            )}
            style={{
              background: `linear-gradient(135deg, rgb(${accentRgb}), rgba(${accentRgb},0.78))`,
              boxShadow: canSubmit ? `0 8px 24px rgba(${accentRgb},0.35)` : "none",
            }}
          >
            <LogIn size={14} />
            {ctaLabel}
            <ArrowRight size={14} />
          </button>
        </div>
      </PreGameStickyFooter>
    </PreGameShell>
  );
}
