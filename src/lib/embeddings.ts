import { createHash } from "node:crypto";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-4";
const MAX_CHARS = 8_000;
const MAX_ATTEMPTS = 3;

export const EMBEDDING_BATCH_SIZE = 96;

export type InputType = "query" | "document";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

export function embeddingFingerprint(text: string): string {
  return createHash("sha256").update(`${MODEL}:${text}`).digest("hex");
}

function truncate(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

async function embedBatch(texts: string[], inputType: InputType): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }

    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts.map(truncate),
        model: MODEL,
        input_type: inputType,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as VoyageResponse;
      const ordered = new Array<number[]>(texts.length);
      for (const item of json.data) ordered[item.index] = item.embedding;

      const missing = ordered.findIndex((vector) => !vector);
      if (missing !== -1) throw new Error(`Voyage returned no embedding at index ${missing}`);
      return ordered;
    }

    const body = await res.text();
    lastError = new Error(`Voyage request failed (${res.status}): ${body.slice(0, 200)}`);
    if (res.status !== 429 && res.status < 500) throw lastError;
  }

  throw lastError;
}

export async function embedMany(texts: string[], inputType: InputType): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    embeddings.push(...(await embedBatch(texts.slice(i, i + EMBEDDING_BATCH_SIZE), inputType)));
  }
  return embeddings;
}

export async function embedOne(text: string, inputType: InputType): Promise<number[]> {
  const [embedding] = await embedMany([text], inputType);
  return embedding;
}
