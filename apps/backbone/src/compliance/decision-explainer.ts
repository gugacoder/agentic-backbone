import { db } from "../db/index.js";
import { getTrace, type Trace, type TraceType } from "../traces/index.js";

// ---------- Types ------------------------------------------------------------

export interface HumanApprovalInfo {
  required: boolean;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
}

export interface DecisionExplanation {
  traceId: string;
  agentId: string;
  timestamp: string;
  input: string;
  decision: string;
  reasoning: string;
  toolsUsed: string[];
  instructionVersion: string;
  memoryContext: string[];
  humanApproval?: HumanApprovalInfo;
}

// ---------- Helpers ----------------------------------------------------------

interface ApprovalRow {
  id: number;
  agent_id: string;
  session_id: string | null;
  tool_name: string;
  action_label: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

interface VersionRow {
  version_num: number;
  file_name: string;
  created_at: string;
  created_by: string | null;
  change_note: string | null;
}

const selectApprovalsBySession = db.prepare<{ session_id: string }, ApprovalRow>(
  `SELECT * FROM approval_requests WHERE session_id = :session_id ORDER BY created_at DESC LIMIT 1`
);

const selectApprovalsByAgent = db.prepare<{ agent_id: string }, ApprovalRow>(
  `SELECT * FROM approval_requests WHERE agent_id = :agent_id ORDER BY created_at DESC LIMIT 1`
);

const selectLatestVersion = db.prepare<{ agent_id: string }, VersionRow>(
  `SELECT * FROM config_versions WHERE agent_id = :agent_id ORDER BY version_num DESC LIMIT 1`
);

function getHumanApproval(
  agentId: string,
  sessionId: string | null
): HumanApprovalInfo | undefined {
  let row: ApprovalRow | undefined;

  if (sessionId) {
    row = selectApprovalsBySession.get({ session_id: sessionId }) ?? undefined;
  }
  if (!row) {
    row = selectApprovalsByAgent.get({ agent_id: agentId }) ?? undefined;
  }
  if (!row) return undefined;

  return {
    required: true,
    approved: row.status === "approved",
    approvedBy: row.decided_by ?? "unknown",
    approvedAt: row.decided_at ?? row.created_at,
  };
}

function getInstructionVersion(agentId: string): string {
  const row = selectLatestVersion.get({ agent_id: agentId });
  if (!row) return "v1 (sem histórico de versões)";
  return `v${row.version_num} — ${row.file_name} (${row.created_at})`;
}

function extractInput(trace: Trace): string {
  const firstStep = trace.steps.find((s) => s.type === "text" && s.content);
  return firstStep?.content ?? "(entrada não disponível)";
}

function extractDecisionAndReasoning(trace: Trace): { decision: string; reasoning: string } {
  const textSteps = trace.steps.filter((s) => s.type === "text" && s.content);

  if (textSteps.length === 0) {
    return {
      decision: "(decisão não disponível — trace sem conteúdo de texto)",
      reasoning: "(raciocínio não disponível)",
    };
  }

  // Last text step = final decision / response
  const lastText = textSteps[textSteps.length - 1];
  const decision = lastText?.content ?? "(decisão não disponível)";

  // Intermediate text steps = reasoning chain
  const reasoningSteps = textSteps.slice(0, -1);
  const reasoning =
    reasoningSteps.length > 0
      ? reasoningSteps.map((s) => s.content).join("\n\n")
      : "(raciocínio não registrado — agente respondeu diretamente)";

  return { decision, reasoning };
}

function extractToolsUsed(trace: Trace): string[] {
  const tools = new Set<string>();
  for (const step of trace.steps) {
    if (step.type === "tool_call" && step.toolName) {
      tools.add(step.toolName);
    }
  }
  return Array.from(tools);
}

function extractMemoryContext(trace: Trace): string[] {
  // Memory retrieval appears as tool results from memory-search tools
  const memoryItems: string[] = [];
  for (const step of trace.steps) {
    if (
      step.type === "tool_result" &&
      step.toolName &&
      (step.toolName.includes("memory") || step.toolName.includes("search"))
    ) {
      const output = step.toolOutput;
      if (typeof output === "string" && output.trim()) {
        memoryItems.push(output.slice(0, 200));
      } else if (Array.isArray(output)) {
        for (const item of output) {
          if (typeof item === "string") memoryItems.push(item.slice(0, 200));
          else if (typeof item === "object" && item !== null) {
            const text = (item as Record<string, unknown>)["text"] ?? (item as Record<string, unknown>)["content"];
            if (typeof text === "string") memoryItems.push(text.slice(0, 200));
          }
        }
      }
    }
  }
  return memoryItems;
}

// ---------- Public API -------------------------------------------------------

/**
 * Generate a human-readable DecisionExplanation from a trace.
 * Returns null if the trace does not exist.
 */
export function explainDecision(
  traceType: TraceType,
  traceId: string
): DecisionExplanation | null {
  const trace = getTrace(traceType, traceId);
  if (!trace) return null;

  const { decision, reasoning } = extractDecisionAndReasoning(trace);

  // For conversations, the traceId is the sessionId
  const sessionId = traceType === "conversation" ? traceId : null;

  return {
    traceId,
    agentId: trace.agentId,
    timestamp: trace.startedAt,
    input: extractInput(trace),
    decision,
    reasoning,
    toolsUsed: extractToolsUsed(trace),
    instructionVersion: getInstructionVersion(trace.agentId),
    memoryContext: extractMemoryContext(trace),
    humanApproval: getHumanApproval(trace.agentId, sessionId),
  };
}
