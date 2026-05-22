import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [aiReviewed, pending, flagged, cleared, total, datasets] =
    await Promise.all([
      prisma.transaction.count({ where: { status: "AI_REVIEWED" } }),
      prisma.transaction.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.transaction.count({ where: { status: "FLAGGED" } }),
      prisma.transaction.count({ where: { status: "HUMAN_CLEARED" } }),
      prisma.transaction.count(),
      prisma.dataset.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          uploadedBy: { select: { name: true } },
          _count: { select: { transactions: true } },
        },
      }),
    ]);

  return (
    <>
      <Nav user={user} />
      <div className="container">
        <h1>Dashboard</h1>
        <p className="subtitle">
          Daily OFAC alert triage. Each flagged transaction is bucketed into one
          of three queues.
        </p>

        <div className="grid grid-4">
          <Link href="/cases?status=AI_REVIEWED" className="stat ai">
            <div className="label">AI Reviewed</div>
            <div className="value">{aiReviewed}</div>
            <div className="muted">Auto-cleared repeats</div>
          </Link>
          <Link href="/cases?status=PENDING_APPROVAL" className="stat pending">
            <div className="label">Pending Approval</div>
            <div className="value">{pending}</div>
            <div className="muted">AI decision awaiting human</div>
          </Link>
          <Link href="/cases?status=FLAGGED" className="stat flagged">
            <div className="label">Flagged for Review</div>
            <div className="value">{flagged}</div>
            <div className="muted">AI could not decision</div>
          </Link>
          <Link href="/cases?status=HUMAN_CLEARED" className="stat total">
            <div className="label">Human Cleared</div>
            <div className="value">{cleared}</div>
            <div className="muted">Resolved by a person</div>
          </Link>
        </div>

        <h2>Recent uploads</h2>
        {datasets.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No datasets yet.{" "}
              <Link href="/upload">Upload your first OFAC alert file</Link> to
              get started.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Uploaded by</th>
                <th>Cases</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.filename}</td>
                  <td>{d.uploadedBy.name}</td>
                  <td>{d._count.transactions}</td>
                  <td className="muted">
                    {d.createdAt.toLocaleString()}
                  </td>
                  <td>
                    <Link href={`/cases?dataset=${d.id}`}>View cases</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="muted" style={{ marginTop: 24 }}>
          Total cases in system: <strong>{total}</strong>
        </p>
      </div>
    </>
  );
}
