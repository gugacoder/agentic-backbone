import { z } from "zod";
import { aiGenerateObject } from "@agentic-backbone/ai-sdk";
import { resolveModelResult } from "../settings/llm.js";
import { readMessages } from "../conversations/persistence.js";
import {
  agentMemoryPath,
  agentUserMemoryPath,
  agentJournalDayPath,
} from "../context/paths.js";
import { getAgentMemoryManager } from "./manager.js";
import { today, readFileSafe, ensureWrite } from "./tools/_helpers.js";

export interface FlushResult {
  success: boolean;
  didWrite: boolean;
}

const CONTEXT_TAIL = 40;

// Structured output schema for memory extraction
const MemoryExtractionSchema = z.object({
  general_facts: z
    .array(z.string())
    .describe("Fatos gerais sobre o projeto, decisões, contexto técnico. Cada fato deve ser uma frase concisa e independente, em português com acentuação correta."),
  user_facts: z
    .array(
      z.object({
        userSlug: z.string().describe("Slug do usuário (ex: 'guga', 'handerson')"),
        facts: z.array(z.string()).describe("Fatos sobre este usuário, em português com acentuação correta"),
      })
    )
    .describe("Fatos aprendidos sobre usuários específicos (preferências, datas, informações pessoais)"),
  journal: z
    .string()
    .describe("Resumo narrativo do dia em português. Inclua o contexto geral da conversa, tom, temas discutidos e decisões tomadas. Se não houver conteúdo relevante, retorne string vazia."),
});

function extractText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  return (content as any[])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function buildConversationContext(agentId: string, sessionId: string): string {
  const msgs = readMessages(agentId, sessionId);
  if (msgs.length === 0) return "";

  const tail = msgs.slice(-CONTEXT_TAIL);
  const lines = tail
    .filter((m) => m.role !== "tool")
    .map((m) => `[${m.role}] ${extractText(m.content)}`);
  return lines.join("\n\n");
}

function saveGeneralFacts(agentId: string, facts: string[]): number {
  if (facts.length === 0) return 0;

  const path = agentMemoryPath(agentId);
  const existing = readFileSafe(path);
  const existingLower = existing.toLowerCase();

  const newFacts = facts.filter((f) => !existingLower.includes(f.toLowerCase()));
  if (newFacts.length === 0) return 0;

  const day = today();
  const section = `\n## ${day}\n\n${newFacts.map((f) => `- ${f}`).join("\n")}\n`;
  const updated = existing
    ? existing.trimEnd() + "\n" + section
    : `# Memory\n${section}`;
  ensureWrite(path, updated);

  try { getAgentMemoryManager(agentId).markDirty(); } catch {}

  return newFacts.length;
}

function saveUserFacts(
  agentId: string,
  userSlug: string,
  facts: string[]
): number {
  if (facts.length === 0) return 0;

  const path = agentUserMemoryPath(agentId, userSlug);
  const existing = readFileSafe(path);
  const existingLower = existing.toLowerCase();

  const newFacts = facts.filter((f) => !existingLower.includes(f.toLowerCase()));
  if (newFacts.length === 0) return 0;

  const section = `\n${newFacts.map((f) => `- ${f}`).join("\n")}\n`;
  const updated = existing
    ? existing.trimEnd() + "\n" + section
    : `# ${userSlug}\n${section}`;
  ensureWrite(path, updated);

  try { getAgentMemoryManager(agentId).markDirty(); } catch {}

  return newFacts.length;
}

function saveJournal(agentId: string, content: string): boolean {
  if (!content || content.trim().length < 20) return false;

  const day = today();
  const path = agentJournalDayPath(agentId, day);
  const existing = readFileSafe(path);

  let updated: string;
  if (existing) {
    updated = existing.trimEnd() + "\n\n" + content.trim() + "\n";
  } else {
    updated = `# Journal — ${day}\n\n${content.trim()}\n`;
  }

  ensureWrite(path, updated);

  try { getAgentMemoryManager(agentId).markDirty(); } catch {}

  return true;
}

/**
 * Repair malformed extraction output from the LLM.
 * Gemini sometimes uses "fact" (singular) instead of "facts" (array),
 * or returns facts as separate keys instead of an array.
 */
