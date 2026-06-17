import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, name, seatName } = body as {
    email?: string;
    password?: string;
    name?: string;
    seatName?: string;
  };

  if (!email?.trim() || !password || password.length < 6 || !name?.trim()) {
    return NextResponse.json({ error: "Заполните email, имя и пароль (мин. 6 символов)" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (exists) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const networkLabel = seatName?.trim() || `${name.trim()} — сеть`;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash: hash,
        name: name.trim(),
        role: "owner",
        devPasswordPlain: password,
      },
    });

    const seat = await tx.seat.create({
      data: {
        name: networkLabel,
        ownerId: user.id,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { seatId: seat.id },
    });

    const initials = name
      .trim()
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const staff = await tx.staff.create({
      data: {
        seatId: seat.id,
        userId: user.id,
        name: name.trim(),
        role: "owner",
        position: "Владелец",
        initials,
      },
    });

    return { user, seat, staff };
  });

  const token = await generateToken({
    userId: result.user.id,
    seatId: result.seat.id,
    email: result.user.email,
    role: "owner",
    staffId: result.staff.id,
  });
  await setAuthCookie(token);

  return NextResponse.json({
    user: { id: result.user.id, email: result.user.email, name: result.user.name, role: "owner" },
    seat: { id: result.seat.id, name: result.seat.name },
  });
}
