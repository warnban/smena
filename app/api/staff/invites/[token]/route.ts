import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const invite = await prisma.staffInvite.findUnique({
    where: { token: params.token },
    include: {
      seat: { select: { name: true } },
    },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Приглашение недействительно или просрочено" }, { status: 404 });
  }

  const hotels = await prisma.hotel.findMany({
    where: { id: { in: invite.hotelIds }, seatId: invite.seatId },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    seatName: invite.seat.name,
    role: invite.role,
    roleLabel: ROLE_LABELS[invite.role] ?? invite.role,
    position: invite.position,
    hotels,
    email: invite.email,
    expiresAt: invite.expiresAt,
  });
}
