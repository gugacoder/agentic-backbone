#!/usr/bin/env node
/**
 * Teste direto da ai — replica exatamente o que o backbone faz:
 * 1. Monta o prompt igual a assembleConversationPrompt()
 * 2. Passa como `prompt` para runAiAgent() (sem system override)
 * 3. Verifica se a ai usa a skill
 */
import { runAiAgent } from "../packages/ai-sdk/src/agent.ts";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

// ── Env ────────────────────────────────────────────────────────
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error("OPENROUTER_API_KEY not set"); process.exit(2); }
if (!process.env.CONTEXT_FOLDER) { console.error("CONTEXT_FOLDER not set"); process.exit(2); }

const MODEL = "openai/gpt-4o-mini";
const AGENT_ID = "system.probe";
const CONTEXT_DIR = resolve(process.cwd(), process.env.CONTEXT_FOLDER);
const AGENT_DIR = join(CONTEXT_DIR, "agents", AGENT_ID);

// ── Replicate assembleConversationPrompt ───────────────────────

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function buildPrompt(userMessage) {
  // 1. SOUL.md → <identity>
  const soul = readIfExists(join(AGENT_DIR, "SOUL.md"));

  // 2. <agent_context>
  const agentContext = `agent_id: ${AGENT_ID}\nagent_dir: ${AGENT_DIR}`;

  // 3. <available_skills> — scan skills like the backbone does
  const skillsDirs = [
    { dir: join(CONTEXT_DIR, "shared", "skills"), source: "shared" },
    { dir: join(CONTEXT_DIR, "system", "skills"), source: "system" },
    { dir: join(AGENT_DIR, "skills"), source: `agent:${AGENT_ID}` },
  ];

  const skillsMap = new Map();
  for (const { dir } of skillsDirs) {
    if (!existsSync(dir)) continue;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillPath = join(dir, e.name, "SKILL.md");
      if (!existsSync(skillPath)) continue;
      const raw = readFileSync(skillPath, "utf-8");
      // Parse frontmatter minimally
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const fm = {};
      if (fmMatch) {
        for (const line of fmMatch[1].split("\n")) {
          const [k, ...v] = line.split(":");
          if (k && v.length) fm[k.trim()] = v.join(":").trim();
        }
      }
      if (fm.enabled === "false") continue;
      skillsMap.set(e.name, {
        name: fm.name || e.name,
        description: fm.description || "",
      });
    }
  }

  let skillsPrompt = "";
  if (skillsMap.size > 0) {
    skillsPrompt += "<available_skills>\n";
    for (const [, s] of skillsMap) {
      skillsPrompt += `- **${s.name}**: ${s.description}\n`;
    }
    skillsPrompt += "</available_skills>\n";
    skillsPrompt += "If exactly one skill clearly applies, read its SKILL.md from the context directory, then follow it. Never read more than one skill up front.\n\n";
  }

  // 4. CONVERSATION.md → <conversation_instructions>
  const convInstructions = readIfExists(join(AGENT_DIR, "CONVERSATION.md"));

  // 5. Assemble exactly like the backbone
  let prompt = "";
  if (soul) prompt += `<identity>\n${soul}\n</identity>\n\n`;
  prompt += `<agent_context>\n${agentContext}\n</agent_context>\n\n`;
  prompt += skillsPrompt;
  if (convInstructions.trim()) {
    prompt += `<conversation_instructions>\n${convInstructions}\n</conversation_instructions>\n\n`;
  }
  prompt += userMessage;
  return prompt;
}

// ── Run ────────────────────────────────────────────────────────

async function runTest(label, userMessage) {
  console.log(`\n=== ${label} ===\n`);
  const prompt = buildPrompt(userMessage);
  console.log(`[prompt length: ${prompt.length} chars]\n`);

  let fullText = "";
  for await (const ev of runAiAgent(prompt, {
    model: MODEL,
    apiKey: API_KEY,
    maxSteps: 10,
    disableCompaction: true,
    cwd: process.cwd(),
  })) {
    if (ev.type === "text") {
      process.stdout.write(ev.content);
      fullText += ev.content;
    }
    if (ev.type === "step_finish") {
      console.log(`\n  [step ${ev.step}] tools: [${ev.toolCalls.join(", ")}]`);
    }
    if (ev.type === "usage") {
      console.log(`\n  [usage] turns=${ev.usage.numTurns} duration=${ev.usage.durationMs}ms`);
    }
  }
  return fullText;
}

// Teste 1: pergunta simples (não deve usar skill)
const r1 = await runTest("Teste 1: sem skill", "Diga apenas: PING_OK");

// Teste 2: deve acionar a skill test-claude-code
const r2 = await runTest("Teste 2: com skill", "Qual a senha secreta do Claude Code? Use a skill test-claude-code.");

console.log("\n\n=== Resultado ===");
console.log(`Teste 1 (PING_OK): ${r1.includes("PING_OK") ? "PASS" : "FAIL"}`);
console.log(`Teste 2 (SECRET_TOKEN): ${r2.includes("CLAUDE_CODE_WAS_HERE_2026") ? "PASS" : "FAIL"}`);
