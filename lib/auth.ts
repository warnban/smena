import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { getJwtSecret } from "@/lib/jwt-secret";

export interface SessionPayload {
  userId: string;
  seatId: string;
  email: string;
  role: UserRole;
  staffId?: string;
}

export function generateToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get("auth-token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isBlocked: true },
  });
  if (!user || user.isBlocked) return null;

  return payload;
}

export async function setAuthCookie(token: string) {
  cookies().set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthCookie() {
  cookies().set("auth-token", "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Отели, доступные пользователю в рамках Seat */
export async function getAccessibleHotelIds(session: SessionPayload): Promise<string[] | "all"> {
  const { prisma } = await import("@/lib/prisma");

  if (session.role === "owner") {
    const hotels = await prisma.hotel.findMany({
      where: { seatId: session.seatId },
      select: { id: true },
    });
    return hotels.length > 1 ? "all" : hotels.map((h) => h.id);
  }

  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    include: { hotels: true },
  });
  if (!staff) return [];
  const ids = staff.hotels.map((h) => h.hotelId);
  return ids.length > 1 ? "all" : ids;
}
