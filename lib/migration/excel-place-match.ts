import "server-only";

import { formatDormPlaceLabel } from "@/lib/dorm";
import { aitunnelEmbed } from "@/lib/aitunnel.server";
import type { CrmPlaceSlot, PlaceMatch } from "@/lib/migration/excel-types";

/** Разбить «16 VIP, 20 VIP» или «3/20, 3/20» на отдельные места. */
export function expandExcelPlaceTokens(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isVirtualExcelPlace(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "—" || t === "-" || t === "–" || t.includes("виртуал");
}

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

function normalizeRoomNum(s: string): string {
  const n = s.trim().replace(/^0+/, "");
  return n || "0";
}

function normalizeBedToken(s: string): string {
  const t = s.trim().toLowerCase();
  if (t.includes("диван") || t === "divan") return "диван";
  const m = t.match(/^0*(\d+)([a-zа-я]?)$/i);
  if (m) return `${m[1]}${(m[2] ?? "").toLowerCase()}`;
  return t.replace(/\s+/g, "");
}

function roomNumbersEqual(a: string, b: string): boolean {
  return normalizeRoomNum(a) === normalizeRoomNum(b);
}

function bedTokensEqual(a: string, b: string): boolean {
  return normalizeBedToken(a) === normalizeBedToken(b);
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
    const roomNum = room.number.trim();
    if (room.kind === "private") {
      const keys = new Set<string>([
        normalizePlace(roomNum),
        normalizePlace(`${roomNum} ном`),
        normalizePlace(`ном ${roomNum}`),
        normalizePlace(`${roomNum} vip`),
        normalizePlace(`${roomNum} vip ном`),
      ]);
      out.push({
        roomId: room.id,
        bedId: null,
        kind: "private",
        label: roomNum,
        searchKeys: Array.from(keys),
      });
    } else {
      const roomBeds = beds.filter((b) => b.roomId === room.id);
      for (const bed of roomBeds) {
        const place = formatDormPlaceLabel(roomNum, bed.label);
        const parts = place.split("/");
        const bedLabel = bed.label.trim();
        const keys = new Set<string>([
          normalizePlace(place),
          normalizePlace(`${parts[0]}/${parts[1]}`),
          normalizePlace(bedLabel),
          normalizePlace(`${roomNum} ${bedLabel}`),
          normalizePlace(`${normalizeRoomNum(roomNum)}/${normalizeBedToken(bedLabel)}`),
        ]);
        if (bedLabel.toLowerCase().includes("диван")) {
          keys.add(normalizePlace(`${normalizeRoomNum(roomNum)}/диван`));
        }
        out.push({
          roomId: room.id,
          bedId: bed.id,
          kind: "dorm",
          label: place,
          searchKeys: Array.from(keys),
        });
      }
    }
  }
  return out;
}

function matchDormSlash(
  roomPart: string,
  bedPart: string,
  catalog: CrmPlaceSlot[]
): CrmPlaceSlot | null {
  for (const slot of catalog) {
    if (slot.kind !== "dorm" || !slot.bedId) continue;
    const slotNorm = normalizePlace(slot.label);
    const slotParts = slotNorm.split("/");
    if (slotParts.length < 2) continue;
    if (!roomNumbersEqual(slotParts[0]!, roomPart)) continue;
    if (bedTokensEqual(slotParts[1]!, bedPart)) return slot;
  }
  return null;
}

function ruleMatchPlace(excelPlace: string, catalog: CrmPlaceSlot[]): CrmPlaceSlot | null {
  const raw = excelPlace.trim();
  if (!raw || isVirtualExcelPlace(raw)) return null;

  const norm = normalizePlace(raw);
  if (!norm) return null;

  for (const slot of catalog) {
    if (slot.searchKeys.includes(norm)) return slot;
  }

  const vip = norm.match(/^(\d+)\s*vip$/);
  if (vip) {
    const num = normalizeRoomNum(vip[1]!);
    for (const slot of catalog) {
      if (slot.kind === "private" && normalizeRoomNum(slot.label) === num) return slot;
    }
  }

  const slash = norm.match(/^(\d+)\s*\/\s*(.+)$/);
  if (slash) {
    const matched = matchDormSlash(slash[1]!, slash[2]!, catalog);
    if (matched) return matched;
  }

  const roomOnly = norm.match(/^(\d+)\s*ном?$/);
  if (roomOnly) {
    const num = normalizeRoomNum(roomOnly[1]!);
    for (const slot of catalog) {
      if (slot.kind === "private" && normalizeRoomNum(slot.label) === num) return slot;
    }
  }

  if (/^\d+$/.test(norm)) {
    const num = normalizeRoomNum(norm);
    for (const slot of catalog) {
      if (slot.kind === "private" && normalizeRoomNum(slot.label) === num) return slot;
    }
    for (const slot of catalog) {
      if (slot.kind === "dorm" && slot.bedId) {
        const parts = normalizePlace(slot.label).split("/");
        if (parts[1] && bedTokensEqual(parts[1], num)) return slot;
      }
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
  const tokenSet = new Set<string>();
  for (const p of excelPlaces) {
    for (const token of expandExcelPlaceTokens(p)) tokenSet.add(token);
  }
  const unique = Array.from(tokenSet);
  const results: PlaceMatch[] = [];
  const needEmbed: string[] = [];

  for (const excelPlace of unique) {
    if (isVirtualExcelPlace(excelPlace)) {
      results.push({
        excelPlace,
        hotelId,
        roomId: null,
        bedId: null,
        crmLabel: null,
        score: 0,
        method: "rule",
      });
      continue;
    }

    const ruled = ruleMatchPlace(excelPlace, catalog);
    if (ruled) {
      const norm = normalizePlace(excelPlace);
      results.push({
        excelPlace,
        hotelId,
        roomId: ruled.roomId,
        bedId: ruled.bedId,
        crmLabel: ruled.label,
        score: 1,
        method: ruled.searchKeys.includes(norm) ? "exact" : "rule",
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
    const crmTexts = catalog.map((c) =>
      c.kind === "private" ? `отдельный номер ${c.label} VIP` : `койко место ${c.label}`
    );
    const excelTexts = needEmbed.map((p) => {
      if (/vip/i.test(p)) return `отдельный номер ${p}`;
      return `койко место ${p}`;
    });
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
      const THRESHOLD = 0.72;
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

export function resolvePlaceMatch(
  rawPlace: string,
  hotelId: string,
  placeByKey: Map<string, PlaceMatch>
): PlaceMatch | null {
  const tokens = expandExcelPlaceTokens(rawPlace);
  for (const token of tokens) {
    if (isVirtualExcelPlace(token)) continue;
    const m = placeByKey.get(`${hotelId}|${token}`);
    if (m?.roomId) return m;
  }
  for (const token of tokens) {
    const m = placeByKey.get(`${hotelId}|${token}`);
    if (m) return m;
  }
  return null;
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
