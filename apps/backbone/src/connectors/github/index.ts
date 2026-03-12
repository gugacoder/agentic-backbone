import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createGitHubClient } from "./client.js";
import { createGitHubListIssuesTool } from "./tools/list-issues.js";
import { createGitHubCreateIssueTool } from "./tools/create-issue.js";
import { createGitHubListPrsTool } from "./tools/list-prs.js";
import { createGitHubGetFileTool } from "./tools/get-file.js";
import { createGitHubSearchTool } from "./tools/search.js";

export const githubConnector: ConnectorDef = {
  slug: "github",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createGitHubClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return {
      ...createGitHubListIssuesTool(adapters),
      ...createGitHubCreateIssueTool(adapters),
      ...createGitHubListPrsTool(adapters),
      ...createGitHubGetFileTool(adapters),
      ...createGitHubSearchTool(adapters),
    };
  },
};
