import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import type { CaseStatus } from "@/lib/types";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import Nav from "@/components/Nav";
import CasesTable from "@/components/CasesTable";
import { STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "AI_REVIEWED", label: "AI Reviewed" },
  { key: "PENDING_APPROVAL", label: "Pending Approval" },
  { key: "FLAGGED", label: "Flagged" },
  { key: "HUMAN_CLEARED", label: "Human Cleared" },
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: { status?: string; dataset?: string; q?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const status = searchParams.status as CaseStatus | undefined;
  const dataset = searchParams.dataset;
  const q = (searchParams.q ?? "").trim();

  const where: Prisma.TransactionWhereInput = {};
  if (status && STATUS_LABELS[status]) where.status = status;
  if (dataset) where.datasetId = dataset;
  if (q) {
    where.OR = [
      { alertNumber: { contains: q, mode: "insensitive" } },
      { matchedTerm: { contains: q, mode: "insensitive" } },
      { ofacEntity: { contains: q, mode: "insensitive" } },
    ];
  }

  const cases = await prisma.transaction.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 500,
    include: { decidedBy: { select: { name: true } } },
  });

  const rows = cases.map((c) => ({
    id: c.id,
    alertNumber: c.alertNumber,
    status: c.status as CaseStatus,
    matchedTerm: c.matchedTerm,
    ofacEntity: c.ofacEntity,
    dispositionText: c.dispositionText,
    dueDate: c.dueDate.toISOString(),
    decidedBy: c.decidedBy?.name ?? null,
  }));

  const buildHref = (statusKey: string) => {
    const params = new URLSearchParams();
    if (statusKey) params.set("status", statusKey);
    if (dataset) params.set("dataset", dataset);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/cases?${s}` : "/cases";
  };

  return (
    <>
      <Nav user={user} />
      <div className="container">
        <h1>Cases</h1>
        <p className="subtitle">
          {cases.length} case{cases.length === 1 ? "" : "s"}
          {status ? ` · ${STATUS_LABELS[status]}` : ""}
          {dataset ? " · filtered by dataset" : ""}
        </p>

        <div className="toolbar">
          {STATUS_TABS.map((t) => {
            const active = (status ?? "") === t.key;
            return (
              <Link
                key={t.key}
                href={buildHref(t.key)}
                className={`btn small ${active ? "" : "secondary"}`}
              >
                {t.label}
              </Link>
            );
          })}
          <span className="spacer" />
          <form method="get" className="row" style={{ gap: 6 }}>
            {status && <input type="hidden" name="status" value={status} />}
            {dataset && <input type="hidden" name="dataset" value={dataset} />}
            <input
              name="q"
              placeholder="Search alert / term / entity"
              defaultValue={q}
              style={{ width: 240 }}
            />
            <button className="btn secondary small" type="submit">
              Search
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              No cases match. <Link href="/upload">Upload a dataset</Link> or
              clear filters.
            </p>
          </div>
        ) : (
          <CasesTable rows={rows} />
        )}
      </div>
    </>
  );
}
