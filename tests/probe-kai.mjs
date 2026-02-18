/**
 * Probe test: calls runKaiAgent() directly to verify the LLM responds.
 * This isolates the exact point where the backbone talks to the Kai (OpenRouter).
 *
 * Usage: node --env-file=apps/backbone/.env tests/probe-kai.mjs
 */

import { runKaiAgent } from "@agentic-backbone/kai-sdk";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not set. Load .env first.");
  process.exit(1);
}

const model = "openai/gpt-4o-mini";
const prompt = "Responda apenas: 'Kai online.' Nada mais.";

console.log(`[probe] model=${model}`);
console.log(`[probe] prompt="${prompt}"`);
console.log(`[probe] Calling runKaiAgent()...\n`);

const startMs = Date.now();

try {
  for await (const event of runKaiAgent(prompt, {
    model,
    apiKey,
    maxSteps: 1,
    disableCompaction: true,
    // No tools, no MCP — pure LLM call
    system: "Você é um assistente de teste. Responda de forma breve.",
  })) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    switch (event.type) {
      case "init":
        console.log(`[${elapsed}s] INIT sessionId=${event.sessionId}`);
        break;
      case "context_status":
        console.log(`[${elapsed}s] CONTEXT model=${event.context.model} used=${event.context.usagePercent.toFixed(1)}%`);
        break;
      case "text":
        process.stdout.write(event.content);
        break;
      case "result":
        console.log(`\n[${elapsed}s] RESULT: "${event.content}"`);
        break;
      case "usage":
        console.log(`[${elapsed}s] USAGE: in=${event.usage.inputTokens} out=${event.usage.outputTokens} cost=$${event.usage.totalCostUsd.toFixed(4)} turns=${event.usage.numTurns} stop=${event.usage.stopReason}`);
        break;
      default:
        console.log(`[${elapsed}s] ${event.type}:`, JSON.stringify(event));
    }
  }

  console.log(`\n[probe] SUCCESS — Kai respondeu.`);
} catch (err) {
  console.error(`\n[probe] FAIL — Kai não respondeu.`);
  console.error(err);
  process.exit(1);
}
