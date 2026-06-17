import { NextResponse } from "next/server";

/** Устарело — используйте POST /api/staff/invites */
export async function POST() {
  return NextResponse.json(
    { error: "Создайте приглашение: Настройки → Сотрудники → Пригласить" },
    { status: 410 }
  );
}
