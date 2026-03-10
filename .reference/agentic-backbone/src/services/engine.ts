import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { eventBus } from "../events/index.js";
import { deliverToChannel } from "../channels/system-channel.js";
import { CONTEXT_DIR } from "../context/paths.js";
import { loadMetadata } from "../context/metadata-loader.js";
import { resolveProvider } from "../settings/llm.js";
import type { ServiceSession, InvokeServiceInput, ServiceSummary, ServiceStatus, ServiceConfig } from "./types.js";

// --- Constants ---

const MAX_OUTPUT_CHARS = 50_000;
const TAIL_CHARS = 1_000;
const SERVICE_TTL_MS = 15 * 60 * 1000; // 15min
const DEFAULT_TIMEOUT_S = 300; // 5min
const SWEEP_INTERVAL_MS = 60 * 1000; // 1min

// --- State ---

const runningServices = new Map<string, ServiceSession>();
const finishedServices = new Map<string, ServiceSession>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

// --- SERVICE.yaml resolution ---

export function resolveServiceConfig(slug: string, agentId?: string): ServiceConfig | null {
  const dirs: string[] = [
    join(CONTEXT_DIR, "services", slug),
    join(CONTEXT_DIR, "shared", "services", slug),
  ];
  if (agentId) {
    dirs.push(join(CONTEXT_DIR, "agents", agentId, "services", slug));
  }

  for (const dir of dirs) {
    const result = loadMetadata(dir, "SERVICE");
    if (result) return result.data as unknown as ServiceConfig;
  }
  return null;
}

// --- List available services from filesystem ---

export function listAvailableServices(agentId?: string): { slug: string; config: ServiceConfig; source: string }[] {
  const result = new Map<string, { slug: string; config: ServiceConfig; source: string }>();

  const dirs: { path: string; source: string }[] = [
    { path: join(CONTEXT_DIR, "services"), source: "stateless" },
    { path: join(CONTEXT_DIR, "shared", "services"), source: "shared" },
  ];

  if (agentId) {
    dirs.push({ path: join(CONTEXT_DIR, "agents", agentId, "services"), source: `agent:${agentId}` });
  }

  for (const { path: dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const slug of readdirSync(dir)) {
      const meta = loadMetadata(join(dir, slug), "SERVICE");
      if (meta) {
        result.set(slug, { slug, config: meta.data as unknown as ServiceConfig, source });
      }
    }
  }

  return [...result.values()];
}

// --- Output buffering ---

function appendOutput(session: ServiceSession, stream: "stdout" | "stderr", chunk: string): void {
  session[stream] += chunk;
  session.totalOutputChars += chunk.length;
  if (session[stream].length > MAX_OUTPUT_CHARS) {
    session[stream] = session[stream].slice(-MAX_OUTPUT_CHARS);
    session.truncated = true;
  }
  session.tail = (session.stdout + session.stderr).slice(-TAIL_CHARS);
}

// --- Finalize ---

function finalizeService(session: ServiceSession, code: number | null, signal: string | null, statusOverride?: ServiceStatus): void {
  if (session._timeoutTimer) {
    clearTimeout(session._timeoutTimer);
    session._timeoutTimer = undefined;
  }

  session.status = statusOverride ?? (code === 0 ? "completed" : "failed");
  session.exitCode = code;
  session.exitSignal = signal;
  session.endedAt = Date.now();
  session.durationMs = session.endedAt - session.startedAt;

  // Destroy stdio
  session._child?.stdout?.destroy();
  session._child?.stderr?.destroy();
  session._child = undefined;

  // Move to finished
  runningServices.delete(session.id);
  finishedServices.set(session.id, session);

  console.log(
    `[services] ${session.id} ${session.status} (pid=${session.pid}, exit=${code}, signal=${signal}, ${session.durationMs}ms)`
  );

  // Emit event
  eventBus.emit("service:status", {
    ts: Date.now(),
    serviceId: session.id,
    agentId: session.agentId,
    slug: session.slug,
    status: session.status,
    pid: session.pid,
    exitCode: code,
    durationMs: session.durationMs,
    tail: session.tail,
  });

  const result = JSON.stringify({
    serviceId: session.id,
    slug: session.slug,
    status: session.status,
    exitCode: code,
    durationMs: session.durationMs,
    tail: session.tail,
  });

  // Channel notification
  if (session.channel && session.agentId) {
    deliverToChannel(session.channel, session.agentId, result);
  }

  // Callback webhook (fire-and-forget, no retry)
  if (session.callback) {
    fetch(session.callback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: result,
    }).catch((err) =>
      console.error(`[services] callback failed for ${session.id}:`, err)
    );
  }
}

