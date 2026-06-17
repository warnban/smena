import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertSeatOps(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const org = await prisma.organization.findFirst({
      where: { id: params.id, seatId: auth.session.seatId },
    });
    if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });

    const body = await req.json();
    const name = body.name !== undefined ? String(body.name).trim() : org.name;
    if (!name) {
      return NextResponse.json({ error: "Укажите название организации" }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name,
        ...(body.inn !== undefined ? { inn: String(body.inn).trim() } : {}),
        ...(body.contactPerson !== undefined ? { contactPerson: String(body.contactPerson).trim() } : {}),
        ...(body.phone !== undefined ? { phone: String(body.phone).trim() } : {}),
        ...(body.email !== undefined ? { email: String(body.email).trim() } : {}),
        ...(body.notes !== undefined ? { notes: String(body.notes).trim() } : {}),
        ...(body.skipWeeklyCleaning !== undefined ? { skipWeeklyCleaning: Boolean(body.skipWeeklyCleaning) } : {}),
      },
      include: { documents: { orderBy: { uploadedAt: "desc" } } },
    });

    return NextResponse.json({ ok: true, organization: updated });
  } catch (e) {
    console.error("[organizations PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось обновить организацию") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertSeatOps(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const org = await prisma.organization.findFirst({
    where: { id: params.id, seatId: auth.session.seatId },
    include: { stays: { where: { status: "active" }, take: 1 } },
  });
  if (!org) return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  if (org.stays.length) {
    return NextResponse.json({ error: "Нельзя удалить организацию с активным проживанием" }, { status: 400 });
  }

  await prisma.organization.delete({ where: { id: org.id } });
  return NextResponse.json({ ok: true });
}
