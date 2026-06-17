import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import type { CatalogKind } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind") as CatalogKind | null;
  const items = await prisma.service.findMany({
    where: {
      seatId: session.seatId,
      active: true,
      ...(kind ? { kind } : {}),
    },
    orderBy: [{ kind: "asc" }, { price: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const kind = (body.kind === "expense" ? "expense" : "service") as CatalogKind;
  const category = body.category ?? "extra";
  const price = Math.round(Number(body.price) || 0);

  if (!name) return NextResponse.json({ error: "Укажите название" }, { status: 400 });

  const item = await prisma.service.create({
    data: {
      seatId: auth.session.seatId,
      kind,
      category,
      name,
      price,
      icon: body.icon ?? (kind === "expense" ? "📤" : "🛎"),
      active: true,
    },
  });

  return NextResponse.json({ ok: true, item });
}
