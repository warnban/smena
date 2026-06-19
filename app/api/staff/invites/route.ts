import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  assertCanManage,
  getManagerHotelIds,
  inviteRoleAllowed,
  ROLE_POSITIONS,
} from "@/lib/permissions";
import type { UserRole } from "@prisma/client";
import { resolvePublicOrigin, staffInviteUrl } from "@/lib/public-url.server";

const INVITE_TTL_DAYS = 7;

export async function GET(req: NextRequest) {
  const session = await getSession();
  const check = await assertCanManage(session);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const invites = await prisma.staffInvite.findMany({
    where: { seatId: check.session.seatId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      role: true,
      position: true,
      hotelIds: true,
      email: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const origin = resolvePublicOrigin(req);

  return NextResponse.json({
    invites: invites.map((inv) => ({
      ...inv,
      url: staffInviteUrl(origin, inv.token),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const check = await assertCanManage(session);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await req.json();
  const { role, position, hotelIds = [], email } = body as {
    role?: UserRole;
    position?: string;
    hotelIds?: string[];
    email?: string;
  };

  const targetRole = (role ?? "staff") as UserRole;
  if (!inviteRoleAllowed(check.session.role, targetRole)) {
    return NextResponse.json({ error: "Нельзя пригласить с этой ролью" }, { status: 400 });
  }

  if (!hotelIds.length) {
    return NextResponse.json({ error: "Выберите хотя бы один отель" }, { status: 400 });
  }

  const allowedHotels = await getManagerHotelIds(check.session);
  const validHotelIds =
    allowedHotels === "all"
      ? hotelIds
      : hotelIds.filter((id) => allowedHotels.includes(id));

  if (!validHotelIds.length) {
    return NextResponse.json({ error: "Нет доступа к выбранным отелям" }, { status: 403 });
  }

  const hotels = await prisma.hotel.findMany({
    where: { seatId: check.session.seatId, id: { in: validHotelIds } },
    select: { id: true },
  });
  if (!hotels.length) {
    return NextResponse.json({ error: "Отели не найдены" }, { status: 404 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const invite = await prisma.staffInvite.create({
    data: {
      token,
      seatId: check.session.seatId,
      role: targetRole,
      position: position?.trim() || ROLE_POSITIONS[targetRole] || "",
      hotelIds: hotels.map((h) => h.id),
      email: email?.trim().toLowerCase() || null,
      createdById: check.session.userId,
      expiresAt,
    },
  });

  const origin = resolvePublicOrigin(req);
  const url = staffInviteUrl(origin, invite.token);

  return NextResponse.json({ ok: true, invite, url });
}
