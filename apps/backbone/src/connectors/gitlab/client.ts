/**
 * GitLab client adapter — replaces the removed @agentic-backbone/gitlab-v4 package.
 * Uses @gitbeaker/rest under the hood, exposing the same resource-factory API
 * so that tool files remain unchanged.
 */
import { Gitlab } from "@gitbeaker/rest";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface GitLabClient {
  api: InstanceType<typeof Gitlab>;
  defaultProject: string;
}

export function createGitLabClient(
  credential: { base_url: string; token: string },
  options: { default_project: string },
): GitLabClient {
  const api = new Gitlab({
    host: credential.base_url,
    token: credential.token,
  });
  return { api, defaultProject: options.default_project };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode project path for gitbeaker (accepts "owner/repo" or numeric ID) */
function pid(project: string): string | number {
  const n = Number(project);
  return Number.isInteger(n) && n > 0 ? n : project;
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export function createIssuesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Issues.all({ projectId: pid(project), ...opts });
    },
    async get(project: string, iid: number) {
      return api.Issues.show(pid(project), iid);
    },
    async create(project: string, data: Record<string, any>) {
      return api.Issues.create(pid(project), data);
    },
    async update(project: string, iid: number, data: Record<string, any>) {
      return api.Issues.edit(pid(project), iid, data);
    },
    async delete(project: string, iid: number) {
      return api.Issues.remove(pid(project), iid);
    },
    async move(project: string, iid: number, toProjectId: number) {
      return (api.Issues as any).move(pid(project), iid, toProjectId);
    },
    async listLinks(project: string, iid: number) {
      return api.IssueLinks.all(pid(project), iid);
    },
    async addLink(project: string, iid: number, targetProjectId: number, targetIssueIid: number, linkType?: string) {
      return api.IssueLinks.create(pid(project), iid, pid(String(targetProjectId)), targetIssueIid, { linkType } as any);
    },
    async relatedMrs(project: string, iid: number) {
      return api.Issues.relatedMergeRequests(pid(project), iid);
    },
  };
}

export function createIssueNotesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, iid: number) {
      return api.IssueNotes.all(pid(project), iid);
    },
    async create(project: string, iid: number, body: string) {
      return api.IssueNotes.create(pid(project), iid, body);
    },
    async update(project: string, iid: number, noteId: number, body: string) {
      return api.IssueNotes.edit(pid(project), iid, noteId, { body });
    },
    async delete(project: string, iid: number, noteId: number) {
      return api.IssueNotes.remove(pid(project), iid, noteId);
    },
  };
}

// ---------------------------------------------------------------------------
// Merge Requests
// ---------------------------------------------------------------------------

export function createMrsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.MergeRequests.all({ projectId: pid(project), ...opts });
    },
    async get(project: string, iid: number) {
      return api.MergeRequests.show(pid(project), iid);
    },
    async create(project: string, data: Record<string, any>) {
      const { source_branch, target_branch, title, ...rest } = data;
      return api.MergeRequests.create(pid(project), source_branch, target_branch, title, rest);
    },
    async update(project: string, iid: number, data: Record<string, any>) {
      return api.MergeRequests.edit(pid(project), iid, data);
    },
    async delete(project: string, iid: number) {
      return api.MergeRequests.remove(pid(project), iid);
    },
    async merge(project: string, iid: number, opts: Record<string, any> = {}) {
      return api.MergeRequests.accept(pid(project), iid, opts);
    },
    async approve(project: string, iid: number) {
      return api.MergeRequestApprovals.approve(pid(project), { mergerequestIId: iid });
    },
    async unapprove(project: string, iid: number) {
      return api.MergeRequestApprovals.unapprove(pid(project), { mergerequestIId: iid });
    },
    async approvals(project: string, iid: number) {
      return api.MergeRequestApprovals.showConfiguration(pid(project), { mergerequestIId: iid });
    },
    async rebase(project: string, iid: number) {
      return api.MergeRequests.rebase(pid(project), iid);
    },
    async diff(project: string, iid: number) {
      return api.MergeRequests.allDiffs(pid(project), iid);
    },
    async pipelines(project: string, iid: number) {
      return api.MergeRequests.allPipelines(pid(project), iid);
    },
  };
}

