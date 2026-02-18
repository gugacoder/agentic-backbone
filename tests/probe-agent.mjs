// Simula o que o heartbeat faz: monta prompt → chama runAgent → loga eventos
import { assembleHeartbeatPrompt } from "../apps/backbone/src/context/index.js";
import { runAgent } from "../apps/backbone/src/agent/index.js";
import { createAdapterMcpServer } from "../apps/backbone/src/adapters/tools.js";
import { jobsMcpServer } from "../apps/backbone/src/jobs/tools.js";

const agentId = "system.probe";

console.log("1. Montando prompt...");
const prompt = await assembleHeartbeatPrompt(agentId);
if (!prompt) { console.log("PROMPT VAZIO — heartbeat seria skipped"); process.exit(0); }
console.log(`   OK (${prompt.length} chars)`);
console.log("--- PROMPT ---");
console.log(prompt.slice(0, 500));
console.log("--- FIM (truncado) ---\n");

console.log("2. Criando MCP servers...");
const mcpServers = { "backbone-jobs": jobsMcpServer };
const adapterMcp = createAdapterMcpServer(agentId);
if (adapterMcp) mcpServers["backbone-adapters"] = adapterMcp;
console.log(`   MCP servers: ${Object.keys(mcpServers).join(", ")}`);

console.log("\n3. Chamando runAgent...");
const start = Date.now();
try {
  for await (const event of runAgent(prompt, { role: "heartbeat", mcpServers })) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (event.type === "text") {
      console.log(`   [${elapsed}s] text: ${event.content?.slice(0, 100)}`);
    } else if (event.type === "result") {
      console.log(`   [${elapsed}s] result: ${event.content?.slice(0, 200)}`);
    } else {
      console.log(`   [${elapsed}s] ${event.type}`);
    }
  }
} catch (err) {
  console.log(`   ERRO: ${err.message}`);
}
console.log(`\n4. Fim (${((Date.now() - start) / 1000).toFixed(1)}s)`);
process.exit(0);
