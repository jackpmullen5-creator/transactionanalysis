"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Summary {
  datasetId: string;
  total: number;
  aiReviewed: number;
  pendingApproval: number;
  flagged: number;
  errors: { line: number; message: string }[];
}

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    setSummary(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/datasets", { method: "POST", body: form });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSummary(data);
      router.refresh();
    } else {
      setError(data.error ?? "Upload failed.");
    }
  }

  async function loadSample() {
    setBusy(true);
    setError("");
    setSummary(null);
    const res = await fetch("/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample: true }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSummary(data);
      router.refresh();
    } else {
      setError(data.error ?? "Failed to load sample.");
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Upload a CSV</h2>
        {error && <div className="error">{error}</div>}
        <label>CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={!file || busy} onClick={upload}>
            {busy ? "Processing…" : "Upload & analyze"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={loadSample}
            title="Generate and ingest a built-in sample dataset"
          >
            Load sample data
          </button>
        </div>

        {summary && (
          <div className="success-box" style={{ marginTop: 16 }}>
            <strong>Processed {summary.total} cases.</strong>
            <div style={{ marginTop: 6 }}>
              {summary.aiReviewed} AI reviewed · {summary.pendingApproval}{" "}
              pending approval · {summary.flagged} flagged
            </div>
            {summary.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {summary.errors.length} row(s) skipped (e.g. line{" "}
                {summary.errors[0].line}: {summary.errors[0].message})
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Link href={`/cases?dataset=${summary.datasetId}`}>
                View these cases →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Expected format</h2>
        <p className="muted">
          A header row plus one row per alert. Columns (case-insensitive):
        </p>
        <ul className="muted" style={{ paddingLeft: 18 }}>
          <li>
            <strong>Alert Number</strong> — 5-digit alert id
          </li>
          <li>
            <strong>Date Created</strong> — e.g. 2026-05-01 (due date defaults to
            +1 month)
          </li>
          <li>
            <strong>Matched Term</strong> — the flagged part of the transaction
          </li>
          <li>
            <strong>OFAC Entity</strong> — the matched watchlist entity
          </li>
          <li>
            <strong>OFAC Entity Type</strong> — optional (VESSEL / INDIVIDUAL /
            ENTITY) — drives the vessel disposition
          </li>
        </ul>
        <p className="muted">
          Watchlist defaults to OFAC and Subject Type to Transaction if omitted.
        </p>
        <a className="btn secondary small" href="/api/datasets/sample">
          Download CSV template
        </a>
      </div>
    </div>
  );
}
