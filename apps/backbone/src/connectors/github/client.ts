export interface GitHubCredential {
  token: string;
}

export interface GitHubOptions {
  default_repo?: string;
}

export interface GitHubClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  defaultRepo: string | undefined;
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  close(): Promise<void>;
}

export function createGitHubClient(credential: GitHubCredential, options: GitHubOptions): GitHubClient {
  const { token } = credential;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const resp = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`GitHub ${resp.status}: ${body}`);
    }
    return resp.json() as Promise<T>;
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

  return { request, defaultRepo: options.default_repo, ping, close };
}