function repairExtraction(raw: Record<string, unknown>): z.infer<typeof MemoryExtractionSchema> {
  const generalFacts = Array.isArray(raw.general_facts) ? raw.general_facts as string[] : [];

  const userFacts: { userSlug: string; facts: string[] }[] = [];
  if (Array.isArray(raw.user_facts)) {
    for (const uf of raw.user_facts) {
      const obj = uf as Record<string, unknown>;
      const slug = obj.userSlug as string;
      if (!slug) continue;

      // Try "facts" array first, fallback to "fact" (singular or repeated)
      let facts: string[];
      if (Array.isArray(obj.facts)) {
        facts = obj.facts as string[];
      } else if (typeof obj.fact === "string") {
        facts = [obj.fact];
      } else {
        // Collect all string values that aren't the slug
        facts = Object.entries(obj)
          .filter(([k, v]) => k !== "userSlug" && typeof v === "string")
          .map(([, v]) => v as string);
      }
      if (facts.length > 0) {
        userFacts.push({ userSlug: slug, facts });
      }
    }
  }

  const journal = typeof raw.journal === "string" ? raw.journal : "";

  return { general_facts: generalFacts, user_facts: userFacts, journal };
}

export async function flushMemory(options: {
  agentId: string;
  sessionId: string;
  sdkSessionId?: string;
}): Promise<FlushResult> {
  const { agentId, sessionId } = options;

  const context = buildConversationContext(agentId, sessionId);
  console.log(
    `[memory-flush:${agentId}] triggered for session=${sessionId}, contextLen=${context.length}`
  );
  if (!context) {
    return { success: true, didWrite: false };
  }

  const { model: modelId } = resolveModelResult("memory");
  const apiKey = process.env.OPENROUTER_API_KEY!;

  const system = [
    "Você é um assistente de extração de memória. Extraia fatos da conversa abaixo.",
    "Retorne um objeto JSON com:",
    "- general_facts: fatos sobre o projeto, trabalho, decisões, contexto técnico",
    "- user_facts: fatos sobre usuários específicos (preferências, datas, informações pessoais)",
    "- journal: resumo narrativo da conversa (temas, tom, decisões). String vazia se não houver conteúdo relevante.",
    "",
    "Regras:",
    "- OBRIGATÓRIO: escreva em português brasileiro correto, com acentuação (á, é, ã, ç, etc).",
    "- Cada fato deve ser uma frase concisa e independente.",
    "- Extraia apenas informação NOVA — ignore cumprimentos, conversa fiada, confirmações genéricas.",
    "- Ignore tool calls, erros de sistema, e detalhes técnicos internos do agente.",
    "- user_facts.userSlug deve ser o nome de usuário (ex: 'guga', 'handerson').",
  ].join("\n");

  const prompt = `Extraia fatos desta conversa:\n\n${context}`;

  try {
    let extracted: z.infer<typeof MemoryExtractionSchema> | null = null;

    try {
      extracted = await aiGenerateObject({
        model: modelId,
        apiKey,
        schema: MemoryExtractionSchema,
        system,
        prompt,
      });
    } catch (err: unknown) {
      // Gemini sometimes returns malformed JSON (e.g. "fact" instead of "facts").
      // Attempt to salvage from the raw text in the error.
      const raw = (err as { text?: string }).text;
      if (raw) {
        console.log(`[memory-flush:${agentId}] schema validation failed, attempting raw parse`);
        try {
          extracted = repairExtraction(JSON.parse(raw));
        } catch {
          // If even raw parse fails, re-throw original
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (!extracted) {
      console.log(`[memory-flush:${agentId}] no extraction result`);
      return { success: true, didWrite: false };
    }

    let totalSaved = 0;

    // Save general facts
    if (extracted.general_facts?.length) {
      const saved = saveGeneralFacts(agentId, extracted.general_facts);
      totalSaved += saved;
      if (saved > 0) {
        console.log(`[memory-flush:${agentId}] saved ${saved} general facts`);
      }
    }

    // Save per-user facts
    if (extracted.user_facts?.length) {
      for (const uf of extracted.user_facts) {
        if (!uf.userSlug || !uf.facts?.length) continue;
        const saved = saveUserFacts(agentId, uf.userSlug.toLowerCase(), uf.facts);
        totalSaved += saved;
        if (saved > 0) {
          console.log(
            `[memory-flush:${agentId}] saved ${saved} facts for user=${uf.userSlug}`
          );
        }
      }
    }

    // Save journal
    if (extracted.journal) {
      const saved = saveJournal(agentId, extracted.journal);
      if (saved) {
        totalSaved++;
        console.log(`[memory-flush:${agentId}] saved journal entry`);
      }
    }

    console.log(`[memory-flush:${agentId}] done, totalSaved=${totalSaved}`);
    return { success: true, didWrite: totalSaved > 0 };
  } catch (err) {
    console.error(`[memory-flush:${agentId}] failed:`, err);
    return { success: false, didWrite: false };
  }
}
