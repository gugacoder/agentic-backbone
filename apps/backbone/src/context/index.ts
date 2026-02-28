import {
  resolveAgentSoul,
  resolveModeInstructions,
  type InteractionMode,
} from "./resolver.js";
import { parseFrontmatter } from "./frontmatter.js";
import { buildSkillsSnapshot } from "../skills/prompt.js";
import { formatToolsPrompt } from "../tools/prompt.js";
import { formatAdaptersPrompt } from "../adapters/prompt.js";
import { formatServicesPrompt } from "../services/prompt.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { agentDir } from "./paths.js";

export { CONTEXT_DIR } from "./paths.js";
export type { InteractionMode } from "./resolver.js";

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

// --- Unified Prompt Assembly ---

export interface AssemblePromptOpts {
  userMessage?: string;
}

export async function assemblePrompt(
  agentId: string,
  mode: InteractionMode,
  opts: AssemblePromptOpts = {}
): Promise<string | null> {
  // 1. Gate: mode instructions must exist and not be empty
  const instructions = resolveModeInstructions(agentId, mode);
  if (isMarkdownEmpty(instructions)) {
    return null;
  }

  // 2. Identity
  const soul = resolveAgentSoul(agentId);
  const dir = agentDir(agentId);

  let prompt = "";

  if (soul) {
    prompt += `<identity>\n${soul}\n</identity>\n\n`;
  }

  // 3. Agent context
  prompt += `<agent_context>\nagent_id: ${agentId}\nagent_dir: ${dir}\n</agent_context>\n\n`;

  // 4. Skills
  prompt += buildSkillsSnapshot(agentId).prompt;

  // 5. Tools
  prompt += formatToolsPrompt(agentId);

  // 6. Adapters
  prompt += formatAdaptersPrompt(agentId);

  // 7. Services
  prompt += formatServicesPrompt(agentId);

  // 8. Semantic memory (data-driven: requires userMessage + OPENAI_API_KEY)
  if (opts.userMessage && process.env.OPENAI_API_KEY) {
    try {
      const mgr = getAgentMemoryManager(agentId);
      const results = await mgr.search(opts.userMessage);
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

  // 9. Mode instructions (generic tag)
  prompt += `<instructions>\n${instructions}\n</instructions>\n\n`;

  // 10. Tail
  prompt += "Follow the instructions strictly.\n";

  // 11. User message (when present)
  if (opts.userMessage) {
    prompt += `\n${opts.userMessage}`;
  }

  return prompt;
}
