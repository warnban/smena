import "server-only";

export const AITUNNEL_BASE = "https://api.aitunnel.ru/v1";

export function aitunnelApiKey(): string {
  const key = process.env.AITUNNEL_API_KEY?.trim();
  if (!key) throw new Error("AITUNNEL_API_KEY не настроен");
  return key;
}

export function aitunnelVisionModel(): string {
  return (
    process.env.AITUNNEL_VISION_MODEL?.trim() ||
    process.env.AITUNNEL_MODEL?.trim() ||
    "grok-4.20"
  );
}

export function aitunnelAssistantModel(): string {
  return process.env.AITUNNEL_ASSISTANT_MODEL?.trim() || "claude-haiku-4.5";
}

/** Hamster copilot — основной диалог и tool calling */
export function aitunnelHamsterModel(): string {
  return process.env.AITUNNEL_HAMSTER_MODEL?.trim() || "claude-sonnet-4.6";
}

export function aitunnelEmbeddingModel(): string {
  return process.env.AITUNNEL_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "file"; file: { filename: string; file_data: string } }
      >;
    };

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export async function aitunnelChatCompletion(params: {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  tool_choice?: "auto" | "none";
  max_tokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  model: string;
}> {
  const timeoutMs = params.timeoutMs ?? 120_000;
  let res: Response;
  try {
    res = await fetch(`${AITUNNEL_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aitunnelApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? aitunnelAssistantModel(),
        messages: params.messages,
        tools: params.tools,
        tool_choice: params.tool_choice ?? (params.tools?.length ? "auto" : undefined),
        max_tokens: params.max_tokens ?? 4096,
        temperature: params.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("Превышено время ожидания ответа AI. Попробуйте снова или загрузите фото меньшего размера.");
    }
    throw e;
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    model?: string;
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  if (!res.ok) {
    throw new Error(body.error?.message ?? `AITUNNEL HTTP ${res.status}`);
  }

  const msg = body.choices?.[0]?.message;
  return {
    content: msg?.content ?? null,
    tool_calls: msg?.tool_calls,
    model: body.model ?? params.model ?? aitunnelAssistantModel(),
  };
}

export async function aitunnelEmbed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await fetch(`${AITUNNEL_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aitunnelApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aitunnelEmbeddingModel(),
      input: texts,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: Array<{ embedding: number[]; index: number }>;
  };

  if (!res.ok) {
    throw new Error(body.error?.message ?? `AITUNNEL embeddings HTTP ${res.status}`);
  }

  const sorted = (body.data ?? []).sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}
