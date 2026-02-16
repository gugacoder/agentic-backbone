import chokidar, { type FSWatcher } from "chokidar";
import { basename } from "node:path";
import { agentsDir, usersDir, sharedResourceDir } from "../context/paths.js";
import { listAgents, refreshAgentRegistry } from "../agents/registry.js";
import { refreshChannelRegistry } from "../channels/registry.js";
import { updateHeartbeatAgent } from "../heartbeat/index.js";
import { eventBus } from "../events/index.js";

let agentWatcher: FSWatcher | null = null;
let channelWatcher: FSWatcher | null = null;
let adapterWatcher: FSWatcher | null = null;

let agentDebounce: ReturnType<typeof setTimeout> | null = null;
let channelDebounce: ReturnType<typeof setTimeout> | null = null;
let adapterDebounce: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 300;

function handleAgentChange(path: string): void {
  if (basename(path) !== "AGENT.md") return;

  if (agentDebounce) clearTimeout(agentDebounce);
  agentDebounce = setTimeout(() => {
    try {
      const oldAgents = new Set(listAgents().map((a) => a.id));

      refreshAgentRegistry();

      const newAgents = listAgents();
      const newIds = new Set(newAgents.map((a) => a.id));

      // Update heartbeat for changed/added agents
      for (const agent of newAgents) {
        updateHeartbeatAgent(agent.id, agent.heartbeat);
      }

      // Remove agents that no longer exist
      for (const oldId of oldAgents) {
        if (!newIds.has(oldId)) {
          updateHeartbeatAgent(oldId, { enabled: false, intervalMs: 0 });
        }
      }

      eventBus.emit("registry:agents", {
        ts: Date.now(),
        kind: "agents",
        reason: "file-change",
        changedPath: path,
      });

      console.log(`[watchers] agent registry refreshed (trigger: ${path})`);
    } catch (err) {
      console.warn("[watchers] agent refresh failed:", err);
    }
  }, DEBOUNCE_MS);
}

function handleChannelChange(path: string): void {
  if (basename(path) !== "CHANNEL.md") return;

  if (channelDebounce) clearTimeout(channelDebounce);
  channelDebounce = setTimeout(() => {
    try {
      refreshChannelRegistry();

      eventBus.emit("registry:channels", {
        ts: Date.now(),
        kind: "channels",
        reason: "file-change",
        changedPath: path,
      });

      console.log(`[watchers] channel registry refreshed (trigger: ${path})`);
    } catch (err) {
      console.warn("[watchers] channel refresh failed:", err);
    }
  }, DEBOUNCE_MS);
}

function handleAdapterChange(path: string): void {
  if (basename(path) !== "ADAPTER.yaml") return;

  if (adapterDebounce) clearTimeout(adapterDebounce);
  adapterDebounce = setTimeout(() => {
    try {
      eventBus.emit("registry:adapters", {
        ts: Date.now(),
        kind: "adapters",
        reason: "file-change",
        changedPath: path,
      });

      console.log(`[watchers] adapter change detected (trigger: ${path})`);
    } catch (err) {
      console.warn("[watchers] adapter change handler failed:", err);
    }
  }, DEBOUNCE_MS);
}

export function startWatchers(): void {
  const agentsPath = agentsDir();
  const usersPath = usersDir();

  agentWatcher = chokidar.watch(agentsPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  agentWatcher
    .on("add", handleAgentChange)
    .on("change", handleAgentChange)
    .on("unlink", handleAgentChange)
    .on("error", (err) => console.warn("[watchers] agent watcher error:", err));

  channelWatcher = chokidar.watch(usersPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  channelWatcher
    .on("add", handleChannelChange)
    .on("change", handleChannelChange)
    .on("unlink", handleChannelChange)
    .on("error", (err) =>
      console.warn("[watchers] channel watcher error:", err)
    );

  // Adapter watcher — shared adapters dir + agents dir (ADAPTER.yaml changes)
  const sharedAdaptersPath = sharedResourceDir("adapters");
  adapterWatcher = chokidar.watch([sharedAdaptersPath, agentsPath], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  adapterWatcher
    .on("add", handleAdapterChange)
    .on("change", handleAdapterChange)
    .on("unlink", handleAdapterChange)
    .on("error", (err) =>
      console.warn("[watchers] adapter watcher error:", err)
    );

  console.log(`[watchers] watching agents: ${agentsPath}`);
  console.log(`[watchers] watching channels: ${usersPath}`);
  console.log(`[watchers] watching adapters: ${sharedAdaptersPath}`);
}

export function stopWatchers(): void {
  if (agentDebounce) {
    clearTimeout(agentDebounce);
    agentDebounce = null;
  }
  if (channelDebounce) {
    clearTimeout(channelDebounce);
    channelDebounce = null;
  }
  if (agentWatcher) {
    agentWatcher.close();
    agentWatcher = null;
  }
  if (channelWatcher) {
    channelWatcher.close();
    channelWatcher = null;
  }
  if (adapterDebounce) {
    clearTimeout(adapterDebounce);
    adapterDebounce = null;
  }
  if (adapterWatcher) {
    adapterWatcher.close();
    adapterWatcher = null;
  }
}
