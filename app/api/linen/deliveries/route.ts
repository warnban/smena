import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import {
  buildLinenOverview,
  formatBytes,
  mapLinenDelivery,
} from "@/lib/linen-control.server";
import {
  buildUploadPath,
  guessContentType,
  putStoredFile,
  storageKeyFromFilePath,
} from "@/lib/object-storage.server";
import { scanLinenInvoice } from "@/lib/linen-invoice-scan.server";

const MAX_BYTES = 10 * 1024 * 1024;

async function staffDisplayName(session: { userId: string; seatId: string; email: string }) {
  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    select: { name: true },
  });
  return staff?.name?.trim() || session.email;
}

function parseDeliveryDate(v: string | null | undefined): Date | null {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelId = req.nextUrl.searchParams.get("hotelId");
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const rows = await prisma.linenDelivery.findMany({
      where: { hotelId, hotel: { seatId: session.seatId } },
      orderBy: { deliveredAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      deliveries: rows.map(mapLinenDelivery),
    });
  } catch (e) {
    console.error("[linen deliveries GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const hotelId = String(formData.get("hotelId") ?? "").trim();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const deliveredAt = parseDeliveryDate(String(formData.get("deliveredAt") ?? ""));
    if (!deliveredAt) {
      return NextResponse.json({ error: "Укажите дату доставки" }, { status: 400 });
    }

    const pillowcases = Math.max(0, Math.round(Number(formData.get("pillowcases")) || 0));
    const sheets = Math.max(0, Math.round(Number(formData.get("sheets")) || 0));
    const duvetCovers = Math.max(0, Math.round(Number(formData.get("duvetCovers")) || 0));
    const washCost = Math.max(0, Math.round(Number(formData.get("washCost")) || 0));
    const isPaid = formData.get("isPaid") === "1" || formData.get("isPaid") === "true";
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);

    let invoicePath = "";
    let invoiceName = "";
    let invoiceSize = "";
    let ocrSnapshot: unknown = null;

    const file = formData.get("file") as File | null;
    const scan = formData.get("scan") === "1" || formData.get("scan") === "true";

    if (file?.size) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (scan && process.env.AITUNNEL_API_KEY?.trim()) {
        try {
          const scanned = await scanLinenInvoice(buffer, file.type || guessContentType(file.name), file.name);
          ocrSnapshot = scanned.raw;
        } catch (e) {
          console.error("[linen delivery OCR]", e);
        }
      }

      const ext = path.extname(file.name) || ".bin";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      invoicePath = buildUploadPath(["uploads", "linen", hotelId], safeName);
      await putStoredFile(
        storageKeyFromFilePath(invoicePath),
        buffer,
        file.type || guessContentType(safeName)
      );
      invoiceName = file.name;
      invoiceSize = formatBytes(file.size);
    }

    const createdByName = await staffDisplayName(session);

    const row = await prisma.linenDelivery.create({
      data: {
        hotelId,
        deliveredAt,
        pillowcases,
        sheets,
        duvetCovers,
        washCost,
        isPaid,
        notes,
        invoicePath,
        invoiceName,
        invoiceSize,
        createdByName,
        ocrSnapshot: ocrSnapshot ? (ocrSnapshot as object) : undefined,
      },
    });

    const days = Math.min(90, Math.max(7, Number(formData.get("periodDays")) || 30));
    const overview = await buildLinenOverview(hotelId, days);

    return NextResponse.json({
      ok: true,
      delivery: mapLinenDelivery(row),
      overview,
    });
  } catch (e) {
    console.error("[linen deliveries POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
