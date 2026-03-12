export interface GitLabCredential {
  base_url: string;
  token: string;
}

export interface GitLabOptions {
  default_project?: string;
}

export interface GitLabClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  defaultProject: string | undefined;
  resolveProjectId(nameOrId: string): Promise<number>;
  invalidateProjectCache(nameOrId?: string): void;
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  close(): Promise<void>;
}

export function createGitLabClient(credential: GitLabCredential, options: GitLabOptions): GitLabClient {
  const { token } = credential;
  const baseUrl = credential.base_url.replace(/\/$/, "");
  const headers = { "PRIVATE-TOKEN": token, "Content-Type": "application/json" };

  const projectIdCache = new Map<string, number>();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const resp = await fetch(`${baseUrl}/api/v4${path}`, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`GitLab ${resp.status}: ${body}`);
    }
    return resp.json() as Promise<T>;
  }

  async function resolveProjectId(nameOrId: string): Promise<number> {
    const asNum = Number(nameOrId);
    if (Number.isInteger(asNum) && asNum > 0) return asNum;

    const cached = projectIdCache.get(nameOrId);
    if (cached !== undefined) return cached;

    const lastSegment = nameOrId.split("/").pop() ?? nameOrId;
    const params = new URLSearchParams({
      search: lastSegment,
      search_namespaces: "true",
      simple: "true",
      per_page: "20",
    });
    const results = await request<Array<{ id: number; path_with_namespace: string }>>(`/projects?${params}`);
    const match = results.find((p) => p.path_with_namespace === nameOrId);
    if (!match) throw new Error(`GitLab: projeto "${nameOrId}" não encontrado`);

    projectIdCache.set(nameOrId, match.id);
    return match.id;
  }

  function invalidateProjectCache(nameOrId?: string): void {
    if (nameOrId) projectIdCache.delete(nameOrId);
    else projectIdCache.clear();
  }

  async function ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await request("/user");
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function close(): Promise<void> {}

  return { request, defaultProject: options.default_project, resolveProjectId, invalidateProjectCache, ping, close };
}
