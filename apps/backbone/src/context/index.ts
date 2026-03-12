import {
  resolveAgentSoul,
  resolveUserProfile,
  resolveModeInstructions,
  type InteractionMode,
} from "./resolver.js";
import { parseFrontmatter } from "./readers.js";
import { buildSkillsSnapshot } from "../skills/prompt.js";
import { connectorRegistry } from "../connectors/index.js";
import { formatServicesPrompt } from "../services/prompt.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { agentDir, agentWorkspaceDir } from "./paths.js";

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

export interface AssembledPrompt {
  system: string;
  userMessage: string;
}

export async function assemblePrompt(
  agentId: string,
  mode: InteractionMode,
  opts: AssemblePromptOpts = {}
): Promise<AssembledPrompt | null> {
  // 1. Gate: mode instructions must exist and not be empty
  const instructions = resolveModeInstructions(agentId, mode);
  if (isMarkdownEmpty(instructions)) {
    return null;
  }

  // 2. Identity
  const soul = resolveAgentSoul(agentId);
  const dir = agentDir(agentId);
  const workspace = agentWorkspaceDir(agentId);

  let system = "";

  if (soul) {
    system += `<identity>\n${soul}\n</identity>\n\n`;
  }

  // 3. User/mentor profile
  const userProfile = resolveUserProfile(agentId);
  if (userProfile) {
    system += `<user_profile>\nEste é o perfil do seu criador. Com quem você conversa na maioria dos canais.\n\n${userProfile}\n</user_profile>\n\n`;
  }

  // 4. Agent context
  system += `<agent_context>\nagent_id: ${agentId}\nagent_dir: ${dir}\nworkspace_dir: ${workspace}\n</agent_context>\n\n`;

  // 5. Skills
  system += buildSkillsSnapshot(agentId).prompt;

  // 6. Adapters
  system += connectorRegistry.formatPrompt(agentId);

  // 7. Services
  system += formatServicesPrompt(agentId);

  // 8. Semantic memory (data-driven: requires userMessage + OPENAI_API_KEY)
  if (opts.userMessage && process.env.OPENAI_API_KEY) {
    try {
      const mgr = getAgentMemoryManager(agentId);
      const results = await mgr.search(opts.userMessage);
      if (results.length > 0) {
        system += "<relevant_memories>\n";
        for (const r of results) {
          system += `[${r.citation} score=${r.score.toFixed(2)}]\n${r.snippet}\n\n`;
        }
        system += "</relevant_memories>\n\n";
      }
    } catch (err) {
      console.warn("[memory] search failed:", err);
    }
  }

  // 9. Mode instructions (generic tag)
  system += `<instructions>\n${instructions}\n</instructions>\n\n`;

  // 10. Tail
  system += "Follow the instructions strictly.\n";

  return {
    system,
    userMessage: opts.userMessage ?? "",
  };
}
