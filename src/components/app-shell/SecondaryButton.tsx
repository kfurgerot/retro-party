import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA_NEON_SECONDARY } from "@/lib/uiTokens";

export const SecondaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      variant="secondary"
      className={cn("min-h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-40", CTA_NEON_SECONDARY, className)}
      {...props}
    >
      {children}
    </Button>
  )
);

SecondaryButton.displayName = "SecondaryButton";

