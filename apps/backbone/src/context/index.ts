import {
  resolveAgentSoul,
  resolveHeartbeatInstructions,
  resolveSkills,
  resolveTools,
  type ResolvedResource,
} from "./resolver.js";
import { parseFrontmatter } from "./frontmatter.js";
import { buildSkillsSnapshot } from "../skills/prompt.js";
import { formatToolsPrompt } from "../tools/prompt.js";
import { formatAdaptersPrompt } from "../adapters/prompt.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { agentDir } from "./paths.js";

export { CONTEXT_DIR } from "./paths.js";
export type { ResolvedResource as ContextEntry } from "./resolver.js";

// --- Guards ---

function isEffectivelyEmpty(content: string): boolean {
  return content.split("\n").every((line) => {
    const t = line.trim();
    return (
      t === "" ||
      /^#{1,6}\s/.test(t) ||
      /^[-*]\s*\[\s*\]\s*$/.test(t) ||
      /^[-*]\s*$/.test(t)
    );
  });
}

export function isMarkdownEmpty(raw: string, opts?: { ignoreFrontmatter?: boolean }): boolean {
  const content = (opts?.ignoreFrontmatter ?? true)
    ? parseFrontmatter(raw).content
    : raw;
  return isEffectivelyEmpty(content);
}

// --- Loaders (agent-scoped) ---

export function loadSoul(agentId: string): string {
  return resolveAgentSoul(agentId);
}

export function loadSkills(agentId: string): ResolvedResource[] {
  return [...resolveSkills(agentId).values()];
}

export function loadTools(agentId: string): ResolvedResource[] {
  return [...resolveTools(agentId).values()];
}

export function loadHeartbeatInstructions(agentId: string): string {
  return resolveHeartbeatInstructions(agentId);
}

// --- Prompt Assembly ---

export async function assembleConversationPrompt(
  agentId: string,
  userMessage: string,
  userId?: string
): Promise<string> {
  const soul = loadSoul(agentId);
  const { prompt: skillsPrompt } = buildSkillsSnapshot(agentId);
  const toolsPrompt = formatToolsPrompt(agentId);

  const dir = agentDir(agentId);

  let prompt = "";

  if (soul) {
    prompt += `<identity>\n${soul}\n</identity>\n\n`;
  }

  prompt += `<agent_context>\nagent_id: ${agentId}\nagent_dir: ${dir}\n</agent_context>\n\n`;

  prompt += skillsPrompt;
  prompt += toolsPrompt;
  prompt += formatAdaptersPrompt(agentId);

  // Semantic memory retrieval (guarded by OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    try {
      const mgr = getAgentMemoryManager(agentId);
      const results = await mgr.search(userMessage);
      if (results.length > 0) {
        prompt += "<relevant_memories>\n";
        for (const r of results) {
          prompt += `[${r.citation} score=${r.score.toFixed(2)}]\n${r.snippet}\n\n`;
        }
        prompt += "</relevant_memories>\n\n";
      }
    } catch (err) {
      console.warn("[memory] search failed:", err);
    }
  }

  prompt += userMessage;
  return prompt;
}

export function assembleHeartbeatPrompt(
  agentId: string = "system.main"
): string | null {
  const instructions = loadHeartbeatInstructions(agentId);

  if (isMarkdownEmpty(instructions)) {
    return null;
  }

  const soul = loadSoul(agentId);

  const adaptersPrompt = formatAdaptersPrompt(agentId);

  const dir = agentDir(agentId);

  return (
    (soul ? `<identity>\n${soul}\n</identity>\n\n` : "") +
    `<agent_context>\nagent_id: ${agentId}\nagent_dir: ${dir}\n</agent_context>\n\n` +
    adaptersPrompt +
    `<heartbeat_instructions>\n${instructions}\n</heartbeat_instructions>\n\n` +
    `Follow the heartbeat instructions strictly.\n` +
    `Do not infer or repeat old tasks from prior context.\n` +
    `If nothing needs attention, reply with exactly: HEARTBEAT_OK`
  );
}
