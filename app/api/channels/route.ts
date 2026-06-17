import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanManage } from "@/lib/permissions";
import { slugifyChannelCode } from "@/lib/ota";

const CHANNEL_COLORS = ["#16A34A", "#2563EB", "#DC2626", "#EA580C", "#7C3AED", "#0891B2", "#D97706"];

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(
    await import("@/lib/auth").then((m) => m.getSession())
  );
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const hotelId = String(body.hotelId ?? "").trim();
  const name = String(body.name ?? "").trim();
  let code = String(body.code ?? "").trim();
  const commission = Math.max(0, Math.min(100, Math.round(Number(body.commission) || 0)));

  if (!hotelId || !name) {
    return NextResponse.json({ error: "Укажите отель и название канала" }, { status: 400 });
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, seatId: auth.session.seatId },
  });
  if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

  if (!code) code = slugifyChannelCode(name);

  const dup = await prisma.channel.findFirst({ where: { hotelId, code } });
  if (dup) return NextResponse.json({ error: "Канал с таким кодом уже есть" }, { status: 409 });

  const count = await prisma.channel.count({ where: { hotelId } });
  const channel = await prisma.channel.create({
    data: {
      hotelId,
      name,
      code,
      color: String(body.color ?? CHANNEL_COLORS[count % CHANNEL_COLORS.length]),
      commission,
      rate: Math.max(0, Math.round(Number(body.rate) || 0)),
    },
  });

  return NextResponse.json({ ok: true, channel });
}
