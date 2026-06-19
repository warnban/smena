import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const amount = Math.round(Number(body.amount));
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
  }
  if (!body.hotelId) return NextResponse.json({ error: "Не указан отель" }, { status: 400 });

  const auth = await assertHotelWrite(session, String(body.hotelId));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const dateResolved = resolveTransactionDateInput(auth.session.role, body.date ?? body.operationDate);
  if (!dateResolved.ok) {
    return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
  }

  const payLock = await assertPaymentOperationAllowed(
    auth.hotel.id,
    auth.session.role,
    dateResolved.dateKey
  );
  if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

  const tx = await prisma.transaction.create({
    data: {
      hotelId: auth.hotel.id,
      type: "encashment",
      category: "encashment",
      paymentMethod: body.paymentMethod ?? "cash",
      amount,
      date: dateResolved.date,
      note: body.note || "Инкассация",
    },
  });

  return NextResponse.json({ ok: true, tx });
}
