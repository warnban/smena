import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import { isExpenseType } from "@/lib/finance";
import {
  canEditTransaction,
  directionFromTxType,
  manualTxTypeFromDirection,
} from "@/lib/transaction-manual.server";
import { apiErrorMessage } from "@/lib/api-error";

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: RouteParams["params"]): Promise<string> {
  const resolved = await Promise.resolve(params);
  return resolved.id?.trim() ?? "";
}

export async function GET(_req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveId(context.params);
    const tx = await prisma.transaction.findFirst({
      where: { id, hotel: { seatId: session.seatId } },
    });
    if (!tx) return NextResponse.json({ error: "Транзакция не найдена" }, { status: 404 });

    const editable = await canEditTransaction(tx);

    return NextResponse.json({
      transaction: tx,
      editable: editable.ok,
      editBlockReason: editable.ok ? null : editable.reason,
      direction: directionFromTxType(tx.type),
    });
  } catch (e) {
    console.error("[transactions GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = await resolveId(context.params);
    const tx = await prisma.transaction.findFirst({
      where: { id, hotel: { seatId: session.seatId } },
    });
    if (!tx) return NextResponse.json({ error: "Транзакция не найдена" }, { status: 404 });

    const auth = await assertCanManageHotel(session, tx.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const editable = await canEditTransaction(tx);
    if (!editable.ok) {
      return NextResponse.json({ error: editable.reason }, { status: 403 });
    }

    const body = await req.json();
    const amount = body.amount != null ? Math.round(Number(body.amount)) : tx.amount;
    const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod) : tx.paymentMethod;
    const guestName = body.guestName != null ? String(body.guestName).trim() : (tx.guestName ?? "");
    const direction =
      body.direction === "expense" || body.direction === "income"
        ? body.direction
        : directionFromTxType(tx.type);

    if (amount <= 0) {
      return NextResponse.json({ error: "Сумма должна быть больше нуля" }, { status: 400 });
    }

    const newType = manualTxTypeFromDirection(direction);
    const wasExpense = isExpenseType(tx.type);
    const willExpense = direction === "expense";

    if (tx.type === "service" && wasExpense !== willExpense) {
      return NextResponse.json({ error: "Нельзя сменить тип у операции услуги" }, { status: 400 });
    }
    if (tx.type === "encashment" && direction === "income") {
      return NextResponse.json({ error: "Инкассация всегда является расходом" }, { status: 400 });
    }

    const preservedType =
      tx.type === "service" ? "service" : tx.type === "encashment" ? "encashment" : newType;

    const updated = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        amount,
        paymentMethod,
        guestName: guestName || null,
        type: preservedType,
      },
    });

    return NextResponse.json({ ok: true, transaction: updated });
  } catch (e) {
    console.error("[transactions PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сохранить изменения") }, { status: 500 });
  }
}
