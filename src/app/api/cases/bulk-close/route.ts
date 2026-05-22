import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { renderDisposition } from "@/lib/dispositions";

// Mass close: disposition #5 — "Mass close after review completion. No
// suspicious activity detected." Applied to many cases at once after review.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.map((i: unknown) => String(i))
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No cases selected." }, { status: 400 });
  }

  const text = renderDisposition("MASS_CLOSE");
  const reasoning = `Mass closed by ${user.name} after review completion.`;
  const now = new Date();

  await prisma.$transaction(
    ids.map((id) =>
      prisma.transaction.update({
        where: { id },
        data: {
          status: "HUMAN_CLEARED",
          disposition: "MASS_CLOSE",
          dispositionText: text,
          reasoning,
          decidedById: user.id,
          decidedAt: now,
          logs: {
            create: {
              actorId: user.id,
              action: "MASS_CLOSE",
              disposition: "MASS_CLOSE",
              dispositionText: text,
              reasoning,
            },
          },
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, count: ids.length });
}
