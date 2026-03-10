import { resolveAdapters } from "../context/resolver.js";

interface ConnectorToolInfo {
  format: (slug: string, policy: string) => string;
}

const CONNECTOR_TOOLS: Record<string, ConnectorToolInfo> = {
  mysql: {
    format: (slug, policy) => {
      let s = `mysql_query(database="${slug}", sql="...")`;
      if (policy === "readwrite") s += `, mysql_mutate(database="${slug}", sql="...")`;
      return s;
    },
  },
  postgres: {
    format: (slug, policy) => {
      let s = `postgres_query(database="${slug}", sql="...")`;
      if (policy === "readwrite") s += `, postgres_mutate(database="${slug}", sql="...")`;
      return s;
    },
  },
  evolution: {
    format: (slug) =>
      `evolution_api(instance="${slug}", method="GET|POST", endpoint="...", body="...")`,
  },
  whisper: {
    format: (slug) =>
      `whisper_transcribe(adapter="${slug}", audio_url="...", language="pt")`,
  },
};

export function formatAdaptersPrompt(agentId: string): string {
  const adapters = resolveAdapters(agentId);
  if (adapters.size === 0) return "";

  let prompt = "<available_adapters>\n";
  for (const [slug, a] of adapters) {
    const name = (a.metadata.name as string) ?? slug;
    const connector = (a.metadata.connector as string) ?? "unknown";
    const policy = (a.metadata.policy as string) ?? "readonly";
    const desc = (a.metadata.description as string) ?? "";
    const toolInfo = CONNECTOR_TOOLS[connector];

    prompt += `- **${name}** (slug: \`${slug}\`, ${connector}, ${policy}): ${desc}\n`;
    if (toolInfo) {
      prompt += `  tools: ${toolInfo.format(slug, policy)}\n`;
    }
  }
  prompt += "</available_adapters>\n";
  prompt +=
    "To interact with adapters, use the tools listed above. Always pass the adapter slug as the identifier parameter.\n\n";
  return prompt;
}
