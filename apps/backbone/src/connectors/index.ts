import { ConnectorRegistry } from "./registry.js";
import { mysqlConnector } from "./mysql/index.js";
import { postgresConnector } from "./postgres/index.js";
import { evolutionConnector } from "./evolution/index.js";
import { twilioConnector } from "./twilio/index.js";
import { whatsappCloudConnector } from "./whatsapp-cloud/index.js";
import { slackConnector } from "./slack/index.js";
import { teamsConnector } from "./teams/index.js";
import { emailConnector } from "./email/index.js";
import { mcpConnector } from "./mcp/index.js";
import { elevenLabsConnector } from "./elevenlabs/index.js";
import { httpConnector } from "./http/index.js";
import { gitlabConnector } from "./gitlab/index.js";
import { githubConnector } from "./github/index.js";
import { discordConnector } from "./discord/index.js";

export const connectorRegistry = new ConnectorRegistry();

// --- Data connectors (no lifecycle) ---
connectorRegistry.register(mysqlConnector);
connectorRegistry.register(postgresConnector);
connectorRegistry.register(elevenLabsConnector);
connectorRegistry.register(gitlabConnector);
connectorRegistry.register(githubConnector);
connectorRegistry.register(discordConnector);

// --- Communication connectors (with lifecycle) ---
connectorRegistry.register(evolutionConnector);
connectorRegistry.register(twilioConnector);
connectorRegistry.register(whatsappCloudConnector);
connectorRegistry.register(slackConnector);
connectorRegistry.register(teamsConnector);
connectorRegistry.register(emailConnector);

// --- Protocol connectors (with lifecycle) ---
connectorRegistry.register(mcpConnector);

// --- HTTP connector ---
connectorRegistry.register(httpConnector);

export type { ConnectorDef, ConnectorContext, ConnectorHealth, ResolvedAdapter, AdapterInstance } from "./types.js";
