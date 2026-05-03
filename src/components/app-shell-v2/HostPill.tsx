import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  LogOut,
  Square,
  X,
} from "lucide-react";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { api, type SuiteModuleId } from "@/net/api";
import { getHostSession, subscribeHostSession, type HostSession } from "@/lib/hostSession";

const PATH_TO_MODULE: Array<{
  pattern: RegExp;
  moduleId: SuiteModuleId;
  experience?: SuiteModuleId;
}> = [
  { pattern: /^\/skills-matrix(\/|$)/, moduleId: "skills-matrix" },
  { pattern: /^\/radar-party(\/|$)/, moduleId: "radar-party" },
  { pattern: /^\/play(\/|$)/, moduleId: "retro-party" },
];

function detectModule(pathname: string, search: URLSearchParams): SuiteModuleId | null {
  for (const { pattern, moduleId } of PATH_TO_MODULE) {
    if (pattern.test(pathname)) {
      if (moduleId === "retro-party" && search.get("experience") === "planning-poker") {
        return "planning-poker";
      }
      return moduleId;
    }
  }
  return null;
}

export function HostPill() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pushed, setPushed] = useState<HostSession | null>(() => getHostSession());
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => subscribeHostSession(setPushed), []);

  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const onLiveRoute = detectModule(location.pathname, search) !== null;
  const urlCode = (search.get("code") || "").toUpperCase();
  const urlModule = detectModule(location.pathname, search);

  const moduleId = onLiveRoute ? (urlModule ?? pushed?.moduleId ?? null) : null;
  const code = onLiveRoute ? urlCode || pushed?.code || "" : "";
  const isRuntimeRoom = moduleId === "retro-party" || moduleId === "planning-poker";
  const isCurrentParticipant = Boolean(
    pushed && moduleId && pushed.code === code && pushed.moduleId === moduleId,
  );
  const canEndSession = Boolean(isCurrentParticipant && pushed?.isHost);

  useEffect(() => {
    setOpen(false);
    setDismissed(false);
    setCopied(false);
    setConfirmEnd(false);
    setLeaving(false);
    setLeaveError(null);
    setEndError(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) {
      setConfirmEnd(false);
      setLeaveError(null);
      setEndError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Heartbeat: ping every 60s while a session is active. Auto-stop on unmount
  // or session change.
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const ping = () => {
      api.sessionHeartbeat(code).catch(() => {});
    };
    ping();
    const id = window.setInterval(() => {
      if (alive) ping();
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [code]);

  if (!moduleId || !code || dismissed || !isCurrentParticipant) return null;
  const exp = EXPERIENCE_BY_ID[moduleId];

  const shareUrl = `${window.location.origin}/r/${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignored
    }
  };

  const handleLeaveSession = async () => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);

    try {
      if (pushed?.leaveSession) {
        await pushed.leaveSession();
      }
      if (!mountedRef.current) return;
      setOpen(false);
      setLeaving(false);
      navigate("/app");
    } catch (err) {
      if (!mountedRef.current) return;
      setLeaveError(err instanceof Error ? err.message : "Erreur");
      setLeaving(false);
    }
  };

  const handleEndSession = async () => {
    if (!code || !canEndSession || !pushed) return;
    if (ending) return; // double-click guard
    setEnding(true);
    setEndError(null);

    // Watchdog : si la promesse n'aboutit pas en 8s, on rend la main au
    // user (bouton réactivable + erreur visible) plutôt que de rester
    // bloqué sur "...".
    const TIMEOUT_MS = 8000;
    let watchdogFired = false;
    const watchdog = window.setTimeout(() => {
      watchdogFired = true;
      if (!mountedRef.current) return;
      setEnding(false);
      setEndError("La requête a pris trop de temps. Réessaie ou recharge la page.");
    }, TIMEOUT_MS);

    try {
      if (pushed.endSession) {
        await pushed.endSession();
      } else if (moduleId === "radar-party" && pushed.participantId) {
        await api.radarEndSession(code, { participantId: pushed.participantId });
      } else if (moduleId === "skills-matrix" && pushed.participantId) {
        await api.skillsMatrixEndSession(code, pushed.participantId);
      } else {
        await api.endSession(code, isRuntimeRoom ? pushed.participantSessionId : null);
      }
      window.clearTimeout(watchdog);
      if (watchdogFired || !mountedRef.current) return;
      setOpen(false);
      // Reset l'état avant de naviguer pour éviter de garder "..." si on
      // revient en arrière dans l'historique.
      setEnding(false);
      navigate(`/r/${code}`, { replace: true });
    } catch (err) {
      window.clearTimeout(watchdog);
      if (watchdogFired || !mountedRef.current) return;
      setEndError(err instanceof Error ? err.message : "Erreur");
      setEnding(false);
    }
  };

  return (
    <div
      ref={ref}
      className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {open ? (
        <div
          className="ds-fade-in w-[280px] overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] shadow-[var(--ds-shadow-lg)]"
          style={{ background: "rgba(14,14,26,0.96)" }}
        >
          <div
            className="flex items-center gap-2.5 border-b border-[var(--ds-border)] px-4 py-3"
            style={{
              background: `linear-gradient(135deg, rgba(${exp.accentRgb},0.18), rgba(${exp.accentRgb},0.04))`,
            }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md border text-[14px]"
              style={{
                background: `rgba(${exp.accentRgb},0.18)`,
                borderColor: `rgba(${exp.accentRgb},0.4)`,
              }}
            >
              {exp.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ds-text-faint)]">
                <Crown size={10} style={{ color: exp.accent }} />
                {canEndSession ? "Cockpit animateur" : "Cockpit session"}
              </div>
              <div className="truncate text-[12.5px] font-medium text-[var(--ds-text-primary)]">
                {exp.label}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ds-focus-ring flex h-7 w-7 items-center justify-center rounded-md text-[var(--ds-text-faint)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
              aria-label="Fermer"
            >
              <X size={13} />
            </button>
          </div>

          <div className="p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
              Code de session
            </p>
            <div
              className="mt-1 select-all text-center font-mono text-[34px] font-semibold tracking-[0.3em]"
              style={{ color: exp.accent }}
            >
              {code}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleCopy}
                className="ds-focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    Lien copié
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copier le lien partageable
                  </>
                )}
              </button>
              <a
                href={`/r/${code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ds-focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
              >
                <ExternalLink size={12} />
                Aperçu page partagée
              </a>
              <button
                type="button"
                onClick={handleLeaveSession}
                disabled={leaving}
                className="ds-focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[12.5px] font-medium text-[var(--ds-text-faint)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)] disabled:opacity-50"
              >
                <LogOut size={12} />
                {leaving ? "Sortie..." : "Quitter (la session reste active)"}
              </button>
              {leaveError ? <p className="text-[11.5px] text-rose-300">{leaveError}</p> : null}
            </div>

            {canEndSession && confirmEnd ? (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                <div className="flex items-start gap-2 text-[12px] text-rose-100">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Terminer définitivement ?</p>
                    <p className="mt-0.5 text-[11.5px] text-rose-200/80">
                      Plus aucun participant ne pourra rejoindre. État figé.
                    </p>
                  </div>
                </div>
                {endError ? <p className="mt-2 text-[11.5px] text-rose-300">{endError}</p> : null}
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmEnd(false)}
                    disabled={ending}
                    className="ds-focus-ring h-8 flex-1 rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[12px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)] disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleEndSession}
                    disabled={ending}
                    className="ds-focus-ring h-8 flex-1 rounded-md bg-rose-500 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition hover:bg-rose-400 disabled:opacity-50"
                  >
                    {ending ? "Terminaison…" : "Terminer"}
                  </button>
                </div>
              </div>
            ) : canEndSession ? (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                className="ds-focus-ring mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-[12.5px] font-semibold text-rose-200 transition hover:bg-rose-500/15 hover:text-rose-100"
              >
                <Square size={11} />
                Terminer la session
              </button>
            ) : null}
          </div>

          <div className="border-t border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-4 py-2 text-center text-[10.5px] text-[var(--ds-text-faint)]">
            Cliquez en dehors ou ↑Esc pour fermer
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ds-focus-ring group flex h-11 items-center gap-2 rounded-full border bg-[var(--ds-bg-elevated)] pl-2 pr-3 text-[12.5px] font-medium shadow-[var(--ds-shadow-md)] transition hover:scale-[1.02]"
          style={{
            borderColor: `rgba(${exp.accentRgb},0.45)`,
            background: `linear-gradient(135deg, rgba(${exp.accentRgb},0.18), rgba(14,14,26,0.96))`,
          }}
          aria-label={`Cockpit session — code ${code}`}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[13px]"
            style={{ background: `rgba(${exp.accentRgb},0.25)` }}
          >
            <Crown size={12} style={{ color: exp.accent }} />
          </span>
          <span className="font-mono text-[14px] font-semibold tracking-[0.18em] text-[var(--ds-text-primary)]">
            {code}
          </span>
        </button>
      )}
    </div>
  );
}
