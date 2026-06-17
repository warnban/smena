import "server-only";

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

export function isObjectStorageEnabled(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim()
  );
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.S3_REGION?.trim() || "ru-central1",
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  }
  return s3Client;
}

export function storageKeyFromFilePath(filePath: string): string {
  return filePath.replace(/^\/+/, "");
}

export function filePathFromStorageKey(key: string): string {
  return `/${key.replace(/^\/+/, "")}`;
}

export function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? "application/octet-stream";
}

function localAbsPath(storageKey: string): string {
  return path.join(process.cwd(), "public", storageKey.replace(/^\/+/, ""));
}

export async function putStoredFile(
  storageKey: string,
  buffer: Buffer,
  contentType?: string
): Promise<void> {
  const key = storageKey.replace(/^\/+/, "");
  const type = contentType ?? guessContentType(key);

  if (isObjectStorageEnabled()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!.trim(),
        Key: key,
        Body: buffer,
        ContentType: type,
      })
    );
    return;
  }

  const abs = localAbsPath(key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
}

export async function readStoredFile(
  storageKey: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const key = storageKey.replace(/^\/+/, "");

  if (isObjectStorageEnabled()) {
    try {
      const res = await getS3Client().send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!.trim(),
          Key: key,
        })
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return {
        buffer: Buffer.from(bytes),
        contentType: res.ContentType ?? guessContentType(key),
      };
    } catch {
      return null;
    }
  }

  try {
    const buffer = await readFile(localAbsPath(key));
    return { buffer, contentType: guessContentType(key) };
  } catch {
    return null;
  }
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  const key = storageKeyFromFilePath(filePath);

  if (isObjectStorageEnabled()) {
    try {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!.trim(),
          Key: key,
        })
      );
    } catch {
      /* уже удалён */
    }
    return;
  }

  if (!filePath.startsWith("/uploads/")) return;

  try {
    await unlink(localAbsPath(key));
  } catch {
    /* уже удалён */
  }
}

export function buildUploadPath(parts: string[], filename: string): string {
  const segments = parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return filePathFromStorageKey([...segments, filename].join("/"));
}
