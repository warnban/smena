import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { syncScheduledCleaning } from "@/lib/housekeeping";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId");

  let hotelIds: string[];
  if (session.role === "owner") {
    const hotels = await prisma.hotel.findMany({ where: { seatId: session.seatId }, select: { id: true } });
    hotelIds = hotels.map((h) => h.id);
  } else {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
      include: { hotels: true },
    });
    hotelIds = staff?.hotels.map((h) => h.hotelId) ?? [];
  }

  const filter = {
    hotelId: hotelId && hotelId !== "all" ? hotelId : { in: hotelIds },
  };

  await syncScheduledCleaning(
    prisma,
    hotelId && hotelId !== "all" ? [hotelId] : hotelIds
  );

  const tasks = await prisma.hkTask.findMany({
    where: filter,
    orderBy: [{ status: "asc" }, { time: "asc" }],
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { hotelId, roomId, roomNumber, type, category, assignee, priority = "normal", time = "", est = "" } = body;

  if (!hotelId || !roomNumber?.trim() || !type?.trim()) {
    return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
  }

  const hotel = await prisma.hotel.findFirst({ where: { id: hotelId, seatId: session.seatId } });
  if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

  const task = await prisma.hkTask.create({
    data: {
      hotelId,
      roomId: roomId || null,
      roomNumber: String(roomNumber).trim(),
      type: String(type).trim(),
      category: category && ["checkout", "relocation", "scheduled"].includes(category) ? category : "checkout",
      assignee: String(assignee || "").trim() || "—",
      priority: priority === "high" ? "high" : "normal",
      time: String(time),
      est: String(est),
    },
  });

  return NextResponse.json({ ok: true, task });
}
