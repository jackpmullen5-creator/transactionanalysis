import { NextResponse } from "next/server";
import type { Disposition, OfacEntityType } from "@/lib/types";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ALL_DISPOSITIONS, renderDisposition } from "@/lib/dispositions";
import { analyze } from "@/lib/analysis";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");

  const txn = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!txn) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  // Approve the AI-proposed disposition as-is.
  if (action === "approve") {
    if (!txn.disposition) {
      return NextResponse.json(
        { error: "This case has no proposed disposition to approve." },
        { status: 400 },
      );
    }
    const reasoning = `Approved AI-proposed disposition. ${txn.reasoning ?? ""}`.trim();
    const updated = await resolve(params.id, user.id, txn.disposition as Disposition, txn.dispositionText, reasoning, "HUMAN_APPROVE");
    return NextResponse.json({ ok: true, status: updated.status });
  }

  // Override / set a disposition explicitly (works for PENDING or FLAGGED cases).
  if (action === "override" || action === "clear") {
    const disposition = body?.disposition as Disposition | undefined;
    if (!disposition || !ALL_DISPOSITIONS.includes(disposition)) {
      return NextResponse.json({ error: "Invalid disposition." }, { status: 400 });
    }
    // Determine the words for XXXX. Prefer explicit words; else derive from engine.
    let words: string[] = Array.isArray(body?.words)
      ? body.words.map((w: unknown) => String(w)).filter(Boolean)
      : [];
    if (words.length === 0) {
      words = analyze(txn.matchedTerm, txn.ofacEntity, txn.ofacEntityType as OfacEntityType).words;
    }
    const text = renderDisposition(disposition, words);
    const note = body?.reasoning ? String(body.reasoning) : "";
    const reasoning = note
      ? `Set by ${user.name}: ${note}`
      : `Disposition set manually by ${user.name}.`;
    const updated = await resolve(params.id, user.id, disposition, text, reasoning, "HUMAN_OVERRIDE");
    return NextResponse.json({ ok: true, status: updated.status });
  }

  // Reject the AI proposal and send to the flagged-for-human-review bucket.
  if (action === "flag") {
    const note = body?.reasoning ? String(body.reasoning) : "";
    const reasoning = note
      ? `Flagged for review by ${user.name}: ${note}`
      : `Flagged for human review by ${user.name}.`;
    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        status: "FLAGGED",
        decidedById: null,
        decidedAt: null,
        logs: { create: { actorId: user.id, action: "HUMAN_FLAG", reasoning } },
      },
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

async function resolve(
  id: string,
  userId: string,
  disposition: Disposition,
  dispositionText: string | null,
  reasoning: string,
  action: string,
) {
  return prisma.transaction.update({
    where: { id },
    data: {
      status: "HUMAN_CLEARED",
      disposition,
      dispositionText,
      reasoning,
      decidedById: userId,
      decidedAt: new Date(),
      logs: {
        create: { actorId: userId, action, disposition, dispositionText, reasoning },
      },
    },
  });
}
