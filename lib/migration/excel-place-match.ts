import "server-only";

import { formatDormPlaceLabel } from "@/lib/dorm";
import { aitunnelEmbed } from "@/lib/aitunnel.server";
import type { CrmPlaceSlot, PlaceMatch } from "@/lib/migration/excel-types";

function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .replace(/№/g, "")
    .replace(/койко-?место/gi, "")
    .replace(/\s*номер\s*/gi, " ном ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export function buildCrmPlaceCatalog(
  rooms: Array<{ id: string; number: string; kind: "private" | "dorm" }>,
  beds: Array<{ id: string; roomId: string; label: string }>
): CrmPlaceSlot[] {
  const out: CrmPlaceSlot[] = [];
  for (const room of rooms) {
    if (room.kind === "private") {
      const n = room.number.trim();
      out.push({
        roomId: room.id,
        bedId: null,
        kind: "private",
        label: n,
        searchKeys: [
          normalizePlace(n),
          normalizePlace(`${n} ном`),
          normalizePlace(`ном ${n}`),
          normalizePlace(`№${n}`),
        ],
      });
    } else {
      const roomBeds = beds.filter((b) => b.roomId === room.id);
      for (const bed of roomBeds) {
        const place = formatDormPlaceLabel(room.number, bed.label);
        const parts = place.split("/");
        out.push({
          roomId: room.id,
          bedId: bed.id,
          kind: "dorm",
          label: place,
          searchKeys: [
            normalizePlace(place),
            normalizePlace(`${parts[0]}/${parts[1]}`),
            normalizePlace(bed.label),
            normalizePlace(`${room.number} ${bed.label}`),
          ],
        });
      }
    }
  }
  return out;
}

function ruleMatchPlace(excelPlace: string, catalog: CrmPlaceSlot[]): CrmPlaceSlot | null {
  const norm = normalizePlace(excelPlace);
  if (!norm) return null;

  for (const slot of catalog) {
    if (slot.searchKeys.includes(norm)) return slot;
  }

  const slash = norm.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slash) {
    const [, roomPart, bedPart] = slash;
    for (const slot of catalog) {
      if (slot.kind !== "dorm" || !slot.bedId) continue;
      const slotNorm = normalizePlace(slot.label);
      if (slotNorm === `${roomPart}/${bedPart}`) return slot;
      const slotParts = slotNorm.split("/");
      if (slotParts[0] === roomPart && (slotParts[1] === bedPart || slotParts[1]?.replace(/^0+/, "") === bedPart?.replace(/^0+/, ""))) {
        return slot;
      }
    }
  }

  const roomOnly = norm.match(/^(\d+)\s*ном?$/);
  if (roomOnly) {
    const num = roomOnly[1]!;
    for (const slot of catalog) {
      if (slot.kind === "private" && normalizePlace(slot.label) === num) return slot;
    }
  }

  if (/^\d+$/.test(norm)) {
    for (const slot of catalog) {
      if (slot.kind === "dorm" && slot.bedId) {
        const parts = normalizePlace(slot.label).split("/");
        if (parts[1] === norm || parts[1]?.replace(/^0+/, "") === norm.replace(/^0+/, "")) return slot;
      }
    }
    for (const slot of catalog) {
      if (slot.kind === "private" && normalizePlace(slot.label) === norm) return slot;
    }
  }

  return null;
}

export async function matchExcelPlaces(
  hotelId: string,
  excelPlaces: string[],
  catalog: CrmPlaceSlot[],
  useEmbeddings: boolean
): Promise<PlaceMatch[]> {
  const unique = Array.from(new Set(excelPlaces.map((p) => p.trim()).filter(Boolean)));
  const results: PlaceMatch[] = [];
  const needEmbed: string[] = [];

  for (const excelPlace of unique) {
    const ruled = ruleMatchPlace(excelPlace, catalog);
    if (ruled) {
      results.push({
        excelPlace,
        hotelId,
        roomId: ruled.roomId,
        bedId: ruled.bedId,
        crmLabel: ruled.label,
        score: 1,
        method: ruled.searchKeys.includes(normalizePlace(excelPlace)) ? "exact" : "rule",
      });
    } else {
      needEmbed.push(excelPlace);
    }
  }

  if (!needEmbed.length || !useEmbeddings || !catalog.length) {
    for (const excelPlace of needEmbed) {
      results.push({
        excelPlace,
        hotelId,
        roomId: null,
        bedId: null,
        crmLabel: null,
        score: 0,
        method: "unmatched",
      });
    }
    return results;
  }

  try {
    const crmTexts = catalog.map((c) => c.label);
    const excelTexts = needEmbed.map((p) => `койко место ${p}`);
    const vectors = await aitunnelEmbed([...crmTexts, ...excelTexts]);
    const crmVecs = vectors.slice(0, catalog.length);
    const excelVecs = vectors.slice(catalog.length);

    for (let i = 0; i < needEmbed.length; i++) {
      const excelPlace = needEmbed[i]!;
      const ev = excelVecs[i]!;
      let bestIdx = -1;
      let bestScore = 0;
      for (let j = 0; j < crmVecs.length; j++) {
        const score = cosine(ev, crmVecs[j]!);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }
      const THRESHOLD = 0.78;
      if (bestIdx >= 0 && bestScore >= THRESHOLD) {
        const slot = catalog[bestIdx]!;
        results.push({
          excelPlace,
          hotelId,
          roomId: slot.roomId,
          bedId: slot.bedId,
          crmLabel: slot.label,
          score: Math.round(bestScore * 1000) / 1000,
          method: "embedding",
        });
      } else {
        results.push({
          excelPlace,
          hotelId,
          roomId: null,
          bedId: null,
          crmLabel: null,
          score: bestScore,
          method: "unmatched",
        });
      }
    }
  } catch {
    for (const excelPlace of needEmbed) {
      results.push({
        excelPlace,
        hotelId,
        roomId: null,
        bedId: null,
        crmLabel: null,
        score: 0,
        method: "unmatched",
      });
    }
  }

  return results;
}

export function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchHotelByName(
  excelName: string,
  hotels: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const target = normalizeHotelName(excelName);
  for (const h of hotels) {
    if (normalizeHotelName(h.name) === target) return h;
  }
  for (const h of hotels) {
    const n = normalizeHotelName(h.name);
    if (n.includes(target) || target.includes(n)) return h;
  }
  return null;
}
