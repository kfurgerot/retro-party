import React from "react";
import { cn } from "@/lib/utils";
import { SESSION_DIALOG_CONTENT } from "@/lib/uiTokens";

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
        "game-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center bg-[#f7f8f3]/86 px-4",
        className,
      )}
    >
      <div
        className={cn(
          `game-modal-card w-full max-w-2xl ${SESSION_DIALOG_CONTENT}`,
          contentClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <div className="text-center">
            <div className="text-xl font-bold">{title}</div>
            {subtitle ? <div className="mt-1 text-sm text-[#647067]">{subtitle}</div> : null}
          </div>
        ) : null}
        <div className={title ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
};
