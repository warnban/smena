import "server-only";

import { prepareScanImage } from "@/lib/document-scan.server";
import { extractJsonFromLlmText } from "@/lib/document-scan-parse";
import { aitunnelChatCompletion, aitunnelVisionModel } from "@/lib/aitunnel.server";

export type LinenInvoiceScan = {
  deliveredAt: string;
  pillowcases: number;
  sheets: number;
  duvetCovers: number;
  washCost: number;
  notes: string;
  raw: unknown;
};

const SYSTEM = `Ты помощник гостиницы. По накладной прачечной извлеки данные.
Ответь ТОЛЬКО JSON без markdown:
{
  "deliveredAt": "ДД.ММ.ГГГГ или пусто",
  "pillowcases": число наволочек,
  "sheets": число простыней,
  "duvetCovers": число пододеяльников,
  "washCost": сумма стирки в рублях (целое число),
  "notes": "краткий комментарий если есть неясности"
}`;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export async function scanLinenInvoice(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<LinenInvoiceScan> {
  const prepared = mime === "application/pdf" ? { buffer, mime } : await prepareScanImage(buffer, mime);
  const base64 = prepared.buffer.toString("base64");

  const userContent =
    mime === "application/pdf"
      ? [
          { type: "text" as const, text: "Распознай накладную прачечной." },
          {
            type: "file" as const,
            file: {
              filename: filename.endsWith(".pdf") ? filename : "invoice.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
        ]
      : [
          { type: "text" as const, text: "Распознай накладную прачечной." },
          {
            type: "image_url" as const,
            image_url: { url: `data:${prepared.mime};base64,${base64}` },
          },
        ];

  const completion = await aitunnelChatCompletion({
    model: aitunnelVisionModel(),
    max_tokens: 2048,
    temperature: 0.1,
    timeoutMs: 120_000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.content;
  if (!content) throw new Error("Пустой ответ модели");

  const json = extractJsonFromLlmText(content);
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;

  return {
    deliveredAt: parseDate(o.deliveredAt),
    pillowcases: num(o.pillowcases),
    sheets: num(o.sheets),
    duvetCovers: num(o.duvetCovers),
    washCost: num(o.washCost),
    notes: String(o.notes ?? "").trim(),
    raw: json,
  };
}
