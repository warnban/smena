import "server-only";

import type { HkTaskCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fileServeUrl } from "@/lib/file-url";
import { HK_CATEGORY_LABELS } from "@/lib/housekeeping";

export const LINEN_CATEGORIES: HkTaskCategory[] = ["checkout", "relocation", "scheduled"];

export type LinenStatus = "ok" | "warning" | "alert";

export type LinenDeliveryDto = {
  id: string;
  hotelId: string;
  deliveredAt: string;
  pillowcases: number;
  sheets: number;
  duvetCovers: number;
  washCost: number;
  isPaid: boolean;
  notes: string;
  invoicePath: string;
  invoiceName: string;
  invoiceSize: string;
  createdByName: string;
  ocrSnapshot: unknown;
  createdAt: string;
};

export type LinenOverview = {
  periodDays: number;
  from: string;
  to: string;
  settings: {
    pillowcasesPerChange: number;
    sheetsPerChange: number;
    duvetCoversPerChange: number;
    estimatedSets: number | null;
  };
  usage: {
    changesCount: number;
    byCategory: Record<string, number>;
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
  };
  delivered: {
    count: number;
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
    washCost: number;
  };
  variance: {
    pillowcases: number;
    sheets: number;
    duvetCovers: number;
    status: LinenStatus;
    message: string;
  };
  estimatedStockEnd: number | null;
  recentDeliveries: LinenDeliveryDto[];
  recentChanges: Array<{
    id: string;
    roomNumber: string;
    category: string;
    categoryLabel: string;
    completedAt: string;
  }>;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function mapLinenDelivery(row: {
  id: string;
  hotelId: string;
  deliveredAt: Date;
  pillowcases: number;
  sheets: number;
  duvetCovers: number;
  washCost: number;
  isPaid?: boolean;
  notes: string;
  invoicePath: string;
  invoiceName: string;
  invoiceSize: string;
  createdByName: string;
  ocrSnapshot: Prisma.JsonValue;
  createdAt: Date;
}): LinenDeliveryDto {
  return {
    id: row.id,
    hotelId: row.hotelId,
    deliveredAt: row.deliveredAt.toISOString(),
    pillowcases: row.pillowcases,
    sheets: row.sheets,
    duvetCovers: row.duvetCovers,
    washCost: row.washCost,
    isPaid: row.isPaid ?? false,
    notes: row.notes,
    invoicePath: fileServeUrl(row.invoicePath),
    invoiceName: row.invoiceName,
    invoiceSize: row.invoiceSize,
    createdByName: row.createdByName,
    ocrSnapshot: row.ocrSnapshot,
    createdAt: row.createdAt.toISOString(),
  };
}

function calcVarianceStatus(
  usage: { pillowcases: number; sheets: number; duvetCovers: number },
  delivered: { pillowcases: number; sheets: number; duvetCovers: number },
  changesCount: number,
  deliveryCount: number
): { status: LinenStatus; message: string } {
  const deficits = [
    delivered.pillowcases - usage.pillowcases,
    delivered.sheets - usage.sheets,
    delivered.duvetCovers - usage.duvetCovers,
  ];
  const minDeficit = Math.min(...deficits);

  if (changesCount > 0 && deliveryCount === 0) {
    return {
      status: "alert",
      message: `За период ${changesCount} смен белья, но нет ни одной доставки от прачечной. Проверьте, внесены ли накладные.`,
    };
  }

  if (minDeficit < -3) {
    return {
      status: "alert",
      message: `Расход белья превышает поставки более чем на ${Math.abs(minDeficit)} ед. Возможны уборки без заселения в CRM или пропущенные накладные.`,
    };
  }

  if (minDeficit < 0) {
    return {
      status: "warning",
      message: `Небольшой дефицит поставок (${minDeficit} ед. по худшему показателю). Сверьте даты доставок и отметки уборок.`,
    };
  }

  if (minDeficit > changesCount * 2 && changesCount > 0) {
    return {
      status: "warning",
      message: `Поставок заметно больше, чем смен белья (+${minDeficit} ед.). Возможно, не все уборки отмечены «Готово» в разделе уборки.`,
    };
  }

  return {
    status: "ok",
    message: "Поставки и расход белья в пределах ожидаемого диапазона.",
  };
}

export async function buildLinenOverview(
  hotelId: string,
  periodDays: number
): Promise<LinenOverview | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      linenPillowcasesPerChange: true,
      linenSheetsPerChange: true,
      linenDuvetCoversPerChange: true,
      linenEstimatedSets: true,
    },
  });
  if (!hotel) return null;

  const to = new Date();
  const from = startOfDay(new Date(to.getTime() - (periodDays - 1) * 86400000));

  const doneTasks = await prisma.hkTask.findMany({
    where: {
      hotelId,
      status: "done",
      category: { in: LINEN_CATEGORIES },
      OR: [
        { completedAt: { gte: from, lte: to } },
        { completedAt: null, updatedAt: { gte: from, lte: to } },
      ],
    },
    select: {
      id: true,
      roomNumber: true,
      category: true,
      completedAt: true,
      updatedAt: true,
    },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });

  const changesCount = await prisma.hkTask.count({
    where: {
      hotelId,
      status: "done",
      category: { in: LINEN_CATEGORIES },
      OR: [
        { completedAt: { gte: from, lte: to } },
        { completedAt: null, updatedAt: { gte: from, lte: to } },
      ],
    },
  });

  const byCategory: Record<string, number> = {};
  for (const cat of LINEN_CATEGORIES) {
    const n = await prisma.hkTask.count({
      where: {
        hotelId,
        status: "done",
        category: cat,
        OR: [
          { completedAt: { gte: from, lte: to } },
          { completedAt: null, updatedAt: { gte: from, lte: to } },
        ],
      },
    });
    if (n > 0) byCategory[cat] = n;
  }

  const deliveries = await prisma.linenDelivery.findMany({
    where: { hotelId, deliveredAt: { gte: from, lte: to } },
    orderBy: { deliveredAt: "desc" },
  });

  const deliveredTotals = deliveries.reduce(
    (acc, d) => ({
      pillowcases: acc.pillowcases + d.pillowcases,
      sheets: acc.sheets + d.sheets,
      duvetCovers: acc.duvetCovers + d.duvetCovers,
      washCost: acc.washCost + d.washCost,
    }),
    { pillowcases: 0, sheets: 0, duvetCovers: 0, washCost: 0 }
  );

  const usageTotals = {
    changesCount,
    pillowcases: changesCount * hotel.linenPillowcasesPerChange,
    sheets: changesCount * hotel.linenSheetsPerChange,
    duvetCovers: changesCount * hotel.linenDuvetCoversPerChange,
  };

  const varianceItems = {
    pillowcases: deliveredTotals.pillowcases - usageTotals.pillowcases,
    sheets: deliveredTotals.sheets - usageTotals.sheets,
    duvetCovers: deliveredTotals.duvetCovers - usageTotals.duvetCovers,
  };

  const { status, message } = calcVarianceStatus(
    usageTotals,
    deliveredTotals,
    changesCount,
    deliveries.length
  );

  let estimatedStockEnd: number | null = null;
  if (hotel.linenEstimatedSets != null) {
    const allDeliveries = await prisma.linenDelivery.aggregate({
      where: { hotelId },
      _sum: { pillowcases: true, sheets: true, duvetCovers: true },
    });
    const allChanges = await prisma.hkTask.count({
      where: { hotelId, status: "done", category: { in: LINEN_CATEGORIES } },
    });
    const deliveredSets = Math.min(
      Math.floor((allDeliveries._sum.pillowcases ?? 0) / Math.max(hotel.linenPillowcasesPerChange, 1)),
      Math.floor((allDeliveries._sum.sheets ?? 0) / Math.max(hotel.linenSheetsPerChange, 1)),
      Math.floor((allDeliveries._sum.duvetCovers ?? 0) / Math.max(hotel.linenDuvetCoversPerChange, 1))
    );
    const usedSets = allChanges;
    estimatedStockEnd = hotel.linenEstimatedSets + deliveredSets - usedSets;
  }

  return {
    periodDays,
    from: from.toISOString(),
    to: to.toISOString(),
    settings: {
      pillowcasesPerChange: hotel.linenPillowcasesPerChange,
      sheetsPerChange: hotel.linenSheetsPerChange,
      duvetCoversPerChange: hotel.linenDuvetCoversPerChange,
      estimatedSets: hotel.linenEstimatedSets,
    },
    usage: {
      changesCount,
      byCategory,
      pillowcases: usageTotals.pillowcases,
      sheets: usageTotals.sheets,
      duvetCovers: usageTotals.duvetCovers,
    },
    delivered: {
      count: deliveries.length,
      ...deliveredTotals,
    },
    variance: {
      ...varianceItems,
      status,
      message,
    },
    estimatedStockEnd,
    recentDeliveries: deliveries.slice(0, 20).map(mapLinenDelivery),
    recentChanges: doneTasks.map((t) => ({
      id: t.id,
      roomNumber: t.roomNumber,
      category: t.category,
      categoryLabel: HK_CATEGORY_LABELS[t.category as HkTaskCategory] ?? t.category,
      completedAt: (t.completedAt ?? t.updatedAt).toISOString(),
    })),
  };
}

export { formatBytes };