// --- Summarize ---

function toSummary(session: ServiceSession): ServiceSummary {
  return {
    id: session.id,
    agentId: session.agentId,
    slug: session.slug,
    pid: session.pid,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    exitCode: session.exitCode,
    tail: session.tail,
    truncated: session.truncated,
  };
}

// --- Resolve handler script path ---

function resolveHandlerScript(slug: string, config: ServiceConfig, agentId?: string): string | null {
  if (config.handler) return config.handler;

  // Search for handler.mjs in the same directory as SERVICE.yaml
  const searchPaths: string[] = [];
  searchPaths.push(join(CONTEXT_DIR, "services", slug, "handler.mjs"));
  searchPaths.push(join(CONTEXT_DIR, "shared", "services", slug, "handler.mjs"));
  if (agentId) {
    searchPaths.push(join(CONTEXT_DIR, "agents", agentId, "services", slug, "handler.mjs"));
  }

  for (const path of searchPaths) {
    if (existsSync(path)) return path;
  }

  return null;
}

// --- Resolve prompt.md path ---

function resolvePromptPath(slug: string, config: ServiceConfig, agentId?: string): string | null {
  if (config.prompt) return config.prompt;

  const searchPaths: string[] = [];
  searchPaths.push(join(CONTEXT_DIR, "services", slug, "prompt.md"));
  searchPaths.push(join(CONTEXT_DIR, "shared", "services", slug, "prompt.md"));
  if (agentId) {
    searchPaths.push(join(CONTEXT_DIR, "agents", agentId, "services", slug, "prompt.md"));
  }

  for (const path of searchPaths) {
    if (existsSync(path)) return path;
  }

  return null;
}

// --- Public API ---

export function invokeService(input: InvokeServiceInput): ServiceSummary {
  const id = randomUUID();
  const timeoutS = input.timeout ?? DEFAULT_TIMEOUT_S;
  const timeoutMs = timeoutS * 1000;
  const cwd = process.cwd();
  const serviceInput = input.input ?? {};

  // Resolve SERVICE.yaml config
  const config = resolveServiceConfig(input.slug, input.agentId);

  // Script mode: find handler
  const handlerScript = config
    ? resolveHandlerScript(input.slug, config, input.agentId)
    : null;

  if (!handlerScript) {
    throw new Error(`No handler script found for service "${input.slug}"`);
  }

  const child = spawn("node", [handlerScript, "--payload", JSON.stringify(serviceInput)], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...(input.agentId ? { AGENT_ID: input.agentId } : {}) },
  });

  const session: ServiceSession = {
    id,
    agentId: input.agentId,
    slug: input.slug,
    input: serviceInput,
    cwd,
    pid: child.pid!,
    startedAt: Date.now(),
    stdout: "",
    stderr: "",
    tail: "",
    totalOutputChars: 0,
    truncated: false,
    status: "running",
    timeoutMs,
    channel: input.channel,
    callback: input.callback,
    _child: child,
  };

  // Capture output
  child.stdout!.on("data", (chunk: Buffer) => {
    appendOutput(session, "stdout", chunk.toString());
  });
  child.stderr!.on("data", (chunk: Buffer) => {
    appendOutput(session, "stderr", chunk.toString());
  });

  // Timeout
  session._timeoutTimer = setTimeout(() => {
    if (session.status === "running") {
      console.log(`[services] ${id} timeout after ${timeoutS}s — sending SIGKILL`);
      child.kill("SIGKILL");
      finalizeService(session, null, "SIGKILL", "timeout");
    }
  }, timeoutMs);

  // On exit
  child.on("exit", (code, signal) => {
    if (session.status === "running") {
      finalizeService(session, code, signal);
    }
  });

  // On error (spawn failure)
  child.on("error", (err) => {
    if (session.status === "running") {
      session.stderr += `\nSpawn error: ${err.message}`;
      finalizeService(session, 1, null);
    }
  });

  runningServices.set(id, session);
  console.log(`[services] invoked ${id} (pid=${child.pid}, slug=${input.slug}, agent=${input.agentId ?? "none"}, timeout=${timeoutS}s): ${handlerScript}`);

  return toSummary(session);
}

