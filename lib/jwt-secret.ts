let cached: Uint8Array | null = null;

/** JWT secret bytes; in production JWT_SECRET must be set. */
export function getJwtSecret(): Uint8Array {
  if (cached) return cached;

  const secret = process.env.JWT_SECRET;
  if (secret) {
    cached = new TextEncoder().encode(secret);
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }

  cached = new TextEncoder().encode("smena-crm-dev-secret-change-in-production");
  return cached;
}
