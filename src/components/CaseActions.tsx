"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseStatus, Disposition } from "@/lib/types";
import { ALL_DISPOSITIONS, DISPOSITION_LABELS } from "@/lib/dispositions";

export default function CaseActions({
  id,
  status,
  currentDisposition,
  suggestedWords,
  suggestedDisposition,
}: {
  id: string;
  status: CaseStatus;
  currentDisposition: Disposition | null;
  suggestedWords: string[];
  suggestedDisposition: Disposition | null;
}) {
  const router = useRouter();
  const [disposition, setDisposition] = useState<Disposition>(
    currentDisposition ?? suggestedDisposition ?? "FP_SINGLE_WORD",
  );
  const [words, setWords] = useState(suggestedWords.join(", "));
  const [reasoning, setReasoning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/cases/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reasoning, ...extra }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed.");
    }
  }

  const wordList = words
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  const resolved = status === "AI_REVIEWED" || status === "HUMAN_CLEARED";

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Actions</h2>
      {error && <div className="error">{error}</div>}

      {status === "PENDING_APPROVAL" && (
        <>
          <p className="muted">
            The AI proposed a disposition. Approve it, change it, or flag for
            review.
          </p>
          <button
            className="btn success"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={busy}
            onClick={() => send("approve")}
          >
            Approve AI decision
          </button>
          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
        </>
      )}

      {resolved && (
        <p className="muted">
          This case is resolved. You may re-decision it below if needed.
        </p>
      )}

      <label>Disposition</label>
      <select
        value={disposition}
        onChange={(e) => setDisposition(e.target.value as Disposition)}
      >
        {ALL_DISPOSITIONS.map((d) => (
          <option key={d} value={d}>
            {DISPOSITION_LABELS[d]}
          </option>
        ))}
      </select>

      {(disposition === "FP_SINGLE_WORD" ||
        disposition === "FP_SINGLE_WORD_VESSEL" ||
        disposition === "FP_TWO_WORDS") && (
        <>
          <label>
            Matched word(s) — fills XXXX
            {disposition === "FP_TWO_WORDS" ? " (comma-separated, 2)" : ""}
          </label>
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="e.g. SMITH"
          />
        </>
      )}

      <label>Reasoning / note (optional)</label>
      <textarea
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
        placeholder="Add context for the audit trail…"
      />

      <button
        className="btn"
        style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
        disabled={busy}
        onClick={() => send("override", { disposition, words: wordList })}
      >
        {status === "FLAGGED"
          ? "Clear with this disposition"
          : "Save disposition"}
      </button>

      {status !== "FLAGGED" && (
        <button
          className="btn secondary"
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          disabled={busy}
          onClick={() => send("flag")}
        >
          Flag for human review
        </button>
      )}
    </div>
  );
}
