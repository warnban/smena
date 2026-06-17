import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { GUEST_DOC_MAX_BYTES, storeGuestDocument } from "@/lib/guest-document-storage.server";
import { fileServeUrl } from "@/lib/file-url";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guest = await prisma.guest.findFirst({
    where: { id: params.id, seatId: session.seatId },
  });
  if (!guest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const docType = (formData.get("type") as string) || "passport";

  if (!file?.size) {
    return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  }
  if (file.size > GUEST_DOC_MAX_BYTES) {
    return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await storeGuestDocument(
    guest.id,
    { name: file.name, buffer, size: file.size },
    docType
  );

  return NextResponse.json({
    ok: true,
    document: { ...doc, filePath: fileServeUrl(doc.filePath) },
  });
}
