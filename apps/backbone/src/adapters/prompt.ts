import { resolveAdapters } from "../context/resolver.js";
import { resolveConnectorDir } from "../context/resolver.js";
import { dirname } from "node:path";

export function formatAdaptersPrompt(agentId: string): string {
  const adapters = resolveAdapters(agentId);
  if (adapters.size === 0) return "";

  let prompt = "<available_adapters>\n";
  for (const [slug, a] of adapters) {
    const dir = dirname(a.path);
    const name = (a.metadata.name as string) ?? slug;
    const connector = (a.metadata.connector as string) ?? "unknown";
    const policy = (a.metadata.policy as string) ?? "readonly";
    const desc = (a.metadata.description as string) ?? "";
    const connectorDir = resolveConnectorDir(connector);

    prompt += `- **${name}** (${connector}, ${policy}): ${desc}\n`;
    prompt += `  adapter_dir: ${dir}\n`;
    if (connectorDir) {
      prompt += `  connector_dir: ${connectorDir}\n`;
    }
  }
  prompt += "</available_adapters>\n";
  prompt +=
    "Adapters are connection configs. Use the connector's shell tools (e.g. query.sh, mutate.sh) passing the adapter_dir as first argument.\n\n";
  return prompt;
}
