import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertHotelWrite } from "@/lib/permissions";
import { getPaymentLockStatus } from "@/lib/payment-lock";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hotelId = req.nextUrl.searchParams.get("hotelId");
  if (!hotelId) {
    return NextResponse.json({ error: "hotelId обязателен" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const lock = await getPaymentLockStatus(hotelId);
  return NextResponse.json(lock);
}
