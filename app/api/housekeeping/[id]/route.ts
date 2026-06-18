import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { setBedStatus, syncDormRoomStatus } from "@/lib/dorm.server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await prisma.hkTask.findUnique({
    where: { id: params.id },
    include: { hotel: true, room: true, booking: true },
  });
  if (!task || task.hotel.seatId !== session.seatId) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  const body = await req.json();
  const { status, assignee, priority } = body as {
    status?: "pending" | "in_progress" | "done";
    assignee?: string;
    priority?: "normal" | "high";
  };

  const updates: Record<string, unknown> = {};
  if (status && ["pending", "in_progress", "done"].includes(status)) {
    updates.status = status;
    if (status === "done" && task.status !== "done") {
      updates.completedAt = new Date();
    }
    if (status !== "done" && task.status === "done") {
      updates.completedAt = null;
    }
  }
  if (assignee !== undefined) updates.assignee = String(assignee).trim();
  if (priority && ["normal", "high"].includes(priority)) updates.priority = priority;

  const updated = await prisma.hkTask.update({
    where: { id: task.id },
    data: updates,
  });

  if (status === "done") {
    const guestStillThere =
      task.category === "scheduled" &&
      task.booking &&
      task.booking.status === "checkedin" &&
      task.booking.checkOut >= new Date(new Date().setHours(0, 0, 0, 0));

    if (task.bedId) {
      await setBedStatus(task.bedId, guestStillThere ? "occupied" : "available");
    } else if (task.roomId) {
      await prisma.room.update({
        where: { id: task.roomId },
        data: { status: guestStillThere ? "occupied" : "available" },
      });
    }
  }

  return NextResponse.json({ ok: true, task: updated });
}
