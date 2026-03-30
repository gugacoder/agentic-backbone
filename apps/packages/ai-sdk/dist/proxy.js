import { AgentRunOptionsSchema } from "./schemas.js";
import { runAiAgent } from "./agent.js";
import { braveSearch } from "./tools/brave-search.js";
/**
 * DuckDuckGo HTML search scraper — no API key needed.
 */
async function duckDuckGoSearch(query, numResults = 5) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });
    if (!res.ok)
        return [];
    const html = await res.text();
    const results = [];
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < numResults) {
        const rawUrl = match[1];
        const title = match[2].replace(/<[^>]+>/g, "").trim();
        const snippet = match[3].replace(/<[^>]+>/g, "").trim();
        // DuckDuckGo uses redirect URLs — extract the real URL
        const realUrl = new URL(rawUrl, "https://duckduckgo.com").searchParams.get("uddg") ?? rawUrl;
        if (title && snippet) {
            results.push({ title, url: realUrl, snippet });
        }
    }
    return results;
}
/**
 * Resolve web search provider from providerConfig.
 * Returns undefined when search is disabled ("none").
 */
function resolveSearchProvider(providerConfig) {
    const provider = providerConfig?.webSearch ?? "duckduckgo";
    if (provider === "none")
        return undefined;
    if (provider === "brave" && providerConfig?.braveApiKey) {
        return (q, n) => braveSearch(q, n, providerConfig.braveApiKey);
    }
    return duckDuckGoSearch;
}
export async function* runAgent(raw) {
    const options = AgentRunOptionsSchema.parse(raw);
    const startMs = Date.now();
    const onWebSearch = resolveSearchProvider(options.providerConfig);
    console.log(`[proxy] model=${options.model} role=${options.role ?? "conversation"} webSearch=${options.providerConfig?.webSearch ?? "duckduckgo"}`);
    for await (const event of runAiAgent(options.prompt, {
        model: options.model,
        apiKey: options.apiKey,
        sessionId: options.sessionId,
        sessionDir: options.sessionDir,
        messageMeta: options.messageMeta,
        maxSteps: options.maxTurns ?? 100,
        ...(onWebSearch ? { onWebSearch } : {}),
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.system ? { system: { append: options.system } } : {}),
    })) {
        if (event.type === "init") {
            yield { type: "init", sessionId: event.sessionId };
        }
        else if (event.type === "text") {
            yield { type: "text", content: event.content };
        }
        else if (event.type === "result") {
            yield { type: "result", content: event.content };
        }
        else if (event.type === "usage") {
            yield {
                type: "usage",
                usage: {
                    inputTokens: event.usage.inputTokens,
                    outputTokens: event.usage.outputTokens,
                    cacheReadInputTokens: event.usage.cacheReadInputTokens,
                    cacheCreationInputTokens: event.usage.cacheCreationInputTokens,
                    totalCostUsd: event.usage.totalCostUsd,
                    numTurns: event.usage.numTurns,
                    durationMs: event.usage.durationMs || (Date.now() - startMs),
                    durationApiMs: event.usage.durationApiMs,
                    stopReason: event.usage.stopReason,
                },
            };
        }
        else if (event.type === "step_finish") {
            yield { type: "step_finish" };
        }
        else if (event.type === "reasoning") {
            yield { type: "reasoning", content: event.content };
        }
        else if (event.type === "tool-call") {
            yield { type: "tool-call", toolCallId: event.toolCallId, toolName: event.toolName, args: event.args };
        }
        else if (event.type === "tool-result") {
            yield { type: "tool-result", toolCallId: event.toolCallId, toolName: event.toolName, result: event.result };
        }
        // Unknown event types are silently dropped (safe denylist: only known AgentEvent members are forwarded)
    }
}
