import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { getNetworkFaq, saveNetworkFaq } from "@/lib/assistant/faq.server";
import { apiErrorMessage } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    const auth = await assertCanManage(session);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const faq = await getNetworkFaq(auth.session.seatId);
    const staff = await prisma.staff.findFirst({
      where: { userId: auth.session.userId, seatId: auth.session.seatId },
      select: { name: true },
    });

    return NextResponse.json({
      content: faq?.content ?? "",
      updatedAt: faq?.updatedAt?.toISOString() ?? null,
      updatedBy: faq?.updatedBy ?? "",
      chunkCount: faq ? await prisma.faqChunk.count({ where: { faqId: faq.id } }) : 0,
      editorName: staff?.name ?? "",
    });
  } catch (e) {
    console.error("[faq GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    const auth = await assertCanManage(session);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const content = String(body.content ?? "");

    const staff = await prisma.staff.findFirst({
      where: { userId: auth.session.userId, seatId: auth.session.seatId },
      select: { name: true },
    });
    const updatedBy = staff?.name ?? auth.session.email ?? "unknown";

    const { faq, chunkCount } = await saveNetworkFaq(auth.session.seatId, content, updatedBy);

    return NextResponse.json({
      ok: true,
      content: faq.content,
      updatedAt: faq.updatedAt.toISOString(),
      updatedBy: faq.updatedBy,
      chunkCount,
    });
  } catch (e) {
    console.error("[faq PUT]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сохранить FAQ") }, { status: 500 });
  }
}
