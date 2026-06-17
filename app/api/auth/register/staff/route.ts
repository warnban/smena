import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, name, email, password } = body as {
    token?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  if (!token?.trim() || !name?.trim() || !email?.trim() || !password || password.length < 6) {
    return NextResponse.json({ error: "Заполните все поля (пароль мин. 6 символов)" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const invite = await prisma.staffInvite.findUnique({ where: { token: token.trim() } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Приглашение недействительно или просрочено" }, { status: 404 });
  }

  if (invite.email && invite.email !== normalizedEmail) {
    return NextResponse.json({ error: "Email не совпадает с приглашением" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const hotels = await prisma.hotel.findMany({
    where: { id: { in: invite.hotelIds }, seatId: invite.seatId },
    select: { id: true },
  });
  if (!hotels.length) {
    return NextResponse.json({ error: "Отели приглашения не найдены" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const initials = name
    .trim()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hash,
        devPasswordPlain: password,
        name: name.trim(),
        role: invite.role,
        seatId: invite.seatId,
      },
    });

    const staff = await tx.staff.create({
      data: {
        seatId: invite.seatId,
        userId: user.id,
        name: name.trim(),
        role: invite.role,
        position: invite.position,
        initials,
        hotels: {
          create: hotels.map((h) => ({ hotelId: h.id })),
        },
      },
    });

    await tx.staffInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date(), usedByUserId: user.id },
    });

    return { user, staff };
  });

  const jwt = await generateToken({
    userId: result.user.id,
    seatId: invite.seatId,
    email: result.user.email,
    role: invite.role,
    staffId: result.staff.id,
  });
  await setAuthCookie(jwt);

  return NextResponse.json({
    ok: true,
    user: { id: result.user.id, email: result.user.email, name: result.user.name, role: invite.role },
  });
}
