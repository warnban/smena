import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildOrganizationPaymentNote } from "@/lib/organization-transaction-notes";
import { assertHotelWrite } from "@/lib/permissions";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stay = await prisma.organizationStay.findUnique({
      where: { id: params.id },
      include: { organization: true },
    });
    if (!stay || stay.organization.seatId !== session.seatId) {
      return NextResponse.json({ error: "Проживание не найдено" }, { status: 404 });
    }

    const auth = await assertHotelWrite(session, stay.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();

    const dateResolved = resolveTransactionDateInput(session.role, body.date ?? body.operationDate);
    if (!dateResolved.ok) {
      return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
    }

    const payLock = await assertPaymentOperationAllowed(
      stay.hotelId,
      session.role,
      dateResolved.dateKey
    );
    if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

    const amount = Math.round(Number(body.amount));
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    const paymentMethod = String(body.paymentMethod ?? "cash");
    const org = stay.organization;
    const paidBefore = stay.paid;

    const [, updatedStay] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          hotelId: stay.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod,
          amount,
          date: dateResolved.date,
          organizationId: org.id,
          organizationStayId: stay.id,
          guestName: org.name,
          note: buildOrganizationPaymentNote(
            org.name,
            stay.checkIn,
            stay.checkOut,
            amount,
            paidBefore,
            stay.amount,
            body.note ?? null
          ),
        },
      }),
      prisma.organizationStay.update({
        where: { id: stay.id },
        data: { paid: Math.min(stay.amount, stay.paid + amount) },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { totalSpent: org.totalSpent + amount },
      }),
    ]);

    return NextResponse.json({ ok: true, stay: updatedStay });
  } catch (e) {
    console.error("[organization-stay payment]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось принять платёж") }, { status: 500 });
  }
}
