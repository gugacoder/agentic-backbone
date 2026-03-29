import type { DisplayChoices } from "@agentic-backbone/ai-sdk";
import { useState } from "react";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { cn } from "../lib/utils.js";

type ChoiceButtonsProps = DisplayChoices & {
  onChoiceSelect?: (value: string) => void;
};

export function ChoiceButtonsRenderer({
  question,
  choices,
  layout,
  onChoiceSelect,
}: ChoiceButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(id: string) {
    setSelected(id);
    onChoiceSelect?.(id);
  }

  return (
    <div className="space-y-3">
      {question && <p className="text-sm font-medium text-foreground">{question}</p>}

      <div
        className={cn(
          layout === "buttons" && "flex flex-wrap gap-2",
          layout === "cards" && "grid grid-cols-1 sm:grid-cols-2 gap-2",
          layout === "list" && "flex flex-col gap-1"
        )}
        role="group"
        aria-label={question ?? "Escolha uma opção"}
      >
        {choices.map((choice) => {
          const isSelected = selected === choice.id;

          if (layout === "buttons") {
            return (
              <Button
                key={choice.id}
                variant="outline"
                size="sm"
                onClick={() => handleSelect(choice.id)}
                aria-pressed={isSelected}
                className={cn(isSelected && "ring-2 ring-ring")}
              >
                {choice.icon && (
                  <span aria-hidden="true">{choice.icon}</span>
                )}
                {choice.label}
              </Button>
            );
          }

          if (layout === "cards") {
            return (
              <Card
                key={choice.id}
                className={cn(
                  "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                  isSelected && "ring-2 ring-ring"
                )}
                onClick={() => handleSelect(choice.id)}
                role="button"
                aria-pressed={isSelected}
              >
                {choice.icon && (
                  <span className="text-base" aria-hidden="true">{choice.icon}</span>
                )}
                <span className="block font-medium text-sm text-foreground">{choice.label}</span>
                {choice.description && (
                  <span className="block text-xs text-muted-foreground mt-1">{choice.description}</span>
                )}
              </Card>
            );
          }

          // list
          return (
            <button
              key={choice.id}
              className={cn(
                "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                isSelected && "bg-muted ring-1 ring-ring"
              )}
              onClick={() => handleSelect(choice.id)}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full border-2 border-input flex-shrink-0",
                  isSelected && "border-primary bg-primary"
                )}
                aria-hidden="true"
              />
              <span className="flex items-center gap-2 flex-1 min-w-0">
                {choice.icon && (
                  <span aria-hidden="true">{choice.icon}</span>
                )}
                <span className="font-medium text-foreground">{choice.label}</span>
                {choice.description && (
                  <span className="text-xs text-muted-foreground ml-auto">{choice.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
