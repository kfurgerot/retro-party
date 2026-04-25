import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA_NEON_SECONDARY, CTA_SAAS_SECONDARY } from "@/lib/uiTokens";

type SecondaryButtonProps = ButtonProps & {
  tone?: "game" | "saas";
};

export const SecondaryButton = React.forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  ({ className, children, tone = "saas", ...props }, ref) => (
    <Button
      ref={ref}
      variant="secondary"
      className={cn(
        "min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40",
        tone === "saas" ? CTA_SAAS_SECONDARY : CTA_NEON_SECONDARY,
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
);

SecondaryButton.displayName = "SecondaryButton";
