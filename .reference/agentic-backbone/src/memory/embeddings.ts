import type { EmbeddingProvider } from "./types.js";

function normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const mag = Math.sqrt(sum);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}

async function retryFetch(
  url: string,
  init: RequestInit,
  attempts: number = 3
): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  }
  throw new Error("Embedding API: max retries exceeded");
}

export function createOpenAIProvider(apiKey?: string): EmbeddingProvider {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for embeddings");

  const model = "text-embedding-3-small";
  const dimensions = 1536;

  async function embed(texts: string[]): Promise<number[][]> {
    const res = await retryFetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, input: texts }),
    });

    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };

    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => normalize(d.embedding));
  }

  return {
    id: "openai",
    model,
    dimensions,
    async embedQuery(text: string): Promise<number[]> {
      const [vec] = await embed([text]);
      return vec;
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return embed(texts);
    },
  };
}

export function resolveProvider(name?: string): EmbeddingProvider {
  if (!name || name === "openai") return createOpenAIProvider();
  throw new Error(`Unknown embedding provider: ${name}`);
}
