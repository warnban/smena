import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const password = String(body.password ?? "");
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        devPasswordPlain: password,
      },
    });

    return NextResponse.json({ ok: true, devPasswordPlain: password });
  } catch (e) {
    console.error("[platform user password]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
