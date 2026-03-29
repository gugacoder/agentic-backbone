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
