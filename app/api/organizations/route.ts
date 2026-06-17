import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET() {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    where: { seatId: session.seatId },
    include: { documents: { orderBy: { uploadedAt: "desc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ organizations: orgs });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await assertSeatOps(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Укажите название организации" }, { status: 400 });
    }

    const org = await prisma.organization.create({
      data: {
        seatId: auth.session.seatId,
        name,
        inn: String(body.inn ?? "").trim(),
        contactPerson: String(body.contactPerson ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        email: String(body.email ?? "").trim(),
        notes: String(body.notes ?? "").trim(),
        skipWeeklyCleaning: Boolean(body.skipWeeklyCleaning),
      },
      include: { documents: true },
    });

    return NextResponse.json({ ok: true, organization: org });
  } catch (e) {
    console.error("[organizations POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось создать организацию") }, { status: 500 });
  }
}