export function createMrNotesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, iid: number) {
      return api.MergeRequestNotes.all(pid(project), iid);
    },
    async create(project: string, iid: number, body: string) {
      return api.MergeRequestNotes.create(pid(project), iid, body);
    },
    async update(project: string, iid: number, noteId: number, body: string) {
      return api.MergeRequestNotes.edit(pid(project), iid, noteId, { body });
    },
    async delete(project: string, iid: number, noteId: number) {
      return api.MergeRequestNotes.remove(pid(project), iid, noteId);
    },
  };
}

// ---------------------------------------------------------------------------
// Repository Files
// ---------------------------------------------------------------------------

export function createRepoFilesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async get(project: string, filePath: string, ref: string) {
      return api.RepositoryFiles.show(pid(project), filePath, ref);
    },
    async create(project: string, filePath: string, data: Record<string, any>) {
      return api.RepositoryFiles.create(pid(project), filePath, data.branch, data.content, data.commit_message);
    },
    async update(project: string, filePath: string, data: Record<string, any>) {
      return api.RepositoryFiles.edit(pid(project), filePath, data.branch, data.content, data.commit_message, {
        lastCommitId: data.last_commit_id,
      });
    },
    async delete(project: string, filePath: string, data: Record<string, any>) {
      return api.RepositoryFiles.remove(pid(project), filePath, data.branch, data.commit_message, {
        authorName: data.author_name,
        authorEmail: data.author_email,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Repository Branches
// ---------------------------------------------------------------------------

export function createRepoBranchesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Branches.all(pid(project), opts);
    },
    async get(project: string, branch: string) {
      return api.Branches.show(pid(project), branch);
    },
    async create(project: string, data: { branch: string; ref: string }) {
      return api.Branches.create(pid(project), data.branch, data.ref);
    },
    async delete(project: string, branch: string) {
      return api.Branches.remove(pid(project), branch);
    },
  };
}

// ---------------------------------------------------------------------------
// Repository Tags
// ---------------------------------------------------------------------------

export function createRepoTagsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Tags.all(pid(project), opts);
    },
    async get(project: string, tagName: string) {
      return api.Tags.show(pid(project), tagName);
    },
    async create(project: string, data: { tag_name: string; ref: string; message?: string }) {
      return api.Tags.create(pid(project), data.tag_name, data.ref, { message: data.message });
    },
    async delete(project: string, tagName: string) {
      return api.Tags.remove(pid(project), tagName);
    },
  };
}

// ---------------------------------------------------------------------------
// Repository Commits
// ---------------------------------------------------------------------------

export function createRepoCommitsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Commits.all(pid(project), opts);
    },
    async get(project: string, sha: string) {
      return api.Commits.show(pid(project), sha);
    },
    async diff(project: string, sha: string) {
      return api.Commits.showDiff(pid(project), sha);
    },
    async listFiles(project: string, opts: Record<string, any> = {}) {
      return api.Repositories.allRepositoryTrees(pid(project), opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Repository Compare
// ---------------------------------------------------------------------------

export function createRepoCompareResource(client: GitLabClient) {
  const { api } = client;
  return {
    async compare(project: string, from: string, to: string, straight?: boolean) {
      return api.Repositories.compare(pid(project), from, to, { straight });
    },
  };
}

// ---------------------------------------------------------------------------
// CI Pipelines
// ---------------------------------------------------------------------------

export function createCiPipelinesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Pipelines.all(pid(project), opts);
    },
    async get(project: string, pipelineId: number) {
      return api.Pipelines.show(pid(project), pipelineId);
    },
    async create(project: string, ref: string, variables?: Array<{ key: string; value: string }>) {
      return api.Pipelines.create(pid(project), ref, { variables });
    },
    async delete(project: string, pipelineId: number) {
      return api.Pipelines.remove(pid(project), pipelineId);
    },
    async retry(project: string, pipelineId: number) {
      return api.Pipelines.retry(pid(project), pipelineId);
    },
    async cancel(project: string, pipelineId: number) {
      return api.Pipelines.cancel(pid(project), pipelineId);
    },
  };
}

// ---------------------------------------------------------------------------
// CI Jobs
// ---------------------------------------------------------------------------

