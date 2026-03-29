import type { DisplayAlert } from "@agentic-backbone/ai-sdk";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert.js";

const VARIANT_CONFIG = {
  info: { Icon: Info },
  warning: { Icon: AlertTriangle },
  error: { Icon: AlertCircle },
  success: { Icon: CheckCircle },
} as const;

export function AlertRenderer({ variant, title, message }: DisplayAlert) {
  const { Icon } = VARIANT_CONFIG[variant];

  return (
    <Alert variant={variant === "error" ? "destructive" : "default"}>
      <Icon className="h-4 w-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
