import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { performCheckIn } from "@/lib/checkin.server";
import { apiErrorMessage } from "@/lib/api-error";
import type { GuestFormData } from "@/lib/guest-form";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = await performCheckIn(session, params.id, {
      form: body.form as GuestFormData,
      regCardSigned: Boolean(body.regCardSigned),
      migRegSubmitted: body.migRegSubmitted,
      migRegNotifNumber: body.migRegNotifNumber,
      paymentMethod: body.paymentMethod,
      paymentAmount: body.paymentAmount,
      paymentNights: body.paymentNights,
      paidThroughDate: body.paidThroughDate,
      note: body.note,
      discountPercent: body.discountPercent,
      discountPerNight: body.discountPerNight,
      discountRuleId: body.discountRuleId,
      skipPayment: body.skipPayment,
      channelId: body.channelId,
      date: body.date,
      operationDate: body.operationDate,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, amount: result.amount, paid: result.paid });
  } catch (e) {
    console.error("[checkin]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось заселить гостя") }, { status: 500 });
  }
}
