import { useState, type ReactNode } from "react";
import { Copy, Check, Link2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type InviteStripProps = {
  code: string;
  accentRgb: string;
  /** URL complète à partager (lien direct vers la session) */
  shareUrl?: string;
  /** Lien magique optionnel (reprise d'identité invité) */
  magicLink?: string;
  /** Message pré-formaté pour Slack/Teams */
  shareMessage?: string;
  /** Slot pour un QR code (rendu par le parent quand une lib est dispo) */
  qrSlot?: ReactNode;
  className?: string;
  hint?: string;
};

type CopyState = "idle" | "code" | "url" | "magic" | "message";

export function InviteStrip({
  code,
  accentRgb,
  shareUrl,
  magicLink,
  shareMessage,
  qrSlot,
  hint = "Partage le code ou le lien pour inviter ton équipe.",
  className,
}: InviteStripProps) {
  const [copied, setCopied] = useState<CopyState>("idle");

  const flash = (kind: Exclude<CopyState, "idle">) => {
    setCopied(kind);
    window.setTimeout(() => setCopied("idle"), 1600);
  };

  const copy = async (value: string, kind: Exclude<CopyState, "idle">) => {
    try {
      await navigator.clipboard.writeText(value);
      flash(kind);
    } catch {
      // ignored
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(80% 100% at 100% 0%, rgba(${accentRgb},0.10), transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--ds-text-faint)]">
            Code de session
          </p>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            aria-label="Copier le code"
            className="ds-focus-ring group mt-1 inline-flex items-center gap-3 rounded-xl px-1 py-0.5 text-left transition hover:bg-white/[0.03]"
          >
            <span
              className="font-mono text-[34px] font-bold tracking-[0.18em] text-[var(--ds-text-primary)]"
              style={{ textShadow: `0 0 24px rgba(${accentRgb},0.35)` }}
            >
              {code}
            </span>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-secondary)] transition group-hover:bg-[var(--ds-surface-2)] group-hover:text-[var(--ds-text-primary)]"
              aria-hidden
            >
              {copied === "code" ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </span>
          </button>
          <p className="mt-2 text-[12px] text-[var(--ds-text-faint)]">{hint}</p>
        </div>

        {qrSlot ? (
          <div className="shrink-0 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] p-2">
            {qrSlot}
          </div>
        ) : null}
      </div>

      {(shareUrl || magicLink || shareMessage) && (
        <div className="relative mt-4 grid gap-2 border-t border-[var(--ds-border-faint)] pt-4 sm:grid-cols-3">
          {shareUrl ? (
            <ShareButton
              icon={<Link2 size={12} />}
              label={copied === "url" ? "Lien copié" : "Copier le lien"}
              done={copied === "url"}
              onClick={() => copy(shareUrl, "url")}
            />
          ) : null}
          {shareMessage ? (
            <ShareButton
              icon={<MessageSquare size={12} />}
              label={copied === "message" ? "Message copié" : "Message Slack/Teams"}
              done={copied === "message"}
              onClick={() => copy(shareMessage, "message")}
            />
          ) : null}
          {magicLink ? (
            <ShareButton
              icon={<Link2 size={12} />}
              label={copied === "magic" ? "Lien copié" : "Lien de reprise"}
              done={copied === "magic"}
              onClick={() => copy(magicLink, "magic")}
              title="Permet à un invité de retrouver son identité depuis un autre appareil"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ShareButton({
  icon,
  label,
  done,
  onClick,
  title,
}: {
  icon: ReactNode;
  label: string;
  done: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "ds-focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[12px] font-medium transition",
        done
          ? "text-emerald-300"
          : "text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]",
      )}
    >
      {done ? <Check size={12} /> : icon}
      {label}
    </button>
  );
}
