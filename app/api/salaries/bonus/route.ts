import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManageHotel, assertHotelWrite, canManageSettings } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import {
  buildKpiSnapshot,
  periodMonthKeys,
  rulesMet,
} from "@/lib/kpi-bonus";
import { apiErrorMessage } from "@/lib/api-error";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotelId = req.nextUrl.searchParams.get("hotelId") ?? "";
    const periodMonth = req.nextUrl.searchParams.get("periodMonth") ?? "";
    if (!hotelId || !periodMonth) {
      return NextResponse.json({ error: "hotelId и periodMonth обязательны" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const run = await prisma.bonusCalculationRun.findFirst({
      where: { hotelId, periodMonth, status: "draft" },
      include: {
        lines: { include: { staff: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const paidRun = await prisma.bonusCalculationRun.findFirst({
      where: { hotelId, periodMonth, status: "paid" },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json({ draft: run, paidRun: paidRun ? { id: paidRun.id, paidAt: paidRun.paidAt } : null });
  } catch (e) {
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

/** Рассчитать премию (перезаписывает черновик). */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId || !canManageSettings(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await req.json();
    const hotelId = String(body.hotelId ?? "");
    const periodMonth = String(body.periodMonth ?? "").slice(0, 7);
    if (!hotelId || !/^\d{4}-\d{2}$/.test(periodMonth)) {
      return NextResponse.json({ error: "Укажите отель и месяц YYYY-MM" }, { status: 400 });
    }

    const auth = await assertCanManageHotel(session, hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { year, month } = { year: Number(periodMonth.slice(0, 4)), month: Number(periodMonth.slice(5, 7)) - 1 };
    const { from, to } = periodMonthKeys(periodMonth);

    const [rules, staff, schedule, transactions, bookings, rooms] = await Promise.all([
      prisma.kpiBonusRule.findMany({ where: { hotelId, active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.staff.findMany({
        where: { seatId: session.seatId, hotels: { some: { hotelId } } },
        select: { id: true, name: true },
      }),
      prisma.workScheduleEntry.findMany({
        where: { hotelId, date: { gte: parseMskDateKey(from), lte: parseMskDateKey(to) } },
        select: { staffId: true },
      }),
      prisma.transaction.findMany({ where: { hotelId } }),
      prisma.booking.findMany({ where: { hotelId } }),
      prisma.room.findMany({ where: { hotelId } }),
    ]);

    const staffWithShifts = new Set(schedule.map((s) => s.staffId));
    const eligibleStaff = staff.filter((s) => staffWithShifts.has(s.id));
    const snapshot = buildKpiSnapshot(transactions, bookings, rooms, year, month);
    const met = rulesMet(snapshot, rules);

    /** Каждый сотрудник со сменами получает полную сумму по каждому выполненному правилу. */
    const bonusPerStaff = met.reduce((sum, r) => sum + r.bonusAmount, 0);

    const autoLines = eligibleStaff.map((s) => {
      const reasons = met.map((r) => `${r.label || r.metric}: ${r.actual} ≥ ${r.threshold}`).join("; ");
      return {
        staffId: s.id,
        amount: bonusPerStaff,
        reason: met.length ? `KPI: ${reasons}` : "KPI не достигнуты",
        isManual: false,
        included: bonusPerStaff > 0,
      };
    });

    const run = await prisma.$transaction(async (tx) => {
      await tx.bonusCalculationLine.deleteMany({
        where: { run: { hotelId, periodMonth, status: "draft" } },
      });
      await tx.bonusCalculationRun.deleteMany({ where: { hotelId, periodMonth, status: "draft" } });

      const created = await tx.bonusCalculationRun.create({
        data: {
          hotelId,
          periodMonth,
          status: "draft",
          kpiSnapshot: snapshot,
          lines: { create: autoLines },
        },
        include: { lines: { include: { staff: { select: { id: true, name: true } } } } },
      });
      return created;
    });

    return NextResponse.json({ ok: true, run, snapshot, metRules: met });
  } catch (e) {
    console.error("[salaries/bonus POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось рассчитать премию") }, { status: 500 });
  }
}

/** Добавить ручную премию/штраф в черновик. */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId || !canManageSettings(session.role)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "pay") {
      const runId = String(body.runId ?? "");
      const paymentMethod = String(body.paymentMethod ?? "cash");
      const note = String(body.note ?? "").trim();
      if (!runId) return NextResponse.json({ error: "Укажите runId" }, { status: 400 });

      const run = await prisma.bonusCalculationRun.findFirst({
        where: { id: runId, status: "draft" },
        include: { lines: { where: { included: true, amount: { gt: 0 } }, include: { staff: true } }, hotel: true },
      });
      if (!run) return NextResponse.json({ error: "Черновик не найден" }, { status: 404 });

      const auth = await assertCanManageHotel(session, run.hotelId);
      if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

      const payLock = await assertPaymentsOpen(run.hotelId);
      if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        for (const line of run.lines) {
          const txRecord = await tx.transaction.create({
            data: {
              hotelId: run.hotelId,
              date: now,
              type: "expense",
              category: "bonus",
              paymentMethod,
              amount: line.amount,
              guestName: line.staff.name,
              note: note || line.reason || "Премия по KPI",
            },
          });
          await tx.salaryLedgerEntry.create({
            data: {
              staffId: line.staffId,
              hotelId: run.hotelId,
              date: now,
              type: "bonus",
              amount: line.amount,
              paymentMethod,
              transactionId: txRecord.id,
              bonusRunId: run.id,
              note: line.reason || note || "Премия",
            },
          });
        }
        await tx.bonusCalculationRun.update({
          where: { id: run.id },
          data: { status: "paid", paidAt: now },
        });
      });

      return NextResponse.json({ ok: true, count: run.lines.length });
    }

    if (action === "manual") {
      const hotelId = String(body.hotelId ?? "");
      const periodMonth = String(body.periodMonth ?? "").slice(0, 7);
      const staffId = String(body.staffId ?? "");
      const amount = Math.round(Number(body.amount) || 0);
      const reason = String(body.reason ?? "").trim();
      const isPenalty = Boolean(body.isPenalty);

      if (!hotelId || !staffId || !amount || !reason) {
        return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
      }

      const auth = await assertCanManageHotel(session, hotelId);
      if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

      let run = await prisma.bonusCalculationRun.findFirst({
        where: { hotelId, periodMonth, status: "draft" },
      });
      if (!run) {
        run = await prisma.bonusCalculationRun.create({
          data: { hotelId, periodMonth, status: "draft", kpiSnapshot: {} },
        });
      }

      const line = await prisma.bonusCalculationLine.create({
        data: {
          runId: run.id,
          staffId,
          amount: isPenalty ? -Math.abs(amount) : Math.abs(amount),
          reason: isPenalty ? `Штраф: ${reason}` : `Премия: ${reason}`,
          isManual: true,
          included: true,
        },
        include: { staff: { select: { id: true, name: true } } },
      });

      return NextResponse.json({ ok: true, line });
    }

    if (action === "toggle") {
      const lineId = String(body.lineId ?? "");
      const included = Boolean(body.included);
      await prisma.bonusCalculationLine.update({ where: { id: lineId }, data: { included } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (e) {
    console.error("[salaries/bonus PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}
