import * as React from "react";
import { Card as BaseCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { APP_SHELL_SURFACE } from "@/lib/uiTokens";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <BaseCard ref={ref} className={cn(APP_SHELL_SURFACE, className)} {...props} />
));

Card.displayName = "Card";
