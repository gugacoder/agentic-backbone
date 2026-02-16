import { loadAgentTools } from "./loader.js";

export function formatToolsPrompt(agentId: string): string {
  const tools = loadAgentTools(agentId);
  if (tools.length === 0) return "";

  let prompt = "<available_tools>\n";
  for (const t of tools) {
    prompt += `- **${t.metadata.name ?? t.slug}**: ${t.metadata.description ?? ""}\n`;
  }
  prompt += "</available_tools>\n";
  prompt +=
    "When you need to use a tool, read its TOOL.md from the context directory for instructions.\n\n";
  return prompt;
}
