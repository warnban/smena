import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard, formatBytes } from "@/lib/meters.server";
import { fileServeUrl } from "@/lib/file-url";
import {
  buildUploadPath,
  deleteStoredFile,
  guessContentType,
  putStoredFile,
  storageKeyFromFilePath,
} from "@/lib/object-storage.server";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reading = await prisma.utilityReading.findFirst({
      where: { id: params.id, meter: { hotel: { seatId: session.seatId } } },
    });
    if (!reading) {
      return NextResponse.json({ error: "Показание не найдено" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, reading.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const formData = await req.formData();
    const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) {
      return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    }

    const created = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `Файл «${file.name}» больше 10 МБ` }, { status: 400 });
      }

      const ext = path.extname(file.name) || ".bin";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = buildUploadPath(["uploads", "meters", reading.id], safeName);

      await putStoredFile(
        storageKeyFromFilePath(filePath),
        buffer,
        file.type || guessContentType(safeName)
      );

      const row = await prisma.utilityReadingAttachment.create({
        data: {
          readingId: reading.id,
          filePath,
          fileName: file.name,
          fileSize: formatBytes(file.size),
          mimeType: file.type || guessContentType(safeName),
        },
      });
      created.push({
        ...row,
        filePath: fileServeUrl(row.filePath),
      });
    }

    const board = await buildMetersBoard(reading.hotelId);
    return NextResponse.json({ ok: true, attachments: created, board });
  } catch (e) {
    console.error("[meters attachments POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
