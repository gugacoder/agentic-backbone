import { runAgent as runProxyAgent, type AgentEvent, type UsageData } from "@codrstudio/agentic-sdk";
import {
  resolveModelResult,
  resolveParameters,
  getProviderConfig,
  type RoutingContext,
  type RoutingRule,
  type ModelResult,
} from "../settings/llm.js";
import { loadWebSearchConfig } from "../settings/web-search.js";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../context/paths.js";

export type { AgentEvent, UsageData };
export type { RoutingContext, RoutingRule, ModelResult };

const LOG_PATH = join(DATA_DIR, "agent-runs.jsonl");

function logAgentRun(entry: Record<string, unknown>): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.warn("[agent] failed to log run:", err);
  }
}

export async function* runAgent(
  prompt: string,
  options?: {
    sessionId?: string;
    sessionDir?: string;
    messageMeta?: Record<string, unknown>;
    role?: string;
    tools?: Record<string, any>;
    system?: string;
    routingContext?: RoutingContext;
    agentRoutingRules?: RoutingRule[];
    onRoutingResolved?: (result: ModelResult) => void;
    contentParts?: unknown[];
    disableDisplayTools?: boolean;
  }
): AsyncGenerator<AgentEvent> {
  const role = options?.role ?? "conversation";
  const routingResult = resolveModelResult(role, options?.routingContext, options?.agentRoutingRules);
  const model = routingResult.model;
  const provider = routingResult.provider;
  options?.onRoutingResolved?.(routingResult);
  const params = resolveParameters(role);
  const webSearch = loadWebSearchConfig();

  const providerConf = getProviderConfig(provider);
  const apiKey = process.env[providerConf.apiKeyEnv]!;

  const tools = options?.tools;
  if (providerConf.maxTools !== undefined && tools && Object.keys(tools).length > providerConf.maxTools) {
    console.warn(`[agent] ${Object.keys(tools).length} tools exceeds provider limit of ${providerConf.maxTools} for provider "${provider}"`);
  }

  const systemLen = options?.system?.length ?? 0;
  const promptPreview = prompt.slice(0, 120).replace(/\n/g, "\\n");
  console.log(`[agent] role=${role} provider=${provider} model=${model} system=${systemLen}ch prompt="${promptPreview}"`);

  logAgentRun({
    ts: new Date().toISOString(),
    role,
    provider,
    model,
    routingRule: routingResult.ruleName,
    systemChars: systemLen,
    promptChars: prompt.length,
    hasIdentity: options?.system?.includes("<identity>") ?? false,
    hasInstructions: options?.system?.includes("<instructions>") ?? false,
    promptPreview: prompt.slice(0, 200),
  });

  // Read BRAVE_API_KEY: prefer process.env, fallback to reading .env file directly
  let braveApiKey = process.env.BRAVE_API_KEY;
  if (!braveApiKey) {
    try {
      const envContent = readFileSync(join(process.cwd(), ".env"), "utf-8");
      const match = envContent.match(/^BRAVE_API_KEY=(.+)$/m);
      if (match) braveApiKey = match[1].trim();
    } catch (err) {
      console.debug("[agent] .env read failed (BRAVE_API_KEY):", err);
    }
  }
  // Build extra providers map for non-openrouter providers
  const extraProviders: Record<string, { baseURL: string; apiKey: string }> = {};
  if (provider !== "openrouter") {
    extraProviders[provider] = { baseURL: providerConf.baseURL, apiKey };
  }

  yield* runProxyAgent({
    model,
    apiKey: process.env.OPENROUTER_API_KEY ?? apiKey,
    provider,
    ...(Object.keys(extraProviders).length > 0 ? { providers: extraProviders } : {}),
    prompt,
    sessionId: options?.sessionId,
    sessionDir: options?.sessionDir,
    messageMeta: options?.messageMeta,
    role,
    tools: options?.tools,
    maxTurns: 100,
    ...(options?.system ? { system: options.system } : {}),
    ...(options?.contentParts ? { contentParts: options.contentParts } : {}),
    ...(options?.disableDisplayTools !== undefined ? { disableDisplayTools: options.disableDisplayTools } : {}),
    providerConfig: {
      ...params,
      webSearch: webSearch.provider,
      ...(braveApiKey ? { braveApiKey } : {}),
    },
  });
}
