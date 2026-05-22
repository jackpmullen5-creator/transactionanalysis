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
        <h2 style={{ marginTop: 0 }}>Upload a PDF</h2>
        {error && <div className="error">{error}</div>}
        <label>OFAC alert PDF</label>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={!file || busy} onClick={upload}>
            {busy ? "Reading & analyzing…" : "Upload & analyze"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={loadSample}
            title="Load a built-in sample dataset for a quick demo"
          >
            Load sample data
          </button>
        </div>
        {busy && (
          <p className="muted" style={{ marginTop: 10 }}>
            Reading the document and extracting each alert — this can take a
            little while for large batches.
          </p>
        )}

        {summary && (
          <div className="success-box" style={{ marginTop: 16 }}>
            <strong>Processed {summary.total} alerts.</strong>
            <div style={{ marginTop: 6 }}>
              {summary.aiReviewed} AI reviewed · {summary.pendingApproval}{" "}
              pending approval · {summary.flagged} flagged
            </div>
            {summary.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {summary.errors.length} record(s) skipped.
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
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <p className="muted">
          Drop in a PDF of flagged transactions — a daily batch, an export, or a
          screening report. There is no required format or column layout.
        </p>
        <ul className="muted" style={{ paddingLeft: 18 }}>
          <li>
            The app reads the document and identifies every individual alert.
          </li>
          <li>
            For each one it pulls out the alert number, dates, the flagged
            transaction text, and the matched OFAC entity.
          </li>
          <li>
            Each alert is then auto-bucketed into <strong>AI Reviewed</strong>,{" "}
            <strong>Pending Approval</strong>, or{" "}
            <strong>Flagged for Human Review</strong>.
          </li>
        </ul>
        <p className="muted">
          Extraction is best-effort on messy documents — review the buckets and
          adjust any case as needed.
        </p>
      </div>
    </div>
  );
}
