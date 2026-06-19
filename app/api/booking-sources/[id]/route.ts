import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";
import { normalizeHexColor } from "@/lib/color-utils";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const source = await prisma.bookingSourceDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!source) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  await prisma.bookingSourceDef.update({
    where: { id: source.id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const source = await prisma.bookingSourceDef.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
  });
  if (!source) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.bookingSourceDef.update({
    where: { id: source.id },
    data: {
      ...(body.label !== undefined ? { label: String(body.label).trim() } : {}),
      ...(body.color !== undefined ? { color: normalizeHexColor(body.color) } : {}),
      ...(body.bg !== undefined ? { bg: normalizeHexColor(body.bg) } : {}),
      ...(body.text !== undefined ? { text: normalizeHexColor(body.text) } : {}),
      ...(body.border !== undefined ? { border: normalizeHexColor(body.border) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ ok: true, source: updated });
}
