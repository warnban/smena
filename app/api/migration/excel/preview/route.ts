import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { previewExcelImport } from "@/lib/migration/excel-import.server";
import { apiErrorMessage } from "@/lib/api-error";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId || session.role !== "owner") {
      return NextResponse.json({ error: "Только владелец может импортировать данные" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Загрузите файл .xlsx" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Файл слишком большой (макс. 25 МБ)" }, { status: 400 });
    }

    const preview = await previewExcelImport(session.seatId, buffer);
    return NextResponse.json(preview);
  } catch (e) {
    console.error("[migration/excel/preview]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
