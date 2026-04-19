import React from "react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface LobbyCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}

export const LobbyCard: React.FC<LobbyCardProps> = ({ title, subtitle, className, children }) => {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100/85">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-300">{subtitle}</p> : null}
      </div>
      {children}
    </Card>
  );
};
