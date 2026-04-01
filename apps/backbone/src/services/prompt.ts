import { loadAgentServices } from "./loader.js";

export function formatServicesPrompt(agentId: string): string {
  const services = loadAgentServices(agentId);
  if (services.length === 0) return "";

  let prompt = "<available_services>\n";
  for (const s of services) {
    const type = s.skipAgent ? "direct" : "llm";
    prompt += `- **${s.name}** (${type}): ${s.description}\n`;
  }
  prompt += "</available_services>\n";
  prompt +=
    "Services are capabilities this agent provides. Direct services execute without LLM; LLM services use the agent runtime.\n\n";
  return prompt;
}
