import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertHotelWrite, canManageSettings } from "@/lib/permissions";
import { mskDateKey } from "@/lib/msk-time";
import { apiErrorMessage } from "@/lib/api-error";

const TYPE_LABELS: Record<string, string> = {
  payment: "Выплата зарплаты",
  bonus: "Премия",
  penalty: "Штраф",
  accrual: "Начисление",
};

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotelId = req.nextUrl.searchParams.get("hotelId") ?? "";
    const from = req.nextUrl.searchParams.get("from") ?? "";
    const to = req.nextUrl.searchParams.get("to") ?? "";
    if (!hotelId) return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const canManage = canManageSettings(session.role);
    const currentStaff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
    });

    const where = {
      hotelId,
      type: { in: ["payment", "bonus", "penalty"] as ("payment" | "bonus" | "penalty")[] },
      ...(canManage ? {} : { staffId: currentStaff?.id ?? "__none__" }),
      ...(from && to
        ? { date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } }
        : {}),
    };

    const entries = await prisma.salaryLedgerEntry.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        transaction: { select: { paymentMethod: true, note: true, date: true } },
      },
      orderBy: { date: "desc" },
    });

    const receipts = entries.map((e) => ({
      id: e.id,
      date: mskDateKey(e.date),
      staffId: e.staffId,
      staffName: e.staff.name,
      type: e.type,
      typeLabel: TYPE_LABELS[e.type] ?? e.type,
      amount: e.amount,
      paymentMethod: e.paymentMethod ?? e.transaction?.paymentMethod ?? "",
      note: e.note || e.transaction?.note || "",
      bonusRunId: e.bonusRunId,
    }));

    return NextResponse.json({ receipts, canManage });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

/** Немедленная выплата штрафа/премии вне KPI-черновика. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId || !canManageSettings(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "");
    const staffId = String(body.staffId ?? "");
    const amount = Math.round(Number(body.amount) || 0);
    const paymentMethod = String(body.paymentMethod ?? "cash");
    const kind = body.kind === "penalty" ? "penalty" : body.kind === "bonus" ? "bonus" : "salary";
    const note = String(body.note ?? "").trim();

    if (!hotelId || !staffId || amount <= 0) {
      return NextResponse.json({ error: "Укажите отель, сотрудника и сумму" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const staff = await prisma.staff.findFirst({ where: { id: staffId, seatId: session.seatId } });
    if (!staff) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

    const now = new Date();
    const category = kind === "bonus" ? "bonus" : "salary";
    const ledgerType = kind === "penalty" ? "penalty" : kind === "bonus" ? "bonus" : "payment";

    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          hotelId,
          date: now,
          type: "expense",
          category,
          paymentMethod,
          amount,
          guestName: staff.name,
          note: note || (kind === "penalty" ? "Штраф" : kind === "bonus" ? "Премия" : "Зарплата"),
        },
      });
      await tx.salaryLedgerEntry.create({
        data: {
          staffId,
          hotelId,
          date: now,
          type: ledgerType,
          amount,
          paymentMethod,
          transactionId: transaction.id,
          note: note || "",
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
