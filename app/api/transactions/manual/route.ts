import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel } from "@/lib/permissions";
import {
  categoryCodeFromLabel,
  MANUAL_TX_BLOCKED_CATEGORIES,
  normalizeCategoryLabel,
} from "@/lib/transaction-categories";
import { isReportDayClosed, manualTxTypeFromDirection } from "@/lib/transaction-manual.server";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { mskDateKey } from "@/lib/msk-time";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "");
    const direction = body.direction === "expense" ? "expense" : "income";
    const paymentMethod = String(body.paymentMethod ?? "cash");
    const amount = Math.round(Number(body.amount) || 0);
    const guestName = String(body.guestName ?? "").trim();
    const note = String(body.note ?? "").trim();
    const categoryInput = String(body.category ?? body.categoryLabel ?? "").trim();

    if (!hotelId || !categoryInput || amount <= 0) {
      return NextResponse.json({ error: "Укажите отель, категорию и сумму" }, { status: 400 });
    }

    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payLock = await assertPaymentOperationAllowed(hotelId, session.role, mskDateKey());
    if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

    const dateResolved = resolveTransactionDateInput(session.role, body.date ?? body.operationDate);
    if (!dateResolved.ok) {
      return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
    }

    if (!dateResolved.isBackdate && (await isReportDayClosed(hotelId, dateResolved.dateKey))) {
      return NextResponse.json({ error: "Сутки закрыты отчётом — создание транзакций недоступно" }, { status: 403 });
    }

    const label = normalizeCategoryLabel(categoryInput);
    const code = categoryCodeFromLabel(label);
    if (MANUAL_TX_BLOCKED_CATEGORIES.has(code)) {
      return NextResponse.json({ error: "Эту категорию нельзя использовать для ручной транзакции" }, { status: 400 });
    }

    const txType = manualTxTypeFromDirection(direction);

    const result = await prisma.$transaction(async (db) => {
      await db.transactionCategoryDef.upsert({
        where: { seatId_code: { seatId: session.seatId, code } },
        create: { seatId: session.seatId, code, label },
        update: { label },
      });

      const tx = await db.transaction.create({
        data: {
          hotelId,
          type: txType,
          category: code,
          paymentMethod,
          amount,
          date: dateResolved.date,
          guestName: guestName || null,
          note: note || label,
        },
      });

      return tx;
    });

    return NextResponse.json({ ok: true, transaction: result, category: { code, label } });
  } catch (e) {
    console.error("[transactions/manual POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось создать транзакцию") }, { status: 500 });
  }
}