export function createCiJobsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, pipelineId: number, opts: Record<string, any> = {}) {
      return api.Jobs.all(pid(project), { pipelineId, ...opts });
    },
    async get(project: string, jobId: number) {
      return api.Jobs.show(pid(project), jobId);
    },
    async log(project: string, jobId: number) {
      return api.Jobs.showLog(pid(project), jobId);
    },
    async retry(project: string, jobId: number) {
      return api.Jobs.retry(pid(project), jobId);
    },
    async cancel(project: string, jobId: number) {
      return api.Jobs.cancel(pid(project), jobId);
    },
    async play(project: string, jobId: number) {
      return api.Jobs.play(pid(project), jobId);
    },
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function createLabelsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.Labels.all(pid(project), opts);
    },
    async get(project: string, labelId: number) {
      return api.Labels.show(pid(project), labelId);
    },
    async create(project: string, data: Record<string, any>) {
      return api.Labels.create(pid(project), data);
    },
    async update(project: string, labelId: number, data: Record<string, any>) {
      return api.Labels.edit(pid(project), labelId, data);
    },
    async delete(project: string, labelId: number) {
      return api.Labels.remove(pid(project), labelId);
    },
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function createMilestonesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string, opts: Record<string, any> = {}) {
      return api.ProjectMilestones.all(pid(project), opts);
    },
    async get(project: string, milestoneId: number) {
      return api.ProjectMilestones.show(pid(project), milestoneId);
    },
    async create(project: string, data: Record<string, any>) {
      return api.ProjectMilestones.create(pid(project), data);
    },
    async update(project: string, milestoneId: number, data: Record<string, any>) {
      return api.ProjectMilestones.edit(pid(project), milestoneId, data);
    },
    async delete(project: string, milestoneId: number) {
      return api.ProjectMilestones.remove(pid(project), milestoneId);
    },
    async issues(project: string, milestoneId: number) {
      return api.ProjectMilestones.allIssues(pid(project), milestoneId);
    },
    async mrs(project: string, milestoneId: number) {
      return api.ProjectMilestones.allMergeRequests(pid(project), milestoneId);
    },
  };
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

export function createReleasesResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string) {
      return api.ProjectReleases.all(pid(project));
    },
    async get(project: string, tagName: string) {
      return api.ProjectReleases.show(pid(project), tagName);
    },
    async create(project: string, data: Record<string, any>) {
      return api.ProjectReleases.create(pid(project), data);
    },
    async update(project: string, tagName: string, data: Record<string, any>) {
      return api.ProjectReleases.edit(pid(project), tagName, data);
    },
    async delete(project: string, tagName: string) {
      return api.ProjectReleases.remove(pid(project), tagName);
    },
  };
}

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

export function createWikiResource(client: GitLabClient) {
  const { api } = client;
  return {
    async list(project: string) {
      return api.WikiPages.all(pid(project));
    },
    async get(project: string, slug: string) {
      return api.WikiPages.show(pid(project), slug);
    },
    async create(project: string, data: Record<string, any>) {
      return api.WikiPages.create(pid(project), data);
    },
    async update(project: string, slug: string, data: Record<string, any>) {
      return api.WikiPages.edit(pid(project), slug, data);
    },
    async delete(project: string, slug: string) {
      return api.WikiPages.remove(pid(project), slug);
    },
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function createUsersResource(client: GitLabClient) {
  const { api } = client;
  return {
    async me() {
      return api.Users.showCurrentUser();
    },
    async get(userId: number) {
      return api.Users.show(userId);
    },
    async search(query: string, opts: Record<string, any> = {}) {
      return api.Users.all({ search: query, ...opts });
    },
  };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function createProjectsResource(client: GitLabClient) {
  const { api } = client;
  return {
    async search(query: string, opts: Record<string, any> = {}) {
      return api.Projects.all({ search: query, ...opts });
    },
    async get(project: string) {
      return api.Projects.show(pid(project));
    },
    async listMembers(project: string, opts: Record<string, any> = {}) {
      return api.ProjectMembers.all(pid(project), opts);
    },
    async addMember(project: string, data: { user_id: number; access_level: number; expires_at?: string }) {
      return api.ProjectMembers.add(pid(project), data.user_id, data.access_level, { expiresAt: data.expires_at });
    },
    async updateMember(project: string, userId: number, data: { access_level: number; expires_at?: string }) {
      return api.ProjectMembers.edit(pid(project), userId, data.access_level, { expiresAt: data.expires_at });
    },
    async removeMember(project: string, userId: number) {
      return api.ProjectMembers.remove(pid(project), userId);
    },
  };
}
