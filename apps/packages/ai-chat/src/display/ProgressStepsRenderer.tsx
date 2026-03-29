import type { DisplayProgress } from "@agentic-backbone/ai-sdk";
import { Check, Circle, Clock } from "lucide-react";
import { Progress } from "../ui/progress.js";
import { Badge } from "../ui/badge.js";
import { cn } from "../lib/utils.js";

export function ProgressStepsRenderer({ title, steps }: DisplayProgress) {
  const completed = steps.filter((s) => s.status === "completed").length;
  const percentage = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {title && <p className="font-medium text-foreground">{title}</p>}
      <div className="flex items-center gap-3">
        <Progress value={percentage} className="flex-1" />
        <span className="text-sm text-muted-foreground tabular-nums">{percentage}%</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {completed} de {steps.length} concluídos
      </p>
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isCompleted = step.status === "completed";
          const isPending = step.status === "pending";
          return (
            <li key={index} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 shrink-0",
                  isCompleted ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check size={16} />
                ) : isPending ? (
                  <Circle size={16} />
                ) : (
                  <Clock size={16} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", isCompleted ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {index + 1}
              </Badge>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
