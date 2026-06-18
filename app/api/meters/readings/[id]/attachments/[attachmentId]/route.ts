import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { buildMetersBoard } from "@/lib/meters.server";
import { deleteStoredFile } from "@/lib/object-storage.server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachment = await prisma.utilityReadingAttachment.findFirst({
      where: {
        id: params.attachmentId,
        readingId: params.id,
        reading: { meter: { hotel: { seatId: session.seatId } } },
      },
      include: { reading: { select: { hotelId: true } } },
    });
    if (!attachment) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, attachment.reading.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (attachment.filePath) await deleteStoredFile(attachment.filePath);
    await prisma.utilityReadingAttachment.delete({ where: { id: attachment.id } });

    const board = await buildMetersBoard(attachment.reading.hotelId);
    return NextResponse.json({ ok: true, board });
  } catch (e) {
    console.error("[meters attachment DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
