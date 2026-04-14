import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "../gitlab/schemas.js";
import { createGitLabClient } from "../gitlab/client.js";
import { createGitLabIssuesTool } from "../gitlab/tools/issues.js";
import { createGitLabMrsTool } from "../gitlab/tools/mrs.js";
import { createGitLabRepoTool } from "../gitlab/tools/repo.js";
import { createGitLabCiTool } from "../gitlab/tools/ci.js";
import { createGitLabProjectsTool } from "../gitlab/tools/projects.js";

export const implantacaoConnector: ConnectorDef = {
  slug: "implantacao",
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
      ...createGitLabProjectsTool(adapters),
    };
  },
};
