import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { db } from "../db/index.js";
import { systemDir, agentDir } from "../context/paths.js";
import { listAgents } from "../agents/registry.js";

export const workflowRoutes = new Hono();

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowCondition {
  type: "keyword" | "intent" | "sentiment" | "schedule" | "channel" | "fallback";
  value?: string;
  days?: string[];
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  label: string;
  position: { x: number; y: number };
  isEntry?: boolean;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition: WorkflowCondition;
  label: string;
}

export interface Workflow {
  id: string;
  label: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ── Storage ─────────────────────────────────────────────────────────────────

function workflowsStorageDir(): string {
  return join(systemDir(), "workflows");
}

function workflowPath(workflowId: string): string {
  return join(workflowsStorageDir(), `${workflowId}.json`);
}

function ensureWorkflowsDir(): void {
  mkdirSync(workflowsStorageDir(), { recursive: true });
}

function readWorkflow(workflowId: string): Workflow | null {
  const path = workflowPath(workflowId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Workflow;
  } catch {
    return null;
  }
}

function writeWorkflow(wf: Workflow): void {
  ensureWorkflowsDir();
  writeFileSync(workflowPath(wf.id), JSON.stringify(wf, null, 2), "utf-8");
}

function listWorkflows(): Workflow[] {
  ensureWorkflowsDir();
  const dir = workflowsStorageDir();
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json"))
    : [];
  const result: Workflow[] = [];
  for (const f of files) {
    try {
      result.push(JSON.parse(readFileSync(join(dir, f), "utf-8")) as Workflow);
    } catch {
      // skip malformed files
    }
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ── CRUD ────────────────────────────────────────────────────────────────────

// GET /workflows — list all workflows
workflowRoutes.get("/workflows", (c) => {
  return c.json(listWorkflows());
});

// POST /workflows — create workflow
workflowRoutes.post("/workflows", async (c) => {
  const body = await c.req.json<Partial<Workflow>>();

  if (!body.label) {
    return c.json({ error: "label is required" }, 400);
  }

  const now = new Date().toISOString();
  const id = body.id ?? `wf-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  if (existsSync(workflowPath(id))) {
    return c.json({ error: `Workflow '${id}' already exists` }, 409);
  }

  const wf: Workflow = {
    id,
    label: body.label,
    version: 1,
    createdAt: now,
    updatedAt: now,
    nodes: body.nodes ?? [],
    edges: body.edges ?? [],
  };

  writeWorkflow(wf);
  return c.json(wf, 201);
});

// GET /workflows/:id — get workflow
workflowRoutes.get("/workflows/:id", (c) => {
  const wf = readWorkflow(c.req.param("id"));
  if (!wf) return c.json({ error: "Workflow not found" }, 404);
  return c.json(wf);
});

// PUT /workflows/:id — update workflow
workflowRoutes.put("/workflows/:id", async (c) => {
  const id = c.req.param("id");
  const existing = readWorkflow(id);
  if (!existing) return c.json({ error: "Workflow not found" }, 404);

  const body = await c.req.json<Partial<Workflow>>();

  const updated: Workflow = {
    ...existing,
    label: body.label ?? existing.label,
    nodes: body.nodes ?? existing.nodes,
    edges: body.edges ?? existing.edges,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };

  writeWorkflow(updated);
  return c.json(updated);
});

// DELETE /workflows/:id — delete workflow
workflowRoutes.delete("/workflows/:id", (c) => {
  const id = c.req.param("id");
  const path = workflowPath(id);
  if (!existsSync(path)) return c.json({ error: "Workflow not found" }, 404);
  unlinkSync(path);
  return c.json({ deleted: true, id });
});

// ── Apply ────────────────────────────────────────────────────────────────────

/**
 * Converts a workflow edge condition to a trigger_intent string for the DB
 * (used by the LLM-based routing in conversations/index.ts).
 */
function conditionToTriggerIntent(cond: WorkflowCondition, label: string): string {
  switch (cond.type) {
    case "keyword":
      return `keyword: ${cond.value ?? ".*"} — ${label}`;
    case "intent":
      return `intent: ${cond.value ?? ".*"} — ${label}`;
    case "sentiment":
      return `sentiment: ${cond.value ?? "any"} — ${label}`;
    case "schedule":
      return `schedule: ${cond.value ?? "00:00-23:59"} (${(cond.days ?? []).join(",") || "all"}) — ${label}`;
    case "channel":
      return `channel: ${cond.value ?? "any"} — ${label}`;
    case "fallback":
      return `fallback (default route) — ${label}`;
  }
}

/**
 * Reads AGENT.md using raw YAML frontmatter so we can preserve/update
 * array-valued fields like `handoff`.
 */
function readAgentMdRaw(agentId: string): { frontmatter: Record<string, unknown>; body: string } {
  const path = join(agentDir(agentId), "AGENT.md");
  if (!existsSync(path)) {
    return { frontmatter: {}, body: "" };
  }
  const raw = readFileSync(path, "utf-8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = (yaml.load(match[1]) ?? {}) as Record<string, unknown>;
  } catch {
    frontmatter = {};
  }
  return { frontmatter, body: match[2] };
}

function writeAgentMd(agentId: string, frontmatter: Record<string, unknown>, body: string): void {
  const path = join(agentDir(agentId), "AGENT.md");
  const fm = yaml.dump(frontmatter, { lineWidth: -1 }).trimEnd();
  writeFileSync(path, `---\n${fm}\n---\n${body}`, "utf-8");
}

// POST /workflows/:id/apply — apply workflow to agents
workflowRoutes.post("/workflows/:id/apply", (c) => {
  const wf = readWorkflow(c.req.param("id"));
  if (!wf) return c.json({ error: "Workflow not found" }, 404);

  const knownAgentIds = new Set(listAgents().map((a) => a.id));
  const agentsUpdated: string[] = [];
  const warnings: string[] = [];

  // Build edge map: source nodeId → edges from that node
  const edgesBySourceNode = new Map<string, WorkflowEdge[]>();
  for (const edge of wf.edges) {
    const list = edgesBySourceNode.get(edge.from) ?? [];
    list.push(edge);
    edgesBySourceNode.set(edge.from, list);
  }

  // Node lookup by id
  const nodeById = new Map(wf.nodes.map((n) => [n.id, n]));

  for (const node of wf.nodes) {
    const outEdges = edgesBySourceNode.get(node.id);
    if (!outEdges || outEdges.length === 0) continue;

    const sourceAgentId = node.agentId;

    if (!knownAgentIds.has(sourceAgentId)) {
      warnings.push(`Agent '${sourceAgentId}' not found in registry — skipped`);
      continue;
    }

    // Build handoff entries for AGENT.md frontmatter
    const handoffEntries = outEdges.map((edge) => {
      const targetNode = nodeById.get(edge.to);
      const condValue = buildConditionRegex(edge.condition);
      return {
        target: targetNode?.agentId ?? edge.to,
        condition: condValue,
        label: edge.label,
      };
    });

    // Write to AGENT.md frontmatter
    const { frontmatter, body } = readAgentMdRaw(sourceAgentId);
    frontmatter["handoff"] = handoffEntries;
    try {
      writeAgentMd(sourceAgentId, frontmatter, body);
    } catch (err) {
      warnings.push(`Failed to write AGENT.md for '${sourceAgentId}': ${String(err)}`);
    }

    // Sync to agent_handoffs DB — delete existing for this supervisor, re-insert
    db.prepare("DELETE FROM agent_handoffs WHERE supervisor_id = ?").run(sourceAgentId);

    let priority = 0;
    for (const edge of outEdges) {
      const targetNode = nodeById.get(edge.to);
      const targetAgentId = targetNode?.agentId ?? edge.to;
      const triggerIntent = conditionToTriggerIntent(edge.condition, edge.label);

      try {
        db.prepare(
          `INSERT INTO agent_handoffs (supervisor_id, member_id, label, trigger_intent, priority)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(supervisor_id, member_id) DO UPDATE SET
             label          = excluded.label,
             trigger_intent = excluded.trigger_intent,
             priority       = excluded.priority`
        ).run(sourceAgentId, targetAgentId, edge.label, triggerIntent, priority++);
      } catch (err) {
        warnings.push(`DB insert failed for edge '${edge.id}': ${String(err)}`);
      }
    }

    if (!agentsUpdated.includes(sourceAgentId)) {
      agentsUpdated.push(sourceAgentId);
    }
  }

  return c.json({ applied: true, agentsUpdated, warnings });
});

/**
 * Converts a WorkflowCondition to a regex string for AGENT.md frontmatter.
 * `fallback` uses ".*" (matches everything).
 */
function buildConditionRegex(cond: WorkflowCondition): string {
  switch (cond.type) {
    case "keyword":
    case "intent":
      return cond.value ?? ".*";
    case "sentiment":
      if (cond.value === "positive") return "(bom|ótimo|excelente|obrigado|gostei|feliz|amor|adoro|perfeito)";
      if (cond.value === "negative") return "(ruim|péssimo|horrível|raiva|ódio|terrível|problema|falha|erro)";
      return ".*"; // neutral — matches all
    case "schedule":
      // schedule conditions are time-based, not text-based; use ".*" as placeholder
      return ".*";
    case "channel":
      return cond.value ?? ".*";
    case "fallback":
      return ".*";
  }
}

// ── Simulate ─────────────────────────────────────────────────────────────────

interface SimulateRequest {
  input: string;
  startNodeId: string;
  channelType?: string;
}

interface SimulateResponse {
  path: string[];
  matchedEdge: string | null;
  matchedCondition: WorkflowCondition | null;
  selectedAgent: string | null;
  reasoning: string;
}

function evaluateCondition(
  cond: WorkflowCondition,
  input: string,
  channelType?: string
): { matched: boolean; reasoning: string } {
  switch (cond.type) {
    case "keyword": {
      const pattern = cond.value ?? ".*";
      try {
        const matched = new RegExp(pattern, "i").test(input);
        return {
          matched,
          reasoning: matched
            ? `Input corresponde ao regex de keyword '${pattern}'`
            : `Input não corresponde ao regex de keyword '${pattern}'`,
        };
      } catch {
        return { matched: false, reasoning: `Regex inválido: '${pattern}'` };
      }
    }

    case "intent": {
      const terms = (cond.value ?? "").split("|").map((t) => t.trim()).filter(Boolean);
      for (const term of terms) {
        try {
          if (new RegExp(term, "i").test(input)) {
            return {
              matched: true,
              reasoning: `Input contém '${term}' — intent '${cond.value}' satisfeita`,
            };
          }
        } catch {
          // skip bad regex
        }
      }
      return {
        matched: false,
        reasoning: `Nenhum dos termos de intent (${cond.value}) encontrado no input`,
      };
    }

    case "sentiment": {
      const target = cond.value ?? "neutral";
      const detected = detectSentiment(input);
      const matched = detected === target;
      return {
        matched,
        reasoning: `Sentimento detectado: '${detected}', condição requer: '${target}'`,
      };
    }

    case "schedule": {
      const { matched, reasoning } = evaluateSchedule(cond);
      return { matched, reasoning };
    }

    case "channel": {
      const target = cond.value ?? "";
      const matched = channelType === target;
      return {
        matched,
        reasoning: matched
          ? `Canal '${channelType}' corresponde à condição '${target}'`
          : `Canal '${channelType}' não corresponde à condição '${target}'`,
      };
    }

    case "fallback":
      return {
        matched: true,
        reasoning: "Condição fallback — rota padrão sempre satisfeita",
      };
  }
}

function detectSentiment(text: string): "positive" | "negative" | "neutral" {
  const positive = /\b(bom|ótimo|excelente|obrigado|gostei|feliz|amor|adoro|perfeito|boa|parabéns|incrível|maravilhoso|top|great|good|thanks|awesome|love|perfect)\b/i;
  const negative = /\b(ruim|péssimo|horrível|raiva|ódio|terrível|problema|falha|erro|insatisfeito|decepcionado|bad|terrible|awful|hate|fail|problem|issue)\b/i;
  if (positive.test(text)) return "positive";
  if (negative.test(text)) return "negative";
  return "neutral";
}

function evaluateSchedule(cond: WorkflowCondition): { matched: boolean; reasoning: string } {
  const now = new Date();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayName = dayNames[now.getDay()]!;

  // Check days if specified
  if (cond.days && cond.days.length > 0) {
    const normalizedDays = cond.days.map((d) => d.toLowerCase());
    if (!normalizedDays.includes(todayName)) {
      return {
        matched: false,
        reasoning: `Hoje é ${todayName}, mas a condição requer: ${cond.days.join(", ")}`,
      };
    }
  }

  // Check time range if specified (format: "HH:MM-HH:MM")
  if (cond.value) {
    const rangeMatch = cond.value.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (rangeMatch) {
      const startMinutes = parseInt(rangeMatch[1]!) * 60 + parseInt(rangeMatch[2]!);
      const endMinutes = parseInt(rangeMatch[3]!) * 60 + parseInt(rangeMatch[4]!);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const inRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
      return {
        matched: inRange,
        reasoning: inRange
          ? `Horário atual (${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}) está dentro do intervalo ${cond.value}`
          : `Horário atual (${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}) fora do intervalo ${cond.value}`,
      };
    }
  }

  return { matched: true, reasoning: "Condição de horário satisfeita (sem restrição de horário)" };
}

// POST /workflows/:id/simulate — simulate routing
workflowRoutes.post("/workflows/:id/simulate", async (c) => {
  const wf = readWorkflow(c.req.param("id"));
  if (!wf) return c.json({ error: "Workflow not found" }, 404);

  const body = await c.req.json<SimulateRequest>();
  const { input, startNodeId, channelType } = body;

  if (!input || !startNodeId) {
    return c.json({ error: "input and startNodeId are required" }, 400);
  }

  const nodeById = new Map(wf.nodes.map((n) => [n.id, n]));
  const startNode = nodeById.get(startNodeId);
  if (!startNode) {
    return c.json({ error: `Node '${startNodeId}' not found in workflow` }, 404);
  }

  // Group edges by source node
  const edgesBySourceNode = new Map<string, WorkflowEdge[]>();
  for (const edge of wf.edges) {
    const list = edgesBySourceNode.get(edge.from) ?? [];
    list.push(edge);
    edgesBySourceNode.set(edge.from, list);
  }

  const path: string[] = [startNodeId];
  let currentNodeId = startNodeId;
  let matchedEdge: WorkflowEdge | null = null;
  let matchedCondition: WorkflowCondition | null = null;
  let reasoning = "";
  const visited = new Set<string>([startNodeId]);

  // Traverse workflow — non-fallback edges first, then fallback
  while (true) {
    const outEdges = edgesBySourceNode.get(currentNodeId) ?? [];
    if (outEdges.length === 0) {
      reasoning = reasoning || "Nó sem arestas de saída — destino final";
      break;
    }

    // Evaluate non-fallback edges first, then fallback
    const nonFallback = outEdges.filter((e) => e.condition.type !== "fallback");
    const fallbacks = outEdges.filter((e) => e.condition.type === "fallback");
    const ordered = [...nonFallback, ...fallbacks];

    let found = false;
    for (const edge of ordered) {
      const { matched, reasoning: edgeReasoning } = evaluateCondition(
        edge.condition,
        input,
        channelType
      );
      if (matched) {
        const targetNode = nodeById.get(edge.to);
        if (!targetNode) {
          reasoning = `Aresta '${edge.id}' aponta para nó inexistente '${edge.to}'`;
          break;
        }
        if (visited.has(edge.to)) {
          reasoning = `Ciclo detectado no nó '${edge.to}' — interrompido`;
          break;
        }

        matchedEdge = edge;
        matchedCondition = edge.condition;
        reasoning = edgeReasoning;
        path.push(edge.to);
        visited.add(edge.to);
        currentNodeId = edge.to;
        found = true;
        break;
      }
    }

    if (!found) {
      reasoning = "Nenhuma condição satisfeita — sem rota para delegação";
      break;
    }
  }

  const finalNode = nodeById.get(currentNodeId);

  const response: SimulateResponse = {
    path,
    matchedEdge: matchedEdge?.id ?? null,
    matchedCondition,
    selectedAgent: finalNode?.agentId ?? null,
    reasoning,
  };

  return c.json(response);
});
