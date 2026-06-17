import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage, getManagerHotelIds } from "@/lib/permissions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const check = await assertCanManage(session);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const hotel = await prisma.hotel.findFirst({
    where: { id: params.id, seatId: check.session.seatId },
  });
  if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

  const allowedHotels = await getManagerHotelIds(check.session);
  if (allowedHotels !== "all" && !allowedHotels.includes(hotel.id)) {
    return NextResponse.json({ error: "Нет доступа к отелю" }, { status: 403 });
  }

  const body = await req.json();
  const { name, city, address, stars, phone, email, legalName, website } = body;

  const updated = await prisma.hotel.update({
    where: { id: hotel.id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(city !== undefined ? { city: String(city).trim() } : {}),
      ...(address !== undefined ? { address: String(address).trim() } : {}),
      ...(stars !== undefined ? { stars: Number(stars) || 3 } : {}),
      ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim() } : {}),
      ...(legalName !== undefined ? { legalName: String(legalName).trim() } : {}),
      ...(website !== undefined ? { website: String(website).trim() } : {}),
    },
  });

  return NextResponse.json({ ok: true, hotel: updated });
}
