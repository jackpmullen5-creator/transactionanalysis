import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { analyze } from "@/lib/analysis";
import type { CaseStatus, Disposition, OfacEntityType } from "@/lib/types";
import Nav from "@/components/Nav";
import CaseActions from "@/components/CaseActions";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CaseDetail({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const txn = await prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      decidedBy: { select: { name: true, email: true } },
      dataset: { select: { filename: true } },
      logs: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });

  if (!txn) notFound();

  const status = txn.status as CaseStatus;
  const suggested = analyze(
    txn.matchedTerm,
    txn.ofacEntity,
    txn.ofacEntityType as OfacEntityType,
  );

  return (
    <>
      <Nav user={user} />
      <div className="container">
        <p style={{ marginTop: 0 }}>
          <Link href="/cases">← Back to cases</Link>
        </p>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 className="mono" style={{ marginBottom: 0 }}>
            Alert {txn.alertNumber}
          </h1>
          <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        <p className="subtitle">From {txn.dataset.filename}</p>

        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Case details</h2>
            <dl className="kv">
              <dt>Alert Number</dt>
              <dd className="mono">{txn.alertNumber}</dd>
              <dt>Date Created</dt>
              <dd>{txn.dateCreated.toLocaleDateString()}</dd>
              <dt>Due Date</dt>
              <dd>{txn.dueDate.toLocaleDateString()}</dd>
              <dt>Watchlist</dt>
              <dd>{txn.watchlist}</dd>
              <dt>Subject Type</dt>
              <dd>{txn.subjectType}</dd>
            </dl>

            <h2>Match info</h2>
            <dl className="kv">
              <dt>Flagged transaction text</dt>
              <dd>
                <strong>{txn.matchedTerm}</strong>
              </dd>
              <dt>Matched OFAC entity</dt>
              <dd>
                <strong>{txn.ofacEntity}</strong>
              </dd>
              <dt>Entity type</dt>
              <dd>{txn.ofacEntityType}</dd>
            </dl>

            <h2>Disposition</h2>
            {txn.dispositionText ? (
              <p className="disposition-text">{txn.dispositionText}</p>
            ) : (
              <p className="muted">No disposition set yet.</p>
            )}
            {txn.reasoning && (
              <p className="muted" style={{ marginTop: 10 }}>
                <strong>Reasoning:</strong> {txn.reasoning}
              </p>
            )}
            {txn.decidedBy && (
              <p className="muted">
                <strong>Resolved by:</strong> {txn.decidedBy.name} (
                {txn.decidedBy.email})
                {txn.decidedAt
                  ? ` on ${txn.decidedAt.toLocaleString()}`
                  : ""}
              </p>
            )}
          </div>

          <div>
            <CaseActions
              id={txn.id}
              status={status}
              currentDisposition={txn.disposition as Disposition | null}
              suggestedWords={suggested.words}
              suggestedDisposition={suggested.disposition}
            />
          </div>
        </div>

        <h2>Audit trail</h2>
        <div className="card">
          <ul className="timeline">
            {txn.logs.map((log) => (
              <li key={log.id}>
                <strong>{formatAction(log.action)}</strong>{" "}
                <span className="muted">
                  {log.actor ? `by ${log.actor.name}` : "by AI engine"} ·{" "}
                  {log.createdAt.toLocaleString()}
                </span>
                {log.dispositionText && (
                  <div className="disposition-text" style={{ marginTop: 6 }}>
                    {log.dispositionText}
                  </div>
                )}
                {log.reasoning && (
                  <div className="muted" style={{ marginTop: 4 }}>
                    {log.reasoning}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    AI_AUTO_CLEAR: "AI auto-cleared (repeat case)",
    AI_PROPOSE: "AI proposed disposition",
    AI_FLAG: "AI flagged for human review",
    HUMAN_APPROVE: "Human approved AI decision",
    HUMAN_OVERRIDE: "Human set disposition",
    HUMAN_FLAG: "Human flagged for review",
    MASS_CLOSE: "Mass close",
  };
  return map[action] ?? action;
}
