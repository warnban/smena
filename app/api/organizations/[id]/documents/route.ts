import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import {
  buildUploadPath,
  guessContentType,
  putStoredFile,
  storageKeyFromFilePath,
} from "@/lib/object-storage.server";

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await assertSeatOps(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const org = await prisma.organization.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const single = formData.get("file") as File | null;
  const allFiles = files.length ? files : single?.size ? [single] : [];

  if (!allFiles.length) {
    return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  }

  const defaultTitle = String(formData.get("name") ?? "").trim();
  const titlesRaw = formData.get("names");
  let titles: string[] = [];
  if (typeof titlesRaw === "string" && titlesRaw) {
    try {
      titles = JSON.parse(titlesRaw) as string[];
    } catch {
      titles = [];
    }
  }

  const created = [];

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `Файл «${file.name}» больше 10 МБ` }, { status: 400 });
    }

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = buildUploadPath(["uploads", "organizations", org.id], safeName);

    await putStoredFile(
      storageKeyFromFilePath(filePath),
      buffer,
      file.type || guessContentType(safeName)
    );

    const title = (titles[i] ?? defaultTitle ?? file.name).trim() || file.name;

    const doc = await prisma.organizationDocument.create({
      data: {
        organizationId: org.id,
        name: title,
        filePath,
        mimeType: file.type || guessContentType(safeName),
        size: formatSize(file.size),
      },
    });
    created.push(doc);
  }

  return NextResponse.json({ ok: true, documents: created });
}
