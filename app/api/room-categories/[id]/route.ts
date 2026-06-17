import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const category = await prisma.roomCategoryDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!category) return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });

  const activeCount = await prisma.roomCategoryDef.count({
    where: { seatId: auth.session.seatId, active: true },
  });
  if (activeCount <= 1 && category.active) {
    return NextResponse.json({ error: "Нельзя удалить последнюю категорию" }, { status: 400 });
  }

  const roomCount = await prisma.room.count({
    where: {
      category: category.code,
      hotel: { seatId: auth.session.seatId },
    },
  });
  if (roomCount > 0) {
    return NextResponse.json(
      { error: `Категория используется в ${roomCount} номер(ах). Сначала переназначьте номера.` },
      { status: 409 }
    );
  }

  await prisma.roomCategoryDef.delete({ where: { id: category.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const category = await prisma.roomCategoryDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!category) return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.roomCategoryDef.update({
    where: { id: category.id },
    data: {
      ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ ok: true, category: updated });
}
