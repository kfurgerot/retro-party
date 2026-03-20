import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CTA_NEON_PRIMARY } from "@/lib/uiTokens";

export const PrimaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      className={cn("min-h-11 rounded-xl px-5 text-sm font-semibold", CTA_NEON_PRIMARY, className)}
      {...props}
    >
      {children}
    </Button>
  )
);

PrimaryButton.displayName = "PrimaryButton";

