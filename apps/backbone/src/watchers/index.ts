import chokidar, { type FSWatcher } from "chokidar";
import { basename, join } from "node:path";
import { agentsDir, usersDir, sharedResourceDir, systemDir } from "../context/paths.js";
import { listAgents, refreshAgentRegistry } from "../agents/registry.js";
import { refreshChannelRegistry } from "../channels/registry.js";
import { updateHeartbeatAgent } from "../heartbeat/index.js";
import { eventBus } from "../events/index.js";
import { connectorRegistry } from "../connectors/index.js";
import { encryptYamlFile } from "../context/encryptor.js";
import { reloadPlans } from "../settings/llm.js";

let agentWatcher: FSWatcher | null = null;
let channelWatcher: FSWatcher | null = null;
let adapterWatcher: FSWatcher | null = null;
let planWatcher: FSWatcher | null = null;

const DEBOUNCE_MS = 300;

function createDebouncedHandler(def: {
  filename: string;
  label: string;
  onTrigger: (path: string) => void;
}) {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  return {
    handler: (path: string) => {
      if (basename(path) !== def.filename) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          def.onTrigger(path);
          console.log(`[watchers] ${def.label} (trigger: ${path})`);
        } catch (err) {
          console.warn(`[watchers] ${def.label} failed:`, err);
        }
      }, DEBOUNCE_MS);
    },
    cleanup: () => {
      if (debounce) {
        clearTimeout(debounce);
        debounce = null;
      }
    },
  };
}

const agentHandler = createDebouncedHandler({
  filename: "AGENT.yml",
  label: "agent registry refreshed",
  onTrigger: (path) => {
    const oldAgents = new Set(listAgents().map((a) => a.id));

    refreshAgentRegistry();

    const newAgents = listAgents();
    const newIds = new Set(newAgents.map((a) => a.id));

    for (const agent of newAgents) {
      updateHeartbeatAgent(agent.id, agent.heartbeat);
    }

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
  },
});

const channelHandler = createDebouncedHandler({
  filename: "CHANNEL.yml",
  label: "channel registry refreshed",
  onTrigger: (path) => {
    refreshChannelRegistry();

    eventBus.emit("registry:channels", {
      ts: Date.now(),
      kind: "channels",
      reason: "file-change",
      changedPath: path,
    });
  },
});

const adapterHandler = createDebouncedHandler({
  filename: "ADAPTER.yml",
  label: "adapter change detected",
  onTrigger: (path) => {
    connectorRegistry.invalidateAllClients();

    eventBus.emit("registry:adapters", {
      ts: Date.now(),
      kind: "adapters",
      reason: "file-change",
      changedPath: path,
    });
  },
});

// Plan/settings watcher — debounced reload on any .yml change in plans/ or settings.yml
const planReloadHandler = (() => {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  return {
    handler: (path: string) => {
      if (!path.endsWith(".yml")) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          reloadPlans();
          console.log(`[watchers] plans reloaded (trigger: ${path})`);
        } catch (err) {
          console.warn("[watchers] plans reload failed:", err);
        }
      }, DEBOUNCE_MS);
    },
    cleanup: () => {
      if (debounce) {
        clearTimeout(debounce);
        debounce = null;
      }
    },
  };
})();

// Auto-encrypt handler for any .yml file change
function handleYmlChange(path: string): void {
  if (!path.endsWith(".yml")) return;
  // Skip non-context files (e.g. .state.json temps)
  if (basename(path).startsWith(".")) return;

  setTimeout(() => {
    try {
      encryptYamlFile(path);
    } catch {
      // ignore — file may be in-flight
    }
  }, DEBOUNCE_MS + 100);
}

export function startWatchers(): void {
  const agentsPath = agentsDir();
  const usersPath = usersDir();

  agentWatcher = chokidar.watch(agentsPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  agentWatcher
    .on("add", agentHandler.handler)
    .on("change", agentHandler.handler)
    .on("unlink", agentHandler.handler)
    .on("add", handleYmlChange)
    .on("change", handleYmlChange)
    .on("error", (err) => console.warn("[watchers] agent watcher error:", err));

  channelWatcher = chokidar.watch(usersPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  channelWatcher
    .on("add", channelHandler.handler)
    .on("change", channelHandler.handler)
    .on("unlink", channelHandler.handler)
    .on("add", handleYmlChange)
    .on("change", handleYmlChange)
    .on("error", (err) =>
      console.warn("[watchers] channel watcher error:", err)
    );

  // Adapter watcher — shared adapters dir + agents dir (ADAPTER.yml changes)
  const sharedAdaptersPath = sharedResourceDir("adapters");
  adapterWatcher = chokidar.watch([sharedAdaptersPath, agentsPath], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  adapterWatcher
    .on("add", adapterHandler.handler)
    .on("change", adapterHandler.handler)
    .on("unlink", adapterHandler.handler)
    .on("add", handleYmlChange)
    .on("change", handleYmlChange)
    .on("error", (err) =>
      console.warn("[watchers] adapter watcher error:", err)
    );

  // Plan watcher — plans dir + settings.yml
  const plansPath = join(systemDir(), "plans");
  const settingsFilePath = join(systemDir(), "settings.yml");
  planWatcher = chokidar.watch([plansPath, settingsFilePath], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  planWatcher
    .on("add", planReloadHandler.handler)
    .on("change", planReloadHandler.handler)
    .on("unlink", planReloadHandler.handler)
    .on("error", (err) => console.warn("[watchers] plan watcher error:", err));

  console.log(`[watchers] watching agents: ${agentsPath}`);
  console.log(`[watchers] watching channels: ${usersPath}`);
  console.log(`[watchers] watching adapters: ${sharedAdaptersPath}`);
  console.log(`[watchers] watching plans: ${plansPath}`);
}

export function stopWatchers(): void {
  agentHandler.cleanup();
  channelHandler.cleanup();
  adapterHandler.cleanup();
  planReloadHandler.cleanup();

  if (agentWatcher) {
    agentWatcher.close();
    agentWatcher = null;
  }
  if (channelWatcher) {
    channelWatcher.close();
    channelWatcher = null;
  }
  if (adapterWatcher) {
    adapterWatcher.close();
    adapterWatcher = null;
  }
  if (planWatcher) {
    planWatcher.close();
    planWatcher = null;
  }
}
