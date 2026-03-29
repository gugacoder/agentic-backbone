import type { DisplaySteps } from "@agentic-backbone/ai-sdk";
import { CheckCircle, Circle, Clock } from "lucide-react";

const STATUS_CONFIG = {
  completed: {
    Icon: CheckCircle,
    itemClass: "ai-chat-display-steps-item--completed",
    iconClass: "ai-chat-display-steps-icon--completed",
  },
  current: {
    Icon: Clock,
    itemClass: "ai-chat-display-steps-item--current",
    iconClass: "ai-chat-display-steps-icon--current",
  },
  pending: {
    Icon: Circle,
    itemClass: "ai-chat-display-steps-item--pending",
    iconClass: "ai-chat-display-steps-icon--pending",
  },
} as const;

export function StepTimelineRenderer({ title, steps, orientation }: DisplaySteps) {
  return (
    <div className={`ai-chat-display ai-chat-display-steps ai-chat-display-steps--${orientation}`}>
      {title && <p className="ai-chat-display-steps-title">{title}</p>}
      <ol className="ai-chat-display-steps-list">
        {steps.map((step, index) => {
          const { Icon, itemClass, iconClass } = STATUS_CONFIG[step.status];
          return (
            <li key={index} className={`ai-chat-display-steps-item ${itemClass}`}>
              <span className={`ai-chat-display-steps-icon ${iconClass}`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="ai-chat-display-steps-content">
                <p className="ai-chat-display-steps-step-title">{step.title}</p>
                {step.description && (
                  <p className="ai-chat-display-steps-description">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
