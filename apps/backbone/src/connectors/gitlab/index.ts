import type { ConnectorDef } from "../types.js";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { createGitLabClient } from "@agentic-backbone/gitlab-v4";
import { createGitLabIssueListTool } from "./tools/issue-list.js";
import { createGitLabIssueGetTool } from "./tools/issue-get.js";
import { createGitLabIssueCreateTool } from "./tools/issue-create.js";
import { createGitLabIssueUpdateTool } from "./tools/issue-update.js";
import { createGitLabIssueDeleteTool } from "./tools/issue-delete.js";
import { createGitLabIssueMoveTool } from "./tools/issue-move.js";
import { createGitLabIssueCommentTool } from "./tools/issue-comment.js";
import { createGitLabIssueListCommentsTool } from "./tools/issue-list-comments.js";
import { createGitLabIssueUpdateCommentTool } from "./tools/issue-update-comment.js";
import { createGitLabIssueDeleteCommentTool } from "./tools/issue-delete-comment.js";
import { createGitLabIssueListLinksTool } from "./tools/issue-list-links.js";
import { createGitLabIssueAddLinkTool } from "./tools/issue-add-link.js";
import { createGitLabIssueRelatedMrsTool } from "./tools/issue-related-mrs.js";
import { createGitLabMrListTool } from "./tools/mr-list.js";
import { createGitLabMrGetTool } from "./tools/mr-get.js";
import { createGitLabMrCreateTool } from "./tools/mr-create.js";
import { createGitLabMrUpdateTool } from "./tools/mr-update.js";
import { createGitLabMrDeleteTool } from "./tools/mr-delete.js";
import { createGitLabMrMergeTool } from "./tools/mr-merge.js";
import { createGitLabMrApproveTool } from "./tools/mr-approve.js";
import { createGitLabMrUnapproveTool } from "./tools/mr-unapprove.js";
import { createGitLabMrApprovalsTool } from "./tools/mr-approvals.js";
import { createGitLabMrRebaseTool } from "./tools/mr-rebase.js";
import { createGitLabMrDiffTool } from "./tools/mr-diff.js";
import { createGitLabMrPipelinesTool } from "./tools/mr-pipelines.js";
import { createGitLabMrCommentTool } from "./tools/mr-comment.js";
import { createGitLabMrListCommentsTool } from "./tools/mr-list-comments.js";
import { createGitLabMrUpdateCommentTool } from "./tools/mr-update-comment.js";
import { createGitLabMrDeleteCommentTool } from "./tools/mr-delete-comment.js";
import { createGitLabRepoGetFileTool } from "./tools/repo-get-file.js";
import { createGitLabRepoListFilesTool } from "./tools/repo-list-files.js";
import { createGitLabRepoCreateFileTool } from "./tools/repo-create-file.js";
import { createGitLabRepoUpdateFileTool } from "./tools/repo-update-file.js";
import { createGitLabRepoDeleteFileTool } from "./tools/repo-delete-file.js";
import { createGitLabRepoListBranchesTool } from "./tools/repo-list-branches.js";
import { createGitLabRepoGetBranchTool } from "./tools/repo-get-branch.js";
import { createGitLabRepoCreateBranchTool } from "./tools/repo-create-branch.js";
import { createGitLabRepoDeleteBranchTool } from "./tools/repo-delete-branch.js";
import { createGitLabRepoListTagsTool } from "./tools/repo-list-tags.js";
import { createGitLabRepoGetTagTool } from "./tools/repo-get-tag.js";
import { createGitLabRepoCreateTagTool } from "./tools/repo-create-tag.js";
import { createGitLabRepoDeleteTagTool } from "./tools/repo-delete-tag.js";
import { createGitLabRepoListCommitsTool } from "./tools/repo-list-commits.js";
import { createGitLabRepoGetCommitTool } from "./tools/repo-get-commit.js";
import { createGitLabRepoCommitDiffTool } from "./tools/repo-commit-diff.js";
import { createGitLabRepoCompareTool } from "./tools/repo-compare.js";
import { createGitLabCiListPipelinesTool } from "./tools/ci-list-pipelines.js";
import { createGitLabCiGetPipelineTool } from "./tools/ci-get-pipeline.js";
import { createGitLabCiTriggerPipelineTool } from "./tools/ci-trigger-pipeline.js";
import { createGitLabCiDeletePipelineTool } from "./tools/ci-delete-pipeline.js";
import { createGitLabCiRetryPipelineTool } from "./tools/ci-retry-pipeline.js";
import { createGitLabCiCancelPipelineTool } from "./tools/ci-cancel-pipeline.js";
import { createGitLabCiListJobsTool } from "./tools/ci-list-jobs.js";
import { createGitLabCiGetJobTool } from "./tools/ci-get-job.js";
import { createGitLabCiJobLogTool } from "./tools/ci-job-log.js";
import { createGitLabCiRetryJobTool } from "./tools/ci-retry-job.js";
import { createGitLabCiCancelJobTool } from "./tools/ci-cancel-job.js";
import { createGitLabCiPlayJobTool } from "./tools/ci-play-job.js";
import { createGitLabLabelListTool } from "./tools/label-list.js";
import { createGitLabLabelGetTool } from "./tools/label-get.js";
import { createGitLabLabelCreateTool } from "./tools/label-create.js";
import { createGitLabLabelUpdateTool } from "./tools/label-update.js";
import { createGitLabLabelDeleteTool } from "./tools/label-delete.js";
import { createGitLabMilestoneListTool } from "./tools/milestone-list.js";
import { createGitLabMilestoneGetTool } from "./tools/milestone-get.js";
import { createGitLabMilestoneCreateTool } from "./tools/milestone-create.js";
import { createGitLabMilestoneUpdateTool } from "./tools/milestone-update.js";
import { createGitLabMilestoneDeleteTool } from "./tools/milestone-delete.js";
import { createGitLabMilestoneIssuesTool } from "./tools/milestone-issues.js";
import { createGitLabMilestoneMrsTool } from "./tools/milestone-mrs.js";
import { createGitLabReleaseListTool } from "./tools/release-list.js";
import { createGitLabReleaseGetTool } from "./tools/release-get.js";
import { createGitLabReleaseCreateTool } from "./tools/release-create.js";
import { createGitLabReleaseUpdateTool } from "./tools/release-update.js";
import { createGitLabReleaseDeleteTool } from "./tools/release-delete.js";
import { createGitLabWikiListTool } from "./tools/wiki-list.js";
import { createGitLabWikiGetTool } from "./tools/wiki-get.js";
import { createGitLabWikiCreateTool } from "./tools/wiki-create.js";
import { createGitLabWikiUpdateTool } from "./tools/wiki-update.js";
import { createGitLabWikiDeleteTool } from "./tools/wiki-delete.js";
import { createGitLabUserMeTool } from "./tools/user-me.js";
import { createGitLabUserGetTool } from "./tools/user-get.js";
import { createGitLabUserSearchTool } from "./tools/user-search.js";
import { createGitLabProjectSearchTool } from "./tools/project-search.js";
import { createGitLabProjectGetTool } from "./tools/project-get.js";
import { createGitLabProjectListMembersTool } from "./tools/project-list-members.js";
import { createGitLabProjectAddMemberTool } from "./tools/project-add-member.js";
import { createGitLabProjectUpdateMemberTool } from "./tools/project-update-member.js";
import { createGitLabProjectRemoveMemberTool } from "./tools/project-remove-member.js";

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
      // Issues
      ...createGitLabIssueListTool(adapters),
      ...createGitLabIssueGetTool(adapters),
      ...createGitLabIssueCreateTool(adapters),
      ...createGitLabIssueUpdateTool(adapters),
      ...createGitLabIssueDeleteTool(adapters),
      ...createGitLabIssueMoveTool(adapters),
      ...createGitLabIssueCommentTool(adapters),
      ...createGitLabIssueListCommentsTool(adapters),
      ...createGitLabIssueUpdateCommentTool(adapters),
      ...createGitLabIssueDeleteCommentTool(adapters),
      ...createGitLabIssueListLinksTool(adapters),
      ...createGitLabIssueAddLinkTool(adapters),
      ...createGitLabIssueRelatedMrsTool(adapters),
      // Merge Requests
      ...createGitLabMrListTool(adapters),
      ...createGitLabMrGetTool(adapters),
      ...createGitLabMrCreateTool(adapters),
      ...createGitLabMrUpdateTool(adapters),
      ...createGitLabMrDeleteTool(adapters),
      ...createGitLabMrMergeTool(adapters),
      ...createGitLabMrApproveTool(adapters),
      ...createGitLabMrUnapproveTool(adapters),
      ...createGitLabMrApprovalsTool(adapters),
      ...createGitLabMrRebaseTool(adapters),
      ...createGitLabMrDiffTool(adapters),
      ...createGitLabMrPipelinesTool(adapters),
      ...createGitLabMrCommentTool(adapters),
      ...createGitLabMrListCommentsTool(adapters),
      ...createGitLabMrUpdateCommentTool(adapters),
      ...createGitLabMrDeleteCommentTool(adapters),
      // Repository
      ...createGitLabRepoGetFileTool(adapters),
      ...createGitLabRepoListFilesTool(adapters),
      ...createGitLabRepoCreateFileTool(adapters),
      ...createGitLabRepoUpdateFileTool(adapters),
      ...createGitLabRepoDeleteFileTool(adapters),
      ...createGitLabRepoListBranchesTool(adapters),
      ...createGitLabRepoGetBranchTool(adapters),
      ...createGitLabRepoCreateBranchTool(adapters),
      ...createGitLabRepoDeleteBranchTool(adapters),
      ...createGitLabRepoListTagsTool(adapters),
      ...createGitLabRepoGetTagTool(adapters),
      ...createGitLabRepoCreateTagTool(adapters),
      ...createGitLabRepoDeleteTagTool(adapters),
      ...createGitLabRepoListCommitsTool(adapters),
      ...createGitLabRepoGetCommitTool(adapters),
      ...createGitLabRepoCommitDiffTool(adapters),
      ...createGitLabRepoCompareTool(adapters),
      // CI/CD
      ...createGitLabCiListPipelinesTool(adapters),
      ...createGitLabCiGetPipelineTool(adapters),
      ...createGitLabCiTriggerPipelineTool(adapters),
      ...createGitLabCiDeletePipelineTool(adapters),
      ...createGitLabCiRetryPipelineTool(adapters),
      ...createGitLabCiCancelPipelineTool(adapters),
      ...createGitLabCiListJobsTool(adapters),
      ...createGitLabCiGetJobTool(adapters),
      ...createGitLabCiJobLogTool(adapters),
      ...createGitLabCiRetryJobTool(adapters),
      ...createGitLabCiCancelJobTool(adapters),
      ...createGitLabCiPlayJobTool(adapters),
      // Labels
      ...createGitLabLabelListTool(adapters),
      ...createGitLabLabelGetTool(adapters),
      ...createGitLabLabelCreateTool(adapters),
      ...createGitLabLabelUpdateTool(adapters),
      ...createGitLabLabelDeleteTool(adapters),
      // Milestones
      ...createGitLabMilestoneListTool(adapters),
      ...createGitLabMilestoneGetTool(adapters),
      ...createGitLabMilestoneCreateTool(adapters),
      ...createGitLabMilestoneUpdateTool(adapters),
      ...createGitLabMilestoneDeleteTool(adapters),
      ...createGitLabMilestoneIssuesTool(adapters),
      ...createGitLabMilestoneMrsTool(adapters),
      // Releases
      ...createGitLabReleaseListTool(adapters),
      ...createGitLabReleaseGetTool(adapters),
      ...createGitLabReleaseCreateTool(adapters),
      ...createGitLabReleaseUpdateTool(adapters),
      ...createGitLabReleaseDeleteTool(adapters),
      // Wiki
      ...createGitLabWikiListTool(adapters),
      ...createGitLabWikiGetTool(adapters),
      ...createGitLabWikiCreateTool(adapters),
      ...createGitLabWikiUpdateTool(adapters),
      ...createGitLabWikiDeleteTool(adapters),
      // Users
      ...createGitLabUserMeTool(adapters),
      ...createGitLabUserGetTool(adapters),
      ...createGitLabUserSearchTool(adapters),
      // Projects
      ...createGitLabProjectSearchTool(adapters),
      ...createGitLabProjectGetTool(adapters),
      ...createGitLabProjectListMembersTool(adapters),
      ...createGitLabProjectAddMemberTool(adapters),
      ...createGitLabProjectUpdateMemberTool(adapters),
      ...createGitLabProjectRemoveMemberTool(adapters),
    };
  },
};
