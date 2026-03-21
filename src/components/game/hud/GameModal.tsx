import React from "react";
import { cn } from "@/lib/utils";
import { GAME_DIALOG_CONTENT } from "@/lib/uiTokens";

interface GameModalProps {
  title?: string;
  subtitle?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export const GameModal: React.FC<GameModalProps> = ({
  title,
  subtitle,
  className,
  contentClassName,
  children,
}) => {
  return (
    <div
      className={cn(
        "game-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 px-4",
        className
      )}
    >
      <div
        className={cn(
          `game-modal-card w-full max-w-2xl ${GAME_DIALOG_CONTENT}`,
          contentClassName
        )}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="text-center">
            <div className="text-xl font-bold">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-slate-300">{subtitle}</div> : null}
          </div>
        ) : null}
        <div className={title ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
};
