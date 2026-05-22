"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CaseStatus } from "@/lib/types";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/labels";

export interface CaseRow {
  id: string;
  alertNumber: string;
  status: CaseStatus;
  matchedTerm: string;
  ofacEntity: string;
  dispositionText: string | null;
  dueDate: string;
  decidedBy: string | null;
}

export default function CasesTable({ rows }: { rows: CaseRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  }

  async function massClose() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Mass close ${selected.size} case(s) as "No suspicious activity detected"?`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/cases/bulk-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setBusy(false);
    if (res.ok) {
      setSelected(new Set());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to mass close.");
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="toolbar">
          <strong>{selected.size} selected</strong>
          <button
            className="btn danger small"
            onClick={massClose}
            disabled={busy}
          >
            Mass close (disposition #5)
          </button>
          <button
            className="btn secondary small"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input
                type="checkbox"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th>Alert #</th>
            <th>Status</th>
            <th>Flagged term</th>
            <th>OFAC entity</th>
            <th>Disposition</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`Select ${r.alertNumber}`}
                />
              </td>
              <td className="mono">
                <Link href={`/cases/${r.id}`}>{r.alertNumber}</Link>
              </td>
              <td>
                <span className={`badge ${STATUS_BADGE_CLASS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </td>
              <td>{r.matchedTerm}</td>
              <td>{r.ofacEntity}</td>
              <td className="muted">{r.dispositionText ?? "—"}</td>
              <td className="muted">
                {new Date(r.dueDate).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
