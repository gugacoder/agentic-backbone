import type { DisplayChoices } from "@agentic-backbone/ai-sdk";
import { useState } from "react";

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
    <div className={`ai-chat-display ai-chat-display-choices ai-chat-display-choices--${layout}`}>
      {question && <p className="ai-chat-display-choices-question">{question}</p>}

      <div
        className="ai-chat-display-choices-options"
        role="group"
        aria-label={question ?? "Escolha uma opção"}
      >
        {choices.map((choice) => {
          const isSelected = selected === choice.id;

          if (layout === "buttons") {
            return (
              <button
                key={choice.id}
                className={`ai-chat-display-choices-btn${isSelected ? " ai-chat-display-choices-btn--selected" : ""}`}
                onClick={() => handleSelect(choice.id)}
                aria-pressed={isSelected}
              >
                {choice.icon && (
                  <span className="ai-chat-display-choices-btn-icon" aria-hidden="true">
                    {choice.icon}
                  </span>
                )}
                {choice.label}
              </button>
            );
          }

          if (layout === "cards") {
            return (
              <button
                key={choice.id}
                className={`ai-chat-display-choices-card${isSelected ? " ai-chat-display-choices-card--selected" : ""}`}
                onClick={() => handleSelect(choice.id)}
                aria-pressed={isSelected}
              >
                {choice.icon && (
                  <span className="ai-chat-display-choices-card-icon" aria-hidden="true">
                    {choice.icon}
                  </span>
                )}
                <span className="ai-chat-display-choices-card-label">{choice.label}</span>
                {choice.description && (
                  <span className="ai-chat-display-choices-card-desc">{choice.description}</span>
                )}
              </button>
            );
          }

          // list
          return (
            <button
              key={choice.id}
              className={`ai-chat-display-choices-list-item${isSelected ? " ai-chat-display-choices-list-item--selected" : ""}`}
              onClick={() => handleSelect(choice.id)}
              aria-pressed={isSelected}
            >
              <span className="ai-chat-display-choices-list-radio" aria-hidden="true" />
              <span className="ai-chat-display-choices-list-content">
                {choice.icon && (
                  <span className="ai-chat-display-choices-list-icon" aria-hidden="true">
                    {choice.icon}
                  </span>
                )}
                <span className="ai-chat-display-choices-list-label">{choice.label}</span>
                {choice.description && (
                  <span className="ai-chat-display-choices-list-desc">{choice.description}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
