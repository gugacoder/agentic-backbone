import { tool, jsonSchema } from "ai";
import type { ConnectorDef, ConnectorContext } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { mcpClientPool } from "./client.js";
import { formatError } from "../../utils/errors.js";
import {
  activateNotifications,
  deactivateNotifications,
} from "./notification-handler.js";

export { mcpClientPool };
export type { McpNotificationHandler } from "./client.js";

export const mcpConnector: ConnectorDef = {
  slug: "mcp",
  credentialSchema,
  optionsSchema,

  createClient(credential, options) {
    // MCP has no persistent client object returned here —
    // connections are managed by mcpClientPool.
    const cred = credentialSchema.parse(credential);
    const opts = optionsSchema.parse(options);
    return { credential: cred, options: opts };
  },

  createTools(adapters, agentId) {
    if (adapters.length === 0) return null;

    const effectiveAgentId = agentId ?? "unknown";
    const tools: Record<string, any> = {};

    for (const { slug } of adapters) {
      const mcpTools = mcpClientPool.getCachedTools(slug);
      if (mcpTools.length === 0) continue;

      for (const mcpTool of mcpTools) {
        // Prefix: mcp_{adapterSlug}_{toolName}
        // Sanitise: replace any non-alphanumeric chars (except _) with _
        const sanitisedSlug = slug.replace(/[^a-zA-Z0-9]/g, "_");
        const sanitisedName = mcpTool.name.replace(/[^a-zA-Z0-9]/g, "_");
        const toolKey = `mcp_${sanitisedSlug}_${sanitisedName}`;

        // Build JSON Schema — ensure it is at least an empty object schema
        const schema =
          mcpTool.inputSchema &&
          typeof mcpTool.inputSchema === "object" &&
          Object.keys(mcpTool.inputSchema).length > 0
            ? mcpTool.inputSchema
            : { type: "object", properties: {} };

        const adapterSlug = slug;
        const originalToolName = mcpTool.name;

        tools[toolKey] = tool({
          description:
            mcpTool.description ||
            `MCP tool "${mcpTool.name}" from server "${adapterSlug}"`,
          parameters: jsonSchema(schema as Parameters<typeof jsonSchema>[0]),
          execute: async (args) => {
            try {
              const result = await mcpClientPool.callTool(
                adapterSlug,
                originalToolName,
                args,
                effectiveAgentId
              );

              // Activate/deactivate notifications on presence changes
              if (originalToolName === "presence_online") {
                activateNotifications(effectiveAgentId, adapterSlug);
              } else if (originalToolName === "presence_offline") {
                deactivateNotifications(effectiveAgentId);
              }

              return result;
            } catch (err) {
              return { error: formatError(err) };
            }
          },
        });
      }
    }

    return Object.keys(tools).length > 0 ? tools : null;
  },

  async start(ctx: ConnectorContext) {
    const { connectorRegistry } = await import("../index.js");

    // Use findAdapter (unmasked) instead of listAdapters (masked) to get real credentials
    const allAdapters = connectorRegistry.listAdapters();
    const mcpSlugs = allAdapters.filter((a) => a.connector === "mcp").map((a) => a.slug);
    const mcpAdapters = mcpSlugs.map((slug) => connectorRegistry.findAdapter(slug)).filter(Boolean) as typeof allAdapters;

    if (mcpAdapters.length === 0) {
      ctx.log("no MCP adapters configured — pool not started");
      return;
    }

    let connected = 0;
    for (const adapter of mcpAdapters) {
      const credResult = credentialSchema.safeParse(adapter.credential);
      const optsResult = optionsSchema.safeParse(adapter.options);

      if (!credResult.success || !optsResult.success) {
        ctx.log(`invalid config for MCP adapter "${adapter.slug}" — skipping`);
        continue;
      }

      try {
        await mcpClientPool.connect(
          adapter.slug,
          credResult.data,
          optsResult.data
        );
        connected++;
      } catch {
        // Schedule retry for failed adapters
        const slug = adapter.slug;
        const cred = credResult.data;
        const opts = optsResult.data;
        const retryConnect = async (attempt: number) => {
          if (mcpClientPool.isConnected(slug)) return;
          const delay = Math.min(10_000 * attempt, 60_000);
          setTimeout(async () => {
            try {
              await mcpClientPool.connect(slug, cred, opts);
              ctx.log(`connected to "${slug}" on retry #${attempt}`);
            } catch {
              if (attempt < 12) retryConnect(attempt + 1);
              else ctx.log(`gave up connecting to "${slug}" after ${attempt} retries`);
            }
          }, delay);
        };
        retryConnect(1);
      }
    }

    ctx.log(`started — ${connected}/${mcpAdapters.length} MCP adapter(s) connected`);
  },

  async stop() {
    await mcpClientPool.closeAll();
  },

  health() {
    const connected = mcpClientPool.getAllConnected();
    return {
      status: "healthy" as const,
      details: {
        adapters: connected.length,
        servers: connected.map((c) => ({
          slug: c.slug,
          label: c.label,
          tools: c.tools.length,
        })),
      },
    };
  },
};
