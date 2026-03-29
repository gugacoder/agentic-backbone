// @agentic-backbone/ai-chat
// Barrel exports — populated as features are implemented

export { useBackboneChat } from "./hooks/useBackboneChat.js";
export type { UseBackboneChatOptions, Message } from "./hooks/useBackboneChat.js";

export { ChatProvider, useChatContext } from "./hooks/ChatProvider.js";
export type { ChatProviderProps } from "./hooks/ChatProvider.js";

export { Markdown } from "./components/Markdown.js";
export { StreamingIndicator } from "./components/StreamingIndicator.js";

export { ReasoningBlock } from "./parts/ReasoningBlock.js";
export type { ReasoningBlockProps } from "./parts/ReasoningBlock.js";

export { ToolActivity, defaultToolIconMap } from "./parts/ToolActivity.js";
export type { ToolActivityProps, ToolActivityState } from "./parts/ToolActivity.js";

export { ToolResult } from "./parts/ToolResult.js";
export type { ToolResultProps } from "./parts/ToolResult.js";

// Display Renderers
export { AlertRenderer } from "./display/AlertRenderer.js";
export { MetricCardRenderer } from "./display/MetricCardRenderer.js";
export { PriceHighlightRenderer } from "./display/PriceHighlightRenderer.js";
export { FileCardRenderer } from "./display/FileCardRenderer.js";
export { CodeBlockRenderer } from "./display/CodeBlockRenderer.js";
export { SourcesListRenderer } from "./display/SourcesListRenderer.js";
export { StepTimelineRenderer } from "./display/StepTimelineRenderer.js";
export { ProgressStepsRenderer } from "./display/ProgressStepsRenderer.js";
