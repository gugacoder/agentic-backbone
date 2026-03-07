import { ConnectorRegistry } from "./registry.js";
import { mysqlConnector } from "./mysql/index.js";
import { postgresConnector } from "./postgres/index.js";
import { evolutionConnector } from "./evolution/index.js";
import { twilioConnector } from "./twilio/index.js";

export const connectorRegistry = new ConnectorRegistry();

// --- Data connectors (no lifecycle) ---
connectorRegistry.register(mysqlConnector);
connectorRegistry.register(postgresConnector);

// --- Communication connectors (with lifecycle) ---
connectorRegistry.register(evolutionConnector);
connectorRegistry.register(twilioConnector);

export type { ConnectorDef, ConnectorContext, ConnectorHealth, ResolvedAdapter, AdapterInstance } from "./types.js";
