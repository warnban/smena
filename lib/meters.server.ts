import "server-only";

import type { UtilityMeterType } from "@/lib/meters";
import { METER_TYPE_CONFIG, periodKey } from "@/lib/meters";
import { fileServeUrl } from "@/lib/file-url";
import { prisma } from "@/lib/prisma";

export type MeterAttachmentDto = {
  id: string;
  fileName: string;
  fileSize: string;
  filePath: string;
  mimeType: string;
};

export type MeterCellDto = {
  id: string;
  value: number;
  delta: number | null;
  transmitted: boolean;
  notes: string;
  attachmentCount: number;
  attachments: MeterAttachmentDto[];
};

export type MeterRowDto = {
  id: string;
  zoneName: string;
  meterType: UtilityMeterType;
  unit: string;
  sortOrder: number;
};

export type MetersBoardDto = {
  meters: MeterRowDto[];
  periods: string[];
  cells: Record<string, Record<string, MeterCellDto | null>>;
};

function mapAttachment(row: {
  id: string;
  fileName: string;
  fileSize: string;
  filePath: string;
  mimeType: string;
}): MeterAttachmentDto {
  return {
    id: row.id,
    fileName: row.fileName,
    fileSize: row.fileSize,
    filePath: fileServeUrl(row.filePath),
    mimeType: row.mimeType,
  };
}

export async function buildMetersBoard(hotelId: string): Promise<MetersBoardDto> {
  const meters = await prisma.utilityMeter.findMany({
    where: { hotelId, active: true },
    orderBy: [{ sortOrder: "asc" }, { zoneName: "asc" }],
  });

  const readings = await prisma.utilityReading.findMany({
    where: { hotelId },
    include: { attachments: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ readingDate: "asc" }],
  });

  const periodSet = new Set<string>();
  for (const r of readings) {
    periodSet.add(periodKey(r.readingDate));
  }

  const periods = Array.from(periodSet).sort();

  const byMeter = new Map<string, typeof readings>();
  for (const r of readings) {
    const list = byMeter.get(r.meterId) ?? [];
    list.push(r);
    byMeter.set(r.meterId, list);
  }

  const cells: MetersBoardDto["cells"] = {};

  for (const meter of meters) {
    cells[meter.id] = {};
    const list = byMeter.get(meter.id) ?? [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const key = periodKey(r.readingDate);
      const prev = i > 0 ? list[i - 1] : null;
      const delta = prev ? r.value - prev.value : null;
      cells[meter.id][key] = {
        id: r.id,
        value: r.value,
        delta,
        transmitted: r.transmitted,
        notes: r.notes,
        attachmentCount: r.attachments.length,
        attachments: r.attachments.map(mapAttachment),
      };
    }
  }

  return {
    meters: meters.map((m: (typeof meters)[number]) => ({
      id: m.id,
      zoneName: m.zoneName,
      meterType: m.meterType as UtilityMeterType,
      unit: METER_TYPE_CONFIG[m.meterType as UtilityMeterType].unit,
      sortOrder: m.sortOrder,
    })),
    periods,
    cells,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
