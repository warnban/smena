import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotel = await prisma.hotel.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!hotel) {
      return NextResponse.json({ error: "Отель не найден" }, { status: 404 });
    }

    const rules = await prisma.hotelDiscountRule.findMany({
      where: { hotelId: params.id },
      orderBy: [{ minNights: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json({ rules });
  } catch (e) {
    console.error("[discount-rules GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await assertHotelWrite(session, params.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (session.role !== "owner" && session.role !== "manager") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await req.json();
    const incoming = Array.isArray(body.rules) ? body.rules : [];

    const normalized = incoming.map((r: Record<string, unknown>, idx: number) => {
      const minNights = Math.max(1, Math.round(Number(r.minNights) || 1));
      const discountPercent = Math.max(0, Math.min(100, Math.round(Number(r.discountPercent) || 0)));
      const discountPerNight = Math.max(0, Math.round(Number(r.discountPerNight) || 0));
      if (discountPercent <= 0 && discountPerNight <= 0) {
        throw new Error(`Правило ${idx + 1}: укажите скидку в % или ₽/сут.`);
      }
      return {
        id: r.id ? String(r.id) : undefined,
        name: String(r.name ?? "").trim(),
        minNights,
        discountPercent,
        discountPerNight,
        paymentMethod: r.paymentMethod ? String(r.paymentMethod) : null,
        active: r.active !== false,
        sortOrder: Math.round(Number(r.sortOrder) || idx),
      };
    });

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.hotelDiscountRule.findMany({
        where: { hotelId: params.id },
        select: { id: true },
      });
      const keepIds = normalized.filter((r: { id?: string }) => r.id).map((r: { id?: string }) => r.id as string);
      const deleteIds = existing.map((e) => e.id).filter((id) => !keepIds.includes(id));

      if (deleteIds.length) {
        await tx.hotelDiscountRule.deleteMany({ where: { id: { in: deleteIds } } });
      }

      const saved = [];
      for (const rule of normalized) {
        if (rule.id) {
          const updated = await tx.hotelDiscountRule.update({
            where: { id: rule.id },
            data: {
              name: rule.name,
              minNights: rule.minNights,
              discountPercent: rule.discountPercent,
              discountPerNight: rule.discountPerNight,
              paymentMethod: rule.paymentMethod,
              active: rule.active,
              sortOrder: rule.sortOrder,
            },
          });
          saved.push(updated);
        } else {
          const created = await tx.hotelDiscountRule.create({
            data: {
              hotelId: params.id,
              name: rule.name,
              minNights: rule.minNights,
              discountPercent: rule.discountPercent,
              discountPerNight: rule.discountPerNight,
              paymentMethod: rule.paymentMethod,
              active: rule.active,
              sortOrder: rule.sortOrder,
            },
          });
          saved.push(created);
        }
      }
      return saved;
    });

    return NextResponse.json({ ok: true, rules: result });
  } catch (e) {
    console.error("[discount-rules PUT]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сохранить правила") }, { status: 500 });
  }
}
