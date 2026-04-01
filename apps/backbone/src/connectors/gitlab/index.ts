import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createGitLabClient } from "@agentic-backbone/gitlab-v4";
import { createGitLabIssuesTool } from "./tools/issues.js";
import { createGitLabMrsTool } from "./tools/mrs.js";
import { createGitLabRepoTool } from "./tools/repo.js";
import { createGitLabCiTool } from "./tools/ci.js";
import { createGitLabLabelsTool } from "./tools/labels.js";
import { createGitLabMilestonesTool } from "./tools/milestones.js";
import { createGitLabReleasesTool } from "./tools/releases.js";
import { createGitLabWikiTool } from "./tools/wiki.js";
import { createGitLabUsersTool } from "./tools/users.js";
import { createGitLabProjectsTool } from "./tools/projects.js";

export const gitlabConnector: ConnectorDef = {
  slug: "gitlab",
  credentialSchema,
  optionsSchema,
  createClient(credential, options) {
    return createGitLabClient(
      credentialSchema.parse(credential),
      optionsSchema.parse(options),
    );
  },
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return {
      ...createGitLabIssuesTool(adapters),
      ...createGitLabMrsTool(adapters),
      ...createGitLabRepoTool(adapters),
      ...createGitLabCiTool(adapters),
      ...createGitLabLabelsTool(adapters),
      ...createGitLabMilestonesTool(adapters),
      ...createGitLabReleasesTool(adapters),
      ...createGitLabWikiTool(adapters),
      ...createGitLabUsersTool(adapters),
      ...createGitLabProjectsTool(adapters),
    };
  },
};
