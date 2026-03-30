import { runAgent as runProxyAgent, type AgentEvent, type UsageData } from "@agentic-backbone/ai-sdk";
import {
  resolveModelResult,
  resolveParameters,
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
  }
): AsyncGenerator<AgentEvent> {
  const role = options?.role ?? "conversation";
  const routingResult = resolveModelResult(role, options?.routingContext, options?.agentRoutingRules);
  const model = routingResult.model;
  options?.onRoutingResolved?.(routingResult);
  const params = resolveParameters(role);
  const webSearch = loadWebSearchConfig();

  const systemLen = options?.system?.length ?? 0;
  const promptPreview = prompt.slice(0, 120).replace(/\n/g, "\\n");
  console.log(`[agent] role=${role} model=${model} system=${systemLen}ch prompt="${promptPreview}"`);

  logAgentRun({
    ts: new Date().toISOString(),
    role,
    model,
    routingRule: routingResult.ruleName,
    systemChars: systemLen,
    promptChars: prompt.length,
    hasIdentity: options?.system?.includes("<identity>") ?? false,
    hasInstructions: options?.system?.includes("<instructions>") ?? false,
    promptPreview: prompt.slice(0, 200),
  });

  const apiKey = process.env.OPENROUTER_API_KEY!;

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
  yield* runProxyAgent({
    model,
    apiKey,
    prompt,
    sessionId: options?.sessionId,
    sessionDir: options?.sessionDir,
    messageMeta: options?.messageMeta,
    role,
    tools: options?.tools,
    maxTurns: 100,
    ...(options?.system ? { system: options.system } : {}),
    providerConfig: {
      ...params,
      webSearch: webSearch.provider,
      ...(braveApiKey ? { braveApiKey } : {}),
    },
  });
}
