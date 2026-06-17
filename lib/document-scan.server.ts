import "server-only";

import {
  DOCUMENT_SCAN_SYSTEM_PROMPT,
  DOCUMENT_SCAN_USER_TEXT,
} from "@/lib/document-scan-prompt";
import {
  extractJsonFromLlmText,
  parseDocumentScanJson,
} from "@/lib/document-scan-parse";
import type { DocumentScanExtract } from "@/lib/document-scan-types";
import { aitunnelChatCompletion, aitunnelVisionModel } from "@/lib/aitunnel.server";

const MAX_EDGE = 2048;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

type SharpModule = typeof import("sharp");

async function loadSharp(): Promise<SharpModule["default"] | null> {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch (e) {
    console.error("[document-scan] sharp unavailable", e);
    return null;
  }
}

export async function prepareScanImage(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string }> {
  if (mime === "application/pdf") {
    return { buffer, mime };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer, mime: mime === "image/png" ? "image/png" : "image/jpeg" };
  }

  const img = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  let pipeline = img;
  if (Math.max(w, h) > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: w >= h ? MAX_EDGE : undefined,
      height: h > w ? MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const outMime = mime === "image/png" ? "image/png" : mime === "image/webp" ? "image/webp" : "image/jpeg";
  const outBuffer =
    outMime === "image/png"
      ? await pipeline.png({ compressionLevel: 8 }).toBuffer()
      : outMime === "image/webp"
        ? await pipeline.webp({ quality: 85 }).toBuffer()
        : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  return { buffer: outBuffer, mime: outMime };
}

function buildContentParts(buffer: Buffer, mime: string, filename: string): ContentPart[] {
  const base64 = buffer.toString("base64");

  if (mime === "application/pdf") {
    return [
      { type: "text", text: DOCUMENT_SCAN_USER_TEXT },
      {
        type: "file",
        file: {
          filename: filename.endsWith(".pdf") ? filename : "document.pdf",
          file_data: `data:application/pdf;base64,${base64}`,
        },
      },
    ];
  }

  return [
    { type: "text", text: DOCUMENT_SCAN_USER_TEXT },
    {
      type: "image_url",
      image_url: { url: `data:${mime};base64,${base64}` },
    },
  ];
}

export async function recognizeDocumentFromScan(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<DocumentScanExtract> {
  const prepared = mime === "application/pdf" ? { buffer, mime } : await prepareScanImage(buffer, mime);

  const completion = await aitunnelChatCompletion({
    model: aitunnelVisionModel(),
    max_tokens: 4096,
    temperature: 0.1,
    timeoutMs: 150_000,
    messages: [
      { role: "system", content: DOCUMENT_SCAN_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildContentParts(prepared.buffer, prepared.mime, filename),
      },
    ],
  });

  const content = completion.content;
  if (!content || typeof content !== "string") {
    throw new Error("Пустой ответ модели");
  }

  const json = extractJsonFromLlmText(content);
  return parseDocumentScanJson(json);
}
