/** URL для просмотра/скачивания файла через защищённый API (локально и S3). */
export function fileServeUrl(filePath: string | null | undefined): string {
  if (!filePath?.trim()) return "";
  const key = filePath.replace(/^\/+/, "");
  if (!key.startsWith("uploads/")) return filePath;
  return `/api/files/${key}`;
}
