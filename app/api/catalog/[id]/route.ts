import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const item = await prisma.service.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!item) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  await prisma.service.update({ where: { id: item.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const item = await prisma.service.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!item) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.service.update({
    where: { id: item.id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.price !== undefined ? { price: Math.round(Number(body.price) || 0) } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ ok: true, item: updated });
}
