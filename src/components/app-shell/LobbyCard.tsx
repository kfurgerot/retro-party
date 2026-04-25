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
    <Card tone="saas" className={cn("p-4 sm:p-5", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#24443d]">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-[#647067]">{subtitle}</p> : null}
      </div>
      {children}
    </Card>
  );
};
