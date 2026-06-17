import "server-only";

import path from "path";
import { prisma } from "@/lib/prisma";
import {
  buildUploadPath,
  guessContentType,
  putStoredFile,
  storageKeyFromFilePath,
} from "@/lib/object-storage.server";

export const GUEST_DOC_MAX_BYTES = 10 * 1024 * 1024;

export function formatGuestDocSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export async function storeGuestDocument(
  guestId: string,
  file: { name: string; buffer: Buffer; size: number },
  docType: string
) {
  const ext = path.extname(file.name) || ".jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filePath = buildUploadPath(["uploads", "guests", guestId], safeName);

  await putStoredFile(storageKeyFromFilePath(filePath), file.buffer, guessContentType(safeName));

  return prisma.guestDocument.create({
    data: {
      guestId,
      type: docType,
      name: file.name,
      size: formatGuestDocSize(file.size),
      pages: 1,
      filePath,
    },
  });
}
