import type { DisplayProgress } from "@agentic-backbone/ai-sdk";
import { CheckCircle, Circle, Clock } from "lucide-react";

const STATUS_CONFIG = {
  completed: {
    Icon: CheckCircle,
    stepClass: "ai-chat-display-progress-step--completed",
  },
  current: {
    Icon: Clock,
    stepClass: "ai-chat-display-progress-step--current",
  },
  pending: {
    Icon: Circle,
    stepClass: "ai-chat-display-progress-step--pending",
  },
} as const;

export function ProgressStepsRenderer({ title, steps }: DisplayProgress) {
  const completed = steps.filter((s) => s.status === "completed").length;
  const percentage = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="ai-chat-display ai-chat-display-progress">
      {title && <p className="ai-chat-display-progress-title">{title}</p>}
      <div className="ai-chat-display-progress-bar-row">
        <div className="ai-chat-display-progress-bar" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="ai-chat-display-progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="ai-chat-display-progress-percent">{percentage}%</span>
      </div>
      <p className="ai-chat-display-progress-summary">
        {completed} de {steps.length} concluídos
      </p>
      <ol className="ai-chat-display-progress-steps">
        {steps.map((step, index) => {
          const { Icon, stepClass } = STATUS_CONFIG[step.status];
          return (
            <li key={index} className={`ai-chat-display-progress-step ${stepClass}`}>
              <span className="ai-chat-display-progress-step-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <div className="ai-chat-display-progress-step-body">
                <p className="ai-chat-display-progress-step-label">{step.label}</p>
                {step.description && (
                  <p className="ai-chat-display-progress-step-desc">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
