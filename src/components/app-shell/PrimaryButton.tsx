import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA_NEON_PRIMARY, CTA_SAAS_PRIMARY } from "@/lib/uiTokens";

type PrimaryButtonProps = ButtonProps & {
  tone?: "game" | "saas";
};

export const PrimaryButton = React.forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ className, children, tone = "saas", ...props }, ref) => (
    <Button
      ref={ref}
      className={cn(
        "min-h-11 rounded-xl px-5 text-sm font-semibold",
        tone === "saas" ? CTA_SAAS_PRIMARY : CTA_NEON_PRIMARY,
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
);

PrimaryButton.displayName = "PrimaryButton";
