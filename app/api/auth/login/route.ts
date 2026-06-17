import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Укажите email и пароль" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { staff: true },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  if (user.isBlocked) {
    return NextResponse.json({ error: "Аккаунт заблокирован. Обратитесь к администратору." }, { status: 403 });
  }

  if (!user.seatId) {
    return NextResponse.json({ error: "Аккаунт не привязан к сети" }, { status: 403 });
  }

  const token = await generateToken({
    userId: user.id,
    seatId: user.seatId,
    email: user.email,
    role: user.role,
    staffId: user.staff?.id,
  });
  await setAuthCookie(token);

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, seatId: user.seatId },
  });
}
