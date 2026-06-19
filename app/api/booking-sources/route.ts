import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";
import { ensureBookingSources } from "@/lib/ensure-booking-sources";
import { colorToBg, normalizeHexColor } from "@/lib/color-utils";

export async function GET() {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sources = await ensureBookingSources(auth.session.seatId);
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const code = String(body.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const label = String(body.label ?? "").trim();
  if (!code || !label) {
    return NextResponse.json({ error: "Укажите код и название" }, { status: 400 });
  }

  const maxOrder = await prisma.bookingSourceDef.aggregate({
    where: { seatId: auth.session.seatId },
    _max: { sortOrder: true },
  });

  const color = normalizeHexColor(body.color ?? "#D97706");
  const bg = body.bg ? normalizeHexColor(body.bg, colorToBg(color)) : colorToBg(color);

  const source = await prisma.bookingSourceDef.create({
    data: {
      seatId: auth.session.seatId,
      code,
      label,
      color,
      bg,
      text: body.text ? normalizeHexColor(body.text, "#92400E") : "#92400E",
      border: body.border ? normalizeHexColor(body.border, "#FDE68A") : "#FDE68A",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      active: true,
    },
  });

  return NextResponse.json({ ok: true, source });
}
