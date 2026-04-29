import { useState, type ReactNode } from "react";
import { ArrowLeft, LogOut, Play, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SessionPreviewCard } from "./SessionPreviewCard";
import { PresenceGrid, type PresenceParticipant } from "./PresenceGrid";
import { InviteStrip } from "./InviteStrip";
import { PreGameShell, PreGameStickyFooter } from "./PreGameShell";

export type SessionLobbyProps = {
  /** Code de la session (REQUIRED — ce composant ne couvre que l'in-room) */
  roomCode: string;
  connected: boolean;

  /** Identité du module */
  moduleLabel: string;
  moduleIcon: string;
  accentRgb: string;
  brandLabel?: string;

  /** Titre saisi par l'host (fallback "Session XYZ") */
  sessionTitle?: string | null;

  /** Participants présents (pré-mappés par le parent depuis lobbyPlayers) */
  participants: PresenceParticipant[];

  /** Le joueur courant est-il host ? */
  isHost: boolean;

  /** Slot host pour paramètres avancés (rounds, deck, axes radar…) */
  hostSetupPanel?: ReactNode;

  /** Titre affiché au-dessus de hostSetupPanel (par défaut "Paramètres de session") */
  hostSetupTitle?: string;

  /** Slot toujours rendu (host ou non) — ex: choix rôle joueur/spectateur en Planning Poker */
  playerSetupPanel?: ReactNode;
  playerSetupTitle?: string;

  /** Le host peut-il lancer la session ? (false → CTA disabled) */
  canStart: boolean;

  /** URL complète à partager (ex: agile.app/play?code=XYZ) */
  shareUrl?: string;
  /** Message Slack/Teams pré-formaté */
  shareMessage?: string;

  /** Texte d'aide host (description courte de l'action principale) */
  hostHint?: string;

  /** Texte affiché aux non-host pendant qu'on attend */
  waitingHostName?: string;

  onLeave: () => void;
  onStart: () => void;
};

