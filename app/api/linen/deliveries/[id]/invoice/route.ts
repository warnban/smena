import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { fileServeUrl } from "@/lib/file-url";
import { formatBytes, mapLinenDelivery } from "@/lib/linen-control.server";
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

    const row = await prisma.linenDelivery.findFirst({
      where: { id: params.id, hotel: { seatId: session.seatId } },
    });
    if (!row) {
      return NextResponse.json({ error: "Доставка не найдена" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, row.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.size) {
      return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
    }

    if (row.invoicePath) {
      await deleteStoredFile(row.invoicePath);
    }

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = buildUploadPath(["uploads", "linen", row.hotelId], safeName);

    await putStoredFile(
      storageKeyFromFilePath(filePath),
      buffer,
      file.type || guessContentType(safeName)
    );

    const updated = await prisma.linenDelivery.update({
      where: { id: row.id },
      data: {
        invoicePath: filePath,
        invoiceName: file.name,
        invoiceSize: formatBytes(file.size),
      },
    });

    return NextResponse.json({
      ok: true,
      invoicePath: fileServeUrl(updated.invoicePath),
      invoiceName: updated.invoiceName,
      delivery: mapLinenDelivery(updated),
    });
  } catch (e) {
    console.error("[linen invoice POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
