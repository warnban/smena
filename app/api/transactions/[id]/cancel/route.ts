import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { cancelTransaction } from "@/lib/transaction-cancel.server";
import { prisma } from "@/lib/prisma";
import { apiErrorMessage } from "@/lib/api-error";

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: RouteParams["params"]): Promise<string> {
  const resolved = await Promise.resolve(params);
  return resolved.id?.trim() ?? "";
}

export async function POST(_req: Request, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveId(context.params);
    if (!id) {
      return NextResponse.json({ error: "Не указан id транзакции" }, { status: 400 });
    }

    const tx = await prisma.transaction.findFirst({
      where: { id, hotel: { seatId: session.seatId } },
      select: { id: true, hotelId: true },
    });
    if (!tx) {
      return NextResponse.json({ error: "Транзакция не найдена" }, { status: 404 });
    }

    const auth = await assertCanManageHotel(session, tx.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await cancelTransaction(id, session.seatId, session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[transactions cancel]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось отменить транзакцию") }, { status: 500 });
  }
}
