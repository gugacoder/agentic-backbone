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

export const connectorRegistry = new ConnectorRegistry();

// --- Data connectors (no lifecycle) ---
connectorRegistry.register(mysqlConnector);
connectorRegistry.register(postgresConnector);

// --- Communication connectors (with lifecycle) ---
connectorRegistry.register(evolutionConnector);
connectorRegistry.register(twilioConnector);
connectorRegistry.register(whatsappCloudConnector);
connectorRegistry.register(slackConnector);
connectorRegistry.register(teamsConnector);
connectorRegistry.register(emailConnector);

// --- Protocol connectors (with lifecycle) ---
connectorRegistry.register(mcpConnector);

export type { ConnectorDef, ConnectorContext, ConnectorHealth, ResolvedAdapter, AdapterInstance } from "./types.js";
