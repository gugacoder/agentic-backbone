import type { EvolutionParams, EvolutionConnector } from "./types.js";

export function createEvolutionConnector(params: EvolutionParams): EvolutionConnector {
  const baseUrl = `http://${params.host}:${params.port}`;
  const headers: Record<string, string> = {
    apikey: params.apiKey,
    "Content-Type": "application/json",
  };

  async function get(endpoint: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return response.json();
  }

  async function send(endpoint: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    return response.json();
  }

  async function health(): Promise<string> {
    const result = (await get(`/instance/connectionState/${params.instanceName}`)) as Record<string, unknown>;
    const state = (result?.instance as Record<string, unknown>)?.state ?? "unknown";
    return `Evolution: ${state}`;
  }

  async function close(): Promise<void> {
    // HTTP stateless — no-op
  }

  return { get, send, health, close };
}
