import type { DisplayAlert } from "@agentic-backbone/ai-sdk";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";

const VARIANT_CONFIG = {
  info: {
    Icon: Info,
    containerClass: "ai-chat-display-alert--info",
  },
  warning: {
    Icon: AlertTriangle,
    containerClass: "ai-chat-display-alert--warning",
  },
  error: {
    Icon: AlertCircle,
    containerClass: "ai-chat-display-alert--error",
  },
  success: {
    Icon: CheckCircle,
    containerClass: "ai-chat-display-alert--success",
  },
} as const;

export function AlertRenderer({ variant, title, message }: DisplayAlert) {
  const { Icon, containerClass } = VARIANT_CONFIG[variant];

  return (
    <div className={`ai-chat-display ai-chat-display-alert ${containerClass}`} role="alert">
      <span className="ai-chat-display-alert-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="ai-chat-display-alert-content">
        {title && <p className="ai-chat-display-alert-title">{title}</p>}
        <p className="ai-chat-display-alert-message">{message}</p>
      </div>
    </div>
  );
}
