import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createGitLabClient } from "./client.js";
import { createGitLabIssueListTool } from "./tools/issue-list.js";
import { createGitLabIssueCreateTool } from "./tools/issue-create.js";
import { createGitLabIssueUpdateTool } from "./tools/issue-update.js";
import { createGitLabIssueCommentTool } from "./tools/issue-comment.js";
import { createGitLabIssueListCommentsTool } from "./tools/issue-list-comments.js";
import { createGitLabMrListTool } from "./tools/mr-list.js";
import { createGitLabMrCreateTool } from "./tools/mr-create.js";
import { createGitLabMrUpdateTool } from "./tools/mr-update.js";
import { createGitLabMrMergeTool } from "./tools/mr-merge.js";
import { createGitLabMrCommentTool } from "./tools/mr-comment.js";
import { createGitLabMrListCommentsTool } from "./tools/mr-list-comments.js";
import { createGitLabRepoGetFileTool } from "./tools/repo-get-file.js";
import { createGitLabRepoListFilesTool } from "./tools/repo-list-files.js";
import { createGitLabRepoCreateFileTool } from "./tools/repo-create-file.js";
import { createGitLabRepoUpdateFileTool } from "./tools/repo-update-file.js";
import { createGitLabRepoListBranchesTool } from "./tools/repo-list-branches.js";
import { createGitLabRepoCreateBranchTool } from "./tools/repo-create-branch.js";
import { createGitLabRepoListCommitsTool } from "./tools/repo-list-commits.js";
import { createGitLabCiListPipelinesTool } from "./tools/ci-list-pipelines.js";
import { createGitLabCiTriggerPipelineTool } from "./tools/ci-trigger-pipeline.js";
import { createGitLabCiListJobsTool } from "./tools/ci-list-jobs.js";
import { createGitLabCiJobLogTool } from "./tools/ci-job-log.js";
import { createGitLabCiRetryPipelineTool } from "./tools/ci-retry-pipeline.js";
import { createGitLabCiCancelPipelineTool } from "./tools/ci-cancel-pipeline.js";
import { createGitLabProjectSearchTool } from "./tools/project-search.js";
import { createGitLabProjectListMembersTool } from "./tools/project-list-members.js";

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
      ...createGitLabIssueListTool(adapters),
      ...createGitLabIssueCreateTool(adapters),
      ...createGitLabIssueUpdateTool(adapters),
      ...createGitLabIssueCommentTool(adapters),
      ...createGitLabIssueListCommentsTool(adapters),
      ...createGitLabMrListTool(adapters),
      ...createGitLabMrCreateTool(adapters),
      ...createGitLabMrUpdateTool(adapters),
      ...createGitLabMrMergeTool(adapters),
      ...createGitLabMrCommentTool(adapters),
      ...createGitLabMrListCommentsTool(adapters),
      ...createGitLabRepoGetFileTool(adapters),
      ...createGitLabRepoListFilesTool(adapters),
      ...createGitLabRepoCreateFileTool(adapters),
      ...createGitLabRepoUpdateFileTool(adapters),
      ...createGitLabRepoListBranchesTool(adapters),
      ...createGitLabRepoCreateBranchTool(adapters),
      ...createGitLabRepoListCommitsTool(adapters),
      ...createGitLabCiListPipelinesTool(adapters),
      ...createGitLabCiTriggerPipelineTool(adapters),
      ...createGitLabCiListJobsTool(adapters),
      ...createGitLabCiJobLogTool(adapters),
      ...createGitLabCiRetryPipelineTool(adapters),
      ...createGitLabCiCancelPipelineTool(adapters),
      ...createGitLabProjectSearchTool(adapters),
      ...createGitLabProjectListMembersTool(adapters),
    };
  },
};