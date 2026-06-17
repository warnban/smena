import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { deleteStoredFile } from "@/lib/object-storage.server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const auth = await assertSeatOps(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const doc = await prisma.organizationDocument.findFirst({
    where: {
      id: params.docId,
      organizationId: params.id,
      organization: { seatId: auth.session.seatId },
    },
  });
  if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });

  await deleteStoredFile(doc.filePath);

  await prisma.organizationDocument.delete({ where: { id: doc.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const auth = await assertSeatOps(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const doc = await prisma.organizationDocument.findFirst({
    where: {
      id: params.docId,
      organizationId: params.id,
      organization: { seatId: auth.session.seatId },
    },
  });
  if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Укажите название" }, { status: 400 });

  const updated = await prisma.organizationDocument.update({
    where: { id: doc.id },
    data: { name },
  });

  return NextResponse.json({ ok: true, document: updated });
}
