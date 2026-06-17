import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertStorageFileAccess } from "@/lib/file-access.server";
import { readStoredFile } from "@/lib/object-storage.server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storageKey = params.path.join("/");
  const access = await assertStorageFileAccess(session.seatId, storageKey);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const file = await readStoredFile(storageKey);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
