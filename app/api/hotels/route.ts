import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const check = await assertCanManage(session);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const { name, city, address, stars = 3, phone = "", email = "", legalName = "", website = "" } = body;
  if (!name?.trim() || !city?.trim()) {
    return NextResponse.json({ error: "Укажите название и город" }, { status: 400 });
  }

  const hotel = await prisma.hotel.create({
    data: {
      seatId: check.session.seatId,
      name: name.trim(),
      city: city.trim(),
      address: address?.trim() ?? "",
      stars: Number(stars) || 3,
      phone: phone.trim(),
      email: email.trim(),
      legalName: String(legalName).trim(),
      website: String(website).trim(),
    },
  });

  return NextResponse.json({ ok: true, hotel });
}
