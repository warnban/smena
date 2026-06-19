import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { applyDocumentScanToForm } from "@/lib/document-scan-apply";
import { guestToForm } from "@/lib/guest-form";
import type { Guest } from "@/lib/types";
import { GUEST_DOC_MAX_BYTES, storeGuestDocument } from "@/lib/guest-document-storage.server";
import { recognizeDocumentFromScan } from "@/lib/document-scan.server";
import { listFilledExtractFields } from "@/lib/document-scan-parse";
import { runHamsterAfterScan } from "@/lib/assistant/hamster-agent.server";
import { fileServeUrl } from "@/lib/file-url";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const guestId = String(formData.get("guestId") ?? "");
    const conversationId = String(formData.get("conversationId") ?? "");
    const bookingId = formData.get("bookingId") ? String(formData.get("bookingId")) : undefined;
    const hotelId = String(formData.get("hotelId") ?? "");

    if (!file?.size) {
      return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    }
    if (!guestId || !conversationId) {
      return NextResponse.json({ error: "guestId и conversationId обязательны" }, { status: 400 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, seatId: auth.session.seatId! },
    });
    if (!guest) {
      return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
    }

    if (!process.env.AITUNNEL_API_KEY?.trim()) {
      return NextResponse.json({ error: "Распознавание не настроено (AITUNNEL_API_KEY)" }, { status: 503 });
    }

    if (file.size > GUEST_DOC_MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
    }

    const mime = (file.type || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ error: "Формат: JPEG, PNG, WebP или PDF" }, { status: 400 });
    }

    const staff = await prisma.staff.findFirst({
      where: { userId: auth.session.userId, seatId: auth.session.seatId },
      select: { id: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Профиль сотрудника не найден" }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const docType = String(formData.get("type") ?? "passport");

    let document;
    try {
      document = await storeGuestDocument(
        guest.id,
        { name: file.name, buffer, size: file.size },
        docType
      );
    } catch (e) {
      console.error("[assistant/upload] storage", e);
      return NextResponse.json(
        { error: apiErrorMessage(e, "Не удалось сохранить файл") },
        { status: 500 }
      );
    }

    let extract;
    try {
      extract = await recognizeDocumentFromScan(buffer, mime, file.name);
    } catch (e) {
      return NextResponse.json(
        {
          error: apiErrorMessage(e, "Не удалось распознать документ"),
          document: { id: document.id, filePath: fileServeUrl(document.filePath) },
        },
        { status: 422 }
      );
    }

    const filledFields = listFilledExtractFields(extract);
    const form = applyDocumentScanToForm(guestToForm(guest as unknown as Guest), extract);

    if (extract.isForeigner !== guest.isForeigner) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { isForeigner: extract.isForeigner },
      });
    }

    let hotelName: string | null = null;
    if (hotelId) {
      const hotel = await prisma.hotel.findFirst({
        where: { id: hotelId, seatId: auth.session.seatId! },
        select: { name: true },
      });
      hotelName = hotel?.name ?? null;
    }

    const hamsterResponse = await runHamsterAfterScan({
      session: auth.session,
      staffId: staff.id,
      hotelId,
      hotelName,
      conversationId,
      guestId: guest.id,
      bookingId,
      extract: extract as unknown as Record<string, unknown>,
      filledFields,
    });

    return NextResponse.json({
      ok: true,
      extract,
      filledFields,
      form,
      document: { id: document.id, filePath: fileServeUrl(document.filePath) },
      ...hamsterResponse,
    });
  } catch (e) {
    console.error("[assistant/upload]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка загрузки") }, { status: 500 });
  }
}
