import {
  resolveAgentSoul,
  resolveHeartbeatInstructions,
  resolveConversationInstructions,
  resolveRequestInstructions,
  resolveAgentServiceConfig,
  resolveSkills,
  resolveTools,
  type ResolvedResource,
} from "./resolver.js";
import yaml from "js-yaml";
import { parseFrontmatter } from "./frontmatter.js";
import { buildSkillsSnapshot } from "../skills/prompt.js";
import { formatToolsPrompt } from "../tools/prompt.js";
import { formatAdaptersPrompt } from "../adapters/prompt.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { agentDir } from "./paths.js";

export { CONTEXT_DIR } from "./paths.js";
export type { ResolvedResource as ContextEntry } from "./resolver.js";

export interface UserContext {
  user_id: string;
  role: "sysuser" | "user";
  active_tenant_id: number | null;
  tenant_ids: number[];
}

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

// --- Shared Core Assembly ---

/**
 * Assembles the shared agent core prompt: identity, context, skills, tools, adapters.
 * Used by both conversation and heartbeat modes.
 */
export function assembleAgentCore(agentId: string): string {
  const soul = loadSoul(agentId);
  const { prompt: skillsPrompt } = buildSkillsSnapshot(agentId);
  const toolsPrompt = formatToolsPrompt(agentId);
  const dir = agentDir(agentId);

  let prompt = "";
  if (soul) prompt += `<identity>\n${soul}\n</identity>\n\n`;
  prompt += `<agent_context>\nagent_id: ${agentId}\nagent_dir: ${dir}\n</agent_context>\n\n`;
  prompt += skillsPrompt;
  prompt += toolsPrompt;
  prompt += formatAdaptersPrompt(agentId);
  return prompt;
}

// --- Prompt Assembly ---

export async function assembleConversationPrompt(
  agentId: string,
  userMessage: string,
  userId?: string,
  userContext?: UserContext
): Promise<string> {
  let prompt = assembleAgentCore(agentId);

  if (userContext) {
    prompt += `<user_context>\n`;
    prompt += `user_id: ${userContext.user_id}\n`;
    prompt += `role: ${userContext.role}\n`;
    prompt += `active_tenant_id: ${userContext.active_tenant_id ?? 'null'}\n`;
    prompt += `tenant_ids: [${userContext.tenant_ids.join(', ')}]\n`;
    prompt += `</user_context>\n\n`;
  }

  // CONVERSATION.md (if exists and non-empty)
  const conv = resolveConversationInstructions(agentId);
  if (conv && !isMarkdownEmpty(conv)) {
    prompt += `<conversation_instructions>\n${conv}\n</conversation_instructions>\n\n`;
  }

  // HEARTBEAT.md as drive reference (informational)
  const hb = loadHeartbeatInstructions(agentId);
  if (hb && !isMarkdownEmpty(hb)) {
    prompt += `<agent_drive>\n${hb}\n</agent_drive>\n\n`;
  }

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

  let prompt = assembleAgentCore(agentId);
  prompt += `<heartbeat_instructions>\n${instructions}\n</heartbeat_instructions>\n\n`;
  prompt += `Follow the heartbeat instructions strictly.\n`;
  prompt += `Do not infer or repeat old tasks from prior context.\n`;
  prompt += `If you have nothing to report and the instructions don't ask you to produce content, reply with exactly: HEARTBEAT_OK`;
  return prompt;
}

// --- Request Mode ---

export async function assembleRequestPrompt(
  agentId: string,
  message: string,
  serviceSlug?: string,
): Promise<string> {
  let prompt = assembleAgentCore(agentId);

  // REQUEST.md (agent-specific or default)
  const requestInstructions = resolveRequestInstructions(agentId);
  prompt += `<request_instructions>\n${requestInstructions}\n</request_instructions>\n\n`;

  // SERVICE.yaml (if specific service requested)
  if (serviceSlug) {
    const serviceConfig = resolveAgentServiceConfig(agentId, serviceSlug);
    if (serviceConfig) {
      prompt += `<service_contract>\n${yaml.dump(serviceConfig)}\n</service_contract>\n\n`;
    }
  }

  // Semantic memory retrieval (guarded by OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    try {
      const mgr = getAgentMemoryManager(agentId);
      const results = await mgr.search(message);
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

  prompt += message;
  return prompt;
}