export async function invokeLlmService(input: {
  slug: string;
  agentId?: string;
  input?: Record<string, unknown>;
}): Promise<{ output: string }> {
  const config = resolveServiceConfig(input.slug, input.agentId);
  if (!config) {
    throw new Error(`No SERVICE.yaml found for service "${input.slug}"`);
  }
  if (config.mode !== "llm") {
    throw new Error(`Service "${input.slug}" is mode "${config.mode}", not "llm"`);
  }

  const promptPath = resolvePromptPath(input.slug, config, input.agentId);
  if (!promptPath) {
    throw new Error(`No prompt.md found for LLM service "${input.slug}"`);
  }

  let promptTemplate = readFileSync(promptPath, "utf-8");

  // Render {{variable}} placeholders with input fields
  const serviceInput = input.input ?? {};
  for (const [key, value] of Object.entries(serviceInput)) {
    promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, String(value ?? ""));
  }

  const provider = resolveProvider();

  if (provider === "kai") {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) throw new Error("Missing OPENROUTER_API_KEY for kai provider");
    const model = config.model ?? process.env.KAI_DEFAULT_MODEL ?? "google/gemini-2.5-flash";
    console.log(`[services] invokeLlmService slug=${input.slug} provider=kai model=${model} agent=${input.agentId ?? "none"}`);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [
          { role: "system", content: "You must respond exclusively in Brazilian Portuguese (pt-BR). Never mix languages or output characters from other writing systems (Chinese, Japanese, Arabic, etc.)." },
          { role: "user", content: promptTemplate },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? `OpenRouter HTTP ${res.status}`);
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return { output: data.choices[0]?.message?.content ?? "" };
  }

  const model = config.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  console.log(`[services] invokeLlmService slug=${input.slug} provider=claude model=${model} agent=${input.agentId ?? "none"}`);
  const client = new Anthropic();
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: "You must respond exclusively in Brazilian Portuguese (pt-BR). Never mix languages or output characters from other writing systems (Chinese, Japanese, Arabic, etc.).",
    messages: [{ role: "user", content: promptTemplate }],
  });
  const output = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  return { output };
}

export function getService(serviceId: string): ServiceSummary | null {
  const session = runningServices.get(serviceId) ?? finishedServices.get(serviceId);
  return session ? toSummary(session) : null;
}

export function listServices(agentId?: string): ServiceSummary[] {
  const all = [...runningServices.values(), ...finishedServices.values()];
  const filtered = agentId ? all.filter((s) => s.agentId === agentId) : all;
  return filtered.map(toSummary);
}

export function killService(serviceId: string): boolean {
  const session = runningServices.get(serviceId);
  if (!session) return false;

  console.log(`[services] killing ${serviceId} (pid=${session.pid})`);
  session._child?.kill("SIGKILL");

  if (session.status === "running") {
    finalizeService(session, null, "SIGKILL", "killed");
  }
  return true;
}

export function clearService(serviceId: string): boolean {
  return finishedServices.delete(serviceId);
}

// --- Sweeper ---

export function startServiceSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    let cleared = 0;
    for (const [id, session] of finishedServices) {
      if (session.endedAt && now - session.endedAt > SERVICE_TTL_MS) {
        finishedServices.delete(id);
        cleared++;
      }
    }
    if (cleared > 0) {
      console.log(`[services] sweeper cleared ${cleared} expired service(s)`);
    }
  }, SWEEP_INTERVAL_MS);
}

export function stopServiceSweeper(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

// --- Shutdown ---

export function shutdownAllServices(): void {
  for (const [id, session] of runningServices) {
    console.log(`[services] shutdown: killing ${id} (pid=${session.pid})`);
    session._child?.kill("SIGKILL");
    if (session.status === "running") {
      session.status = "failed";
      session.endedAt = Date.now();
      session.durationMs = session.endedAt - session.startedAt;
      if (session._timeoutTimer) {
        clearTimeout(session._timeoutTimer);
        session._timeoutTimer = undefined;
      }
      session._child = undefined;
      runningServices.delete(id);
      finishedServices.set(id, session);
    }
  }
}
