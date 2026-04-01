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
import { getUser } from "../users/manager.js";
import { getChannel } from "../channels/registry.js";

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

// --- Channel descriptions ---

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  "twilio-voice": "Você está numa chamada telefônica. Suas respostas serão convertidas em fala (TTS). Seja conciso e natural como numa conversa por voz. Não use formatação, links ou emojis.",
  "evolution": "Você está conversando via WhatsApp.",
  "sse": "Você está conversando via chat web.",
};

// --- Unified Prompt Assembly ---

export interface AssemblePromptOpts {
  userMessage?: string;
  channelId?: string;
  rich?: boolean;
}

const RICH_CONTENT_PROMPT = `<rich_content>
O cliente suporta conteudo rico. Alem de markdown, voce tem display tools para formatar informacoes de forma visual.

Planeje sua resposta usando as display tools quando fizer sentido:
- display_highlight: para destacar valores, precos, alertas ou pedir escolhas ao usuario
- display_collection: para colecoes (tabelas, comparacoes, carrosseis, galerias, fontes)
- display_card: para itens individuais (produtos, links, arquivos, imagens)
- display_visual: para visualizacoes (graficos, mapas, codigo, progresso, timelines)

Regras:
- Use display tools para informacao estruturada; use markdown para texto corrido
- Combine display tools com texto markdown na mesma resposta
- Nao use display tool quando markdown simples resolve (listas, headings, bold)
- Uma resposta pode ter multiplas display tools
</rich_content>

`;

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

  // 2a. Location + datetime context
  const owner = agentId.split(".")[0];
  const ownerUser = getUser(owner);
  const tz = ownerUser?.address?.timezone ?? process.env.TIMEZONE ?? "UTC";
  const now = new Date();
  const formatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  let locationLine = `It is now ${formatted} (${tz}) at ${time}.`;
  const locationParts = [ownerUser?.address?.city, ownerUser?.address?.state, ownerUser?.address?.country].filter(Boolean);
  if (locationParts.length > 0) {
    locationLine += ` Location: ${locationParts.join(", ")}`;
  }
  system += `${locationLine}\n\n`;

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

  // 7b. Scheduling (cron tools guidance)
  system += `<scheduling>
Você pode criar, listar, atualizar e remover agendamentos usando as ferramentas cron_*.
Quando o usuário pedir para ser lembrado, agendar, programar algo recorrente ou pontual, use:
- cron_add: criar agendamento (kind='cron' para recorrente, kind='at' para pontual)
- cron_list: listar agendamentos existentes
- cron_update: alterar um agendamento
- cron_remove: remover um agendamento
- cron_status / cron_runs: verificar status e histórico

Para cron_add, use payload kind='conversation' com a mensagem que você quer enviar.
Exemplo: agendar mensagem diária às 7h → schedule: {kind:'cron', expr:'0 7 * * *', tz:'America/Sao_Paulo'}, payload: {kind:'conversation', message:'Bom dia!'}
</scheduling>\n\n`;

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

  // 9. Channel context
  if (opts.channelId) {
    const ch = getChannel(opts.channelId);
    const adapter = ch?.["channel-adapter"];
    const channelInstructions = ch?.instructions
      ?? (adapter ? CHANNEL_DESCRIPTIONS[adapter] : undefined);
    if (channelInstructions) {
      system += `<channel>\n${channelInstructions}\n</channel>\n\n`;
    }
  }

  // 10. Rich content instructions
  if (opts.rich) {
    system += RICH_CONTENT_PROMPT;
  }

  // 11. Mode instructions (generic tag)
  system += `<instructions>\n${instructions}\n</instructions>\n\n`;

  // 12. Tail
  system += "Follow the instructions strictly.\n";

  return {
    system,
    userMessage: opts.userMessage ?? "",
  };
}
