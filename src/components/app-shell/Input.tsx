import * as React from "react";
import { Input as BaseInput, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_SHELL_INPUT, SAAS_INPUT } from "@/lib/uiTokens";

type ShellInputProps = InputProps & {
  tone?: "game" | "saas";
};

export const Input = React.forwardRef<HTMLInputElement, ShellInputProps>(
  ({ className, tone = "saas", ...props }, ref) => (
    <BaseInput
      ref={ref}
      className={cn(tone === "saas" ? SAAS_INPUT : APP_SHELL_INPUT, className)}
      {...props}
    />
  ),
);

Input.displayName = "Input";
