import { mskNightDiff } from "@/lib/msk-time";

export function calcStayAmount(params: {
  roomPrice: number;
  checkIn: Date;
  checkOut: Date;
  discountPercent?: number;
  discountPerNight?: number;
}): number {
  const nights = mskNightDiff(params.checkIn, params.checkOut);
  const base = params.roomPrice * nights;
  let total = base;

  if (params.discountPercent && params.discountPercent > 0) {
    total = Math.round(base * (1 - params.discountPercent / 100));
  }
  if (params.discountPerNight && params.discountPerNight > 0) {
    total = Math.max(0, total - params.discountPerNight * nights);
  }

  return total;
}
