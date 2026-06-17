import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const blocked = Boolean(body.blocked);

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        isBlocked: blocked,
        blockedAt: blocked ? new Date() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        isBlocked: updated.isBlocked,
        blockedAt: updated.blockedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    console.error("[platform user block]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
