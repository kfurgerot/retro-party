import React from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA_SESSION_DANGER, SESSION_HUD_SURFACE } from "@/lib/uiTokens";
import { SessionFrame } from "./SessionFrame";

type SessionHeaderProps = {
  moduleLabel: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  roomCode?: string | null;
  roomCodeLabel?: string;
  onLeave?: () => void;
  leaveLabel?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

type SessionTemplateProps = SessionHeaderProps & {
  children: React.ReactNode;
  contentClassName?: string;
  frameClassName?: string;
  height?: "screen" | "min";
};

export const SessionRoomCodePill = ({
  roomCode,
  label = "Code",
  className,
}: {
  roomCode?: string | null;
  label?: string;
  className?: string;
}) => {
  if (!roomCode) return null;

  return (
    <div
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[#163832]/25 bg-[#edf5ef] px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-[#18211f]",
        className,
      )}
    >
      <span className="uppercase text-[#24443d]">{label}</span>
      <span className="truncate">{roomCode}</span>
    </div>
  );
};

export const SessionLeaveButton = ({
  onLeave,
  label = "Quitter",
  className,
}: {
  onLeave?: () => void;
  label?: string;
  className?: string;
}) => {
  if (!onLeave) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onLeave}
      className={cn("h-9 shrink-0 rounded-xl px-3 text-xs", CTA_SESSION_DANGER, className)}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
};

export const SessionHeader = ({
  moduleLabel,
  title,
  subtitle,
  statusLabel,
  roomCode,
  roomCodeLabel = "Code",
  onLeave,
  leaveLabel = "Quitter",
  actions,
  children,
  className,
}: SessionHeaderProps) => (
  <header className={cn(SESSION_HUD_SURFACE, "px-3 py-3 sm:px-4", className)}>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#24443d]">
            {moduleLabel}
          </span>
          {statusLabel ? (
            <span className="rounded-full border border-[#163832]/20 bg-white/72 px-2 py-0.5 text-[11px] font-semibold text-[#24443d]">
              {statusLabel}
            </span>
          ) : null}
        </div>
        <h1 className="mt-1 truncate text-lg font-black leading-tight text-[#18211f] sm:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs font-medium text-[#4d5b52] sm:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
        {actions}
        <SessionRoomCodePill roomCode={roomCode} label={roomCodeLabel} />
        <SessionLeaveButton onLeave={onLeave} label={leaveLabel} />
      </div>
    </div>
    {children ? <div className="mt-3">{children}</div> : null}
  </header>
);

export const SessionTemplate = ({
  children,
  contentClassName,
  frameClassName,
  height = "screen",
  ...headerProps
}: SessionTemplateProps) => (
  <SessionFrame
    height={height}
    className={frameClassName}
    contentClassName={cn(
      "mx-auto flex h-full w-full max-w-[1440px] flex-col gap-2 px-2 pb-2 pt-2 sm:gap-3 sm:px-4 sm:pb-3 sm:pt-3",
      contentClassName,
    )}
  >
    <SessionHeader {...headerProps} />
    {children}
  </SessionFrame>
);
