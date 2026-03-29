import type { DisplaySteps } from "@agentic-backbone/ai-sdk";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";

const STATUS_CIRCLE: Record<"completed" | "current" | "pending", string> = {
  completed: "bg-primary text-primary-foreground",
  current: "bg-primary/20 border border-primary",
  pending: "bg-muted text-muted-foreground",
};

const STATUS_TITLE: Record<"completed" | "current" | "pending", string> = {
  completed: "text-foreground",
  current: "text-primary",
  pending: "text-muted-foreground",
};

export function StepTimelineRenderer({ title, steps, orientation }: DisplaySteps) {
  const isVertical = orientation !== "horizontal";

  return (
    <div className={cn("flex", isVertical ? "flex-col gap-0" : "flex-row items-start gap-0")}>
      {title && (
        <p className="text-sm font-medium text-foreground mb-3">{title}</p>
      )}
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const { status } = step;

        return (
          <div
            key={index}
            className={cn(
              "flex",
              isVertical ? "flex-row gap-3" : "flex-col items-center gap-2 flex-1"
            )}
          >
            {/* Circle + connector column */}
            <div className={cn("flex", isVertical ? "flex-col items-center" : "flex-row items-center")}>
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  STATUS_CIRCLE[status]
                )}
              >
                <Badge
                  variant="secondary"
                  className="w-5 h-5 flex items-center justify-center rounded-full p-0 text-[10px] font-semibold border-0 bg-transparent text-inherit"
                >
                  {index + 1}
                </Badge>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    isVertical ? "w-px h-6 bg-border" : "h-px w-full bg-border flex-1"
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-4 flex-1 min-w-0", isLast && "pb-0", !isVertical && "text-center")}>
              <p className={cn("text-sm font-medium leading-none", STATUS_TITLE[status])}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
