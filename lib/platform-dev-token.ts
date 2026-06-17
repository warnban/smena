import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";

export const PLATFORM_DEV_COOKIE = "platform-dev-token";

export type PlatformDevSession = {
  kind: "platform_dev";
  email: string;
};

export async function verifyPlatformDevToken(token: string): Promise<PlatformDevSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.kind !== "platform_dev" || typeof payload.email !== "string") return null;
    return { kind: "platform_dev", email: payload.email };
  } catch {
    return null;
  }
}
