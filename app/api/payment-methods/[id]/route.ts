import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const method = await prisma.paymentMethodDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!method) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  await prisma.paymentMethodDef.update({
    where: { id: method.id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const method = await prisma.paymentMethodDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!method) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.paymentMethodDef.update({
    where: { id: method.id },
    data: {
      ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.bg !== undefined ? { bg: body.bg } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ ok: true, method: updated });
}
