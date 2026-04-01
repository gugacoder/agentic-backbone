import { resolveServices } from "../context/resolver.js";
import type { Service } from "./types.js";

export function loadAgentServices(agentId: string): Service[] {
  const resolved = resolveServices(agentId);
  const services: Service[] = [];

  for (const [, entry] of resolved) {
    const enabled = entry.metadata.enabled !== false;
    if (!enabled) continue;

    services.push({
      slug: entry.slug,
      name: (entry.metadata.name as string) ?? entry.slug,
      description: (entry.metadata.description as string) ?? "",
      enabled,
      skipAgent: (entry.metadata["skip-agent"] as boolean) ?? false,
      source: entry.source,
      dir: entry.path.replace(/\/SERVICE\.md$/, "").replace(/\\SERVICE\.md$/, ""),
      content: entry.content,
      metadata: entry.metadata,
    });
  }

  return services;
}

export function findService(
  agentId: string,
  serviceSlug: string
): Service | null {
  const services = loadAgentServices(agentId);
  return services.find((s) => s.slug === serviceSlug) ?? null;
}
