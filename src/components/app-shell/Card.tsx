import * as React from "react";
import { Card as BaseCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { APP_SHELL_SURFACE, SAAS_SURFACE } from "@/lib/uiTokens";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "game" | "saas";
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = "saas", ...props }, ref) => (
    <BaseCard
      ref={ref}
      className={cn(tone === "saas" ? SAAS_SURFACE : APP_SHELL_SURFACE, className)}
      {...props}
    />
  ),
);

Card.displayName = "Card";
