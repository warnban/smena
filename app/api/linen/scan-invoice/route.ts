import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { guessContentType } from "@/lib/object-storage.server";
import { scanLinenInvoice } from "@/lib/linen-invoice-scan.server";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.AITUNNEL_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "Распознавание не настроено: добавьте AITUNNEL_API_KEY в .env" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const hotelId = String(formData.get("hotelId") ?? "").trim();
    if (!hotelId) {
      return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const file = formData.get("file") as File | null;
    if (!file?.size) {
      return NextResponse.json({ error: "Выберите файл накладной" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const scanned = await scanLinenInvoice(
      buffer,
      file.type || guessContentType(file.name),
      file.name
    );

    return NextResponse.json({ ok: true, scan: scanned });
  } catch (e) {
    console.error("[linen scan-invoice POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
