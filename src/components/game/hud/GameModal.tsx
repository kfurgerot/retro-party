import React from "react";
import { cn } from "@/lib/utils";

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
    <div className={cn("fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 px-4", className)}>
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-5 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.18)]",
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

