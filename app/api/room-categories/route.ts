import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";
import { ensureRoomCategories } from "@/lib/ensure-room-categories";
import { slugifyCategoryCode } from "@/lib/room-categories";

export async function GET() {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const categories = await ensureRoomCategories(auth.session.seatId);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const label = String(body.label ?? "").trim();
  let code = String(body.code ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "Укажите название категории" }, { status: 400 });
  }
  if (!code) code = slugifyCategoryCode(label);

  const duplicate = await prisma.roomCategoryDef.findFirst({
    where: { seatId: auth.session.seatId, code },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Категория с таким кодом уже существует" }, { status: 409 });
  }

  const maxOrder = await prisma.roomCategoryDef.aggregate({
    where: { seatId: auth.session.seatId },
    _max: { sortOrder: true },
  });

  const category = await prisma.roomCategoryDef.create({
    data: {
      seatId: auth.session.seatId,
      code,
      label,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      active: true,
    },
  });

  return NextResponse.json({ ok: true, category });
}