export function SessionLobby({
  roomCode,
  connected,
  moduleLabel,
  moduleIcon,
  accentRgb,
  brandLabel,
  sessionTitle,
  participants,
  isHost,
  hostSetupPanel,
  hostSetupTitle = "Paramètres de session",
  playerSetupPanel,
  playerSetupTitle = "Mes préférences",
  canStart,
  shareUrl,
  shareMessage,
  hostHint = "Quand tout le monde est là, lance la session.",
  waitingHostName,
  onLeave,
  onStart,
}: SessionLobbyProps) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleStart = () => {
    if (!isHost || !canStart || starting) return;
    setStarting(true);
    onStart();
  };

  const participantCount = participants.length;
  const aloneInLobby = participantCount <= 1;

  return (
    <PreGameShell accentRgb={accentRgb}>
      {/* Top nav */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          className="ds-focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text-primary)]"
        >
          <ArrowLeft size={14} />
          Quitter
        </button>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "animate-pulse bg-emerald-400" : "bg-amber-400",
            )}
          />
          {connected ? "Session active" : "Reconnexion…"}
        </span>
      </div>

      {/* Hero header */}
      {brandLabel ? (
        <p
          className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: `rgb(${accentRgb})` }}
        >
          {brandLabel}
        </p>
      ) : null}
      <h1 className="text-[26px] font-bold tracking-tight text-[var(--ds-text-primary)] sm:text-[30px]">
        {sessionTitle || "Lobby de session"}
      </h1>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-[var(--ds-text-muted)]">
        <Users size={13} />
        {participantCount} {participantCount > 1 ? "joueurs" : "joueur"}
        <span aria-hidden>·</span>
        {isHost
          ? canStart
            ? aloneInLobby
              ? "Invite ton équipe pour lancer"
              : "Prêt à lancer"
            : "Configuration en cours…"
          : `En attente de ${waitingHostName ?? "l'host"}`}
      </p>

      {/* Body */}
      <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: presence + host or waiting */}
        <div className="min-w-0 space-y-4">
          {/* Presence grid */}
          <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
                Participants
              </h2>
              <span className="text-[11.5px] text-[var(--ds-text-muted)]">
                {participantCount} en lobby
              </span>
            </div>

            {aloneInLobby ? (
              <EmptyLobbyState accentRgb={accentRgb} />
            ) : (
              <PresenceGrid
                participants={participants}
                accentRgb={accentRgb}
                minSlots={Math.max(participants.length + 1, 6)}
                size="md"
              />
            )}
          </section>

          {/* Player setup (always rendered when provided) */}
          {playerSetupPanel ? (
            <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
              <h2 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
                {playerSetupTitle}
              </h2>
              {playerSetupPanel}
            </section>
          ) : null}

          {/* Host setup or waiting state */}
          {isHost ? (
            <>
              {hostSetupPanel ? (
                <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
                  <h2 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
                    {hostSetupTitle}
                  </h2>
                  {hostSetupPanel}
                </section>
              ) : null}
              <p className="text-[12.5px] text-[var(--ds-text-faint)]">{hostHint}</p>
            </>
          ) : (
            <WaitingForHost accentRgb={accentRgb} hostName={waitingHostName} />
          )}
        </div>

        {/* Right: invite + meta */}
        <div className="min-w-0 space-y-4">
          <SessionPreviewCard
            moduleLabel={moduleLabel}
            moduleIcon={moduleIcon}
            accentRgb={accentRgb}
            title={sessionTitle ?? null}
            code={roomCode}
            status="lobby"
            participantCount={participantCount}
            size="sm"
          />

          <InviteStrip
            code={roomCode}
            accentRgb={accentRgb}
            shareUrl={shareUrl}
            shareMessage={shareMessage}
            hint="Partage le code à ton équipe pour qu'elle te rejoigne."
          />
        </div>
      </div>

      {/* Sticky footer */}
      <PreGameStickyFooter>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="ds-focus-ring inline-flex h-11 items-center gap-1.5 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-semibold text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            <LogOut size={14} />
            Quitter
          </button>

          {isHost ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || !connected || starting}
              className={cn(
                "ds-focus-ring inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[13.5px] font-bold text-white transition",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "sm:flex-none sm:min-w-[220px]",
              )}
              style={{
                background: `linear-gradient(135deg, rgb(${accentRgb}), rgba(${accentRgb},0.78))`,
                boxShadow: canStart && !starting ? `0 8px 24px rgba(${accentRgb},0.35)` : "none",
              }}
            >
              <Play size={14} />
              {starting ? "Lancement…" : "Lancer la session"}
            </button>
          ) : (
            <div className="ml-auto text-right text-[12px] text-[var(--ds-text-muted)]">
              {waitingHostName
                ? `${waitingHostName} va lancer la session…`
                : "L'host va lancer la session…"}
            </div>
          )}
        </div>
      </PreGameStickyFooter>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] p-6 text-[var(--ds-text-primary)] shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-[var(--ds-text-primary)]">
              {isHost ? "Annuler la session ?" : "Quitter la session ?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[var(--ds-text-muted)]">
              {isHost
                ? "Tous les participants seront déconnectés du lobby."
                : "Tu pourras y revenir plus tard avec le même code de session."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]">
              Rester
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl border border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200"
              onClick={() => {
                setLeaveOpen(false);
                onLeave();
              }}
            >
              {isHost ? "Annuler la session" : "Quitter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PreGameShell>
  );
}

/* ----- Internal: states ----- */

function EmptyLobbyState({ accentRgb }: { accentRgb: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--ds-border-strong)] bg-[var(--ds-surface-0)] px-4 py-10 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border text-[26px]"
        style={{
          borderColor: `rgba(${accentRgb},0.4)`,
          background: `rgba(${accentRgb},0.12)`,
        }}
      >
        <span aria-hidden>👋</span>
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
          Tu es seul·e dans le lobby
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--ds-text-muted)]">
          Partage le code à droite pour faire venir ton équipe.
        </p>
      </div>
    </div>
  );
}

function WaitingForHost({ accentRgb, hostName }: { accentRgb: string; hostName?: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(80% 100% at 0% 0%, rgba(${accentRgb},0.10), transparent 60%)`,
        }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[18px]"
          style={{
            borderColor: `rgba(${accentRgb},0.35)`,
            background: `rgba(${accentRgb},0.12)`,
          }}
        >
          <span aria-hidden>⏳</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[var(--ds-text-primary)]">
            En attente de {hostName ?? "l'host"}
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--ds-text-muted)]">
            La session démarrera dès que l'host lancera la partie. Tu peux laisser cette page
            ouverte.
          </p>
        </div>
      </div>
    </section>
  );
}
