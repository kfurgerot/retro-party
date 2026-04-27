import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Copy, Crown, ExternalLink, LogOut, X } from "lucide-react";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import type { SuiteModuleId } from "@/net/api";

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
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const moduleId = detectModule(location.pathname, search);
  const code = (search.get("code") || "").toUpperCase();

  useEffect(() => {
    setOpen(false);
    setDismissed(false);
    setCopied(false);
  }, [location.pathname, location.search]);

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

  if (!moduleId || !code || dismissed) return null;
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
                Cockpit animateur
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
              <Link
                to="/app"
                className="ds-focus-ring flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[12.5px] font-medium text-[var(--ds-text-faint)] transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <LogOut size={12} />
                Quitter la session
              </Link>
            </div>
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
          aria-label={`Cockpit animateur — code ${code}`}
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
