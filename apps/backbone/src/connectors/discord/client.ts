export interface DiscordCredential {
  bot_token: string;
}

export interface DiscordOptions {
  default_guild_id?: string;
}

export interface DiscordClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  defaultGuildId: string | undefined;
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  close(): Promise<void>;
}

export function createDiscordClient(credential: DiscordCredential, options: DiscordOptions): DiscordClient {
  const { bot_token } = credential;
  const token = bot_token.startsWith("Bot ") ? bot_token : `Bot ${bot_token}`;
  const headers = {
    Authorization: token,
    "Content-Type": "application/json",
  };

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const resp = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Discord ${resp.status}: ${body}`);
    }
    return resp.json() as Promise<T>;
  }

  async function ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await request("/users/@me");
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function close(): Promise<void> {}

  return { request, defaultGuildId: options.default_guild_id, ping, close };
}
