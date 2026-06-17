import "server-only";

import { prisma } from "@/lib/prisma";
import { aitunnelEmbed } from "@/lib/aitunnel.server";

const CHUNK_MAX = 900;

function splitFaqContent(content: string): Array<{ title: string; content: string }> {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const sections: Array<{ title: string; content: string }> = [];
  const parts = trimmed.split(/\n(?=##\s)/);

  for (const part of parts) {
    const lines = part.trim().split("\n");
    let title = "";
    let body = part.trim();

    if (lines[0]?.startsWith("## ")) {
      title = lines[0].replace(/^##\s+/, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    if (!body) continue;

    if (body.length <= CHUNK_MAX) {
      sections.push({ title, content: body });
      continue;
    }

    const paragraphs = body.split(/\n\n+/);
    let buf = title ? `## ${title}\n\n` : "";
    for (const p of paragraphs) {
      if ((buf + p).length > CHUNK_MAX && buf.trim()) {
        sections.push({ title, content: buf.trim() });
        buf = p + "\n\n";
      } else {
        buf += p + "\n\n";
      }
    }
    if (buf.trim()) sections.push({ title, content: buf.trim() });
  }

  return sections;
}

export async function getNetworkFaq(seatId: string) {
  return prisma.networkFaq.findUnique({ where: { seatId } });
}

export async function saveNetworkFaq(seatId: string, content: string, updatedBy: string) {
  const sections = splitFaqContent(content);

  const faq = await prisma.networkFaq.upsert({
    where: { seatId },
    create: { seatId, content, updatedBy },
    update: { content, updatedBy },
  });

  await prisma.faqChunk.deleteMany({ where: { faqId: faq.id } });

  if (!sections.length) {
    return { faq, chunkCount: 0 };
  }

  const embeddings = sections.length
    ? await aitunnelEmbed(sections.map((s) => (s.title ? `${s.title}\n\n${s.content}` : s.content)))
    : [];

  await prisma.faqChunk.createMany({
    data: sections.map((s, i) => ({
      faqId: faq.id,
      chunkIndex: i,
      title: s.title,
      content: s.content,
      embedding: embeddings[i] ?? undefined,
    })),
  });

  return { faq, chunkCount: sections.length };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function searchFaqChunks(seatId: string, query: string, limit = 4) {
  const faq = await prisma.networkFaq.findUnique({
    where: { seatId },
    include: { chunks: { orderBy: { chunkIndex: "asc" } } },
  });

  if (!faq?.content.trim() || !faq.chunks.length) {
    return { empty: true as const, chunks: [] as Array<{ title: string; content: string; score: number }> };
  }

  const [queryVec] = await aitunnelEmbed([query]);
  if (!queryVec) {
    return { empty: false as const, chunks: [] as Array<{ title: string; content: string; score: number }> };
  }

  const scored = faq.chunks
    .map((c) => {
      const emb = c.embedding as number[] | null;
      if (!emb?.length) return null;
      return {
        title: c.title,
        content: c.content,
        score: cosineSimilarity(queryVec, emb),
      };
    })
    .filter((x): x is { title: string; content: string; score: number } => x != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { empty: false as const, chunks: scored };
}
