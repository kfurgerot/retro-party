import * as React from "react";
import { Input as BaseInput, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_SHELL_INPUT } from "@/lib/uiTokens";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <BaseInput ref={ref} className={cn(APP_SHELL_INPUT, className)} {...props} />
));

Input.displayName = "Input";

