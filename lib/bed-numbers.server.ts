import "server-only";

import type { PrismaClient } from "@prisma/client";
import { findDuplicateBedNumbers, normalizeBedNumbers } from "@/lib/bed-numbers";

export async function assertBedNumbersAvailable(
  prisma: PrismaClient,
  hotelId: string,
  rawNumbers: string[],
  opts?: { excludeRoomId?: string }
): Promise<{ ok: true; numbers: string[] } | { ok: false; error: string }> {
  const numbers = normalizeBedNumbers(rawNumbers);
  if (!numbers.length) {
    return { ok: false, error: "Укажите хотя бы один номер койки" };
  }

  const dup = findDuplicateBedNumbers(numbers);
  if (dup) {
    return { ok: false, error: `Номер «${dup}» указан дважды` };
  }

  const [existingBeds, existingRooms] = await Promise.all([
    prisma.bed.findMany({
      where: {
        hotelId,
        ...(opts?.excludeRoomId ? { NOT: { roomId: opts.excludeRoomId } } : {}),
      },
      select: { label: true },
    }),
    prisma.room.findMany({
      where: { hotelId, kind: "private" },
      select: { number: true },
    }),
  ]);

  const takenBed = new Set(existingBeds.map((b) => b.label.toLowerCase()));
  const takenRoom = new Set(existingRooms.map((r) => r.number.toLowerCase()));

  for (const n of numbers) {
    const key = n.toLowerCase();
    if (takenBed.has(key)) {
      return { ok: false, error: `Номер «${n}» уже занят другой койкой` };
    }
    if (takenRoom.has(key)) {
      return { ok: false, error: `Номер «${n}» уже используется как номер` };
    }
  }

  return { ok: true, numbers };
}
