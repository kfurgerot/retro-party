import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

export type IdentityCardSize = "md" | "lg";

export type IdentityCardProps = {
  name: string;
  avatar: number;
  accentRgb: string;
  size?: IdentityCardSize;
  editable?: boolean;
  email?: string | null;
  /** "Invité" / "Compte connecté" — librement formaté */
  subtitle?: string;
  connected?: boolean;
  connectingLabel?: string;
  connectedLabel?: string;
  disconnectedLabel?: string;
  onNameChange?: (next: string) => void;
  onEditAvatar?: () => void;
  className?: string;
};

const NAME_MIN = 2;
const NAME_MAX = 24;

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

export function IdentityCard({
  name,
  avatar,
  accentRgb,
  size = "md",
  editable = true,
  email,
  subtitle,
  connected,
  connectingLabel = "Connexion…",
  connectedLabel = "Connecté",
  disconnectedLabel = "Hors ligne",
  onNameChange,
  onEditAvatar,
  className,
}: IdentityCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  const startEdit = () => {
    if (!editable || !onNameChange) return;
    setDraft(name);
    setEditing(true);
  };

  const commit = () => {
    const next = cleanName(draft);
    if (next.length >= NAME_MIN && onNameChange) onNameChange(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const avatarChar = AVATARS[avatar] ?? "?";
  const isLg = size === "lg";

  const statusTone =
    connected === undefined
      ? null
      : connected
        ? { color: "16,185,129", label: connectedLabel }
        : { color: "245,158,11", label: connectingLabel || disconnectedLabel };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] transition",
        isLg ? "p-6" : "p-4",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, rgba(${accentRgb},0.10), transparent 55%)`,
        }}
      />

      <div className={cn("relative flex items-center gap-4", isLg && "gap-5")}>
        <button
          type="button"
          onClick={onEditAvatar}
          disabled={!onEditAvatar}
          aria-label={onEditAvatar ? "Modifier l'avatar" : "Avatar"}
          className={cn(
            "group relative flex shrink-0 items-center justify-center rounded-2xl border text-[28px] transition",
            isLg ? "h-20 w-20 text-[40px]" : "h-14 w-14 text-[28px]",
            onEditAvatar && "cursor-pointer hover:scale-[1.03]",
          )}
          style={{
            borderColor: `rgba(${accentRgb},0.35)`,
            background: `linear-gradient(135deg, rgba(${accentRgb},0.18), rgba(${accentRgb},0.04))`,
            boxShadow: `0 0 0 1px rgba(${accentRgb},0.12), 0 8px 24px rgba(${accentRgb},0.18)`,
          }}
        >
          <span aria-hidden>{avatarChar}</span>
          {onEditAvatar ? (
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ds-border-strong)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-secondary)] opacity-0 transition group-hover:opacity-100">
              <Pencil size={11} />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                maxLength={NAME_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
                className="ds-focus-ring h-9 w-full min-w-0 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[14px] text-[var(--ds-text-primary)] outline-none placeholder:text-[var(--ds-text-faint)]"
                placeholder="Comment veux-tu apparaître ?"
              />
              <button
                type="button"
                onClick={commit}
                aria-label="Valider"
                className="ds-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)]"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={cancel}
                aria-label="Annuler"
                className="ds-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-faint)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-secondary)]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "truncate font-semibold tracking-tight text-[var(--ds-text-primary)]",
                  isLg ? "text-[20px]" : "text-[15px]",
                )}
              >
                {name || <span className="text-[var(--ds-text-faint)]">Sans nom</span>}
              </div>
              {editable && onNameChange ? (
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label="Modifier le nom"
                  className="ds-focus-ring flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--ds-text-faint)] transition hover:border-[var(--ds-border)] hover:bg-[var(--ds-surface-0)] hover:text-[var(--ds-text-secondary)]"
                >
                  <Pencil size={11} />
                </button>
              ) : null}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
            {subtitle ? (
              <span className="truncate text-[var(--ds-text-faint)]">{subtitle}</span>
            ) : null}
            {email ? <span className="truncate text-[var(--ds-text-faint)]">{email}</span> : null}
            {statusTone ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-semibold"
                style={{
                  color: `rgb(${statusTone.color})`,
                  background: `rgba(${statusTone.color},0.12)`,
                  borderColor: `rgba(${statusTone.color},0.3)`,
                }}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", connected && "animate-pulse")}
                  style={{ background: `rgb(${statusTone.color})` }}
                />
                {statusTone.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
