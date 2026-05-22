import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseCsv } from "@/lib/csv";
import { ingestRows, parseRow, type ParsedRow, type RowError } from "@/lib/ingest";
import { sampleCsv } from "@/lib/sample";
import { extractAlertsFromPdf, MissingApiKeyError, type ExtractedAlert } from "@/lib/extract";

// PDF analysis can take a while for large daily batches.
export const runtime = "nodejs";
export const maxDuration = 300;

function alertToRecord(a: ExtractedAlert): Record<string, string> {
  return {
    "alert number": a.alertNumber ?? "",
    "date created": a.dateCreated ?? "",
    "due date": a.dueDate ?? "",
    watchlist: a.watchlist ?? "",
    "subject type": a.subjectType ?? "",
    "matched term": a.matchedTerm ?? "",
    "ofac entity": a.ofacEntity ?? "",
    "ofac entity type": a.ofacEntityType ?? "",
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let filename: string;
  let records: Record<string, string>[];

  try {
    if (contentType.includes("application/json")) {
      // Built-in sample dataset (demo helper).
      const body = await req.json().catch(() => null);
      if (!body?.sample) {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
      }
      records = parseCsv(sampleCsv());
      filename = `sample-dataset-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
      }
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        return NextResponse.json(
          { error: "Please upload a PDF file." },
          { status: 400 },
        );
      }
      filename = file.name || "upload.pdf";
      const buffer = Buffer.from(await file.arrayBuffer());
      const alerts = await extractAlertsFromPdf(buffer);
      records = alerts.map(alertToRecord);
    }
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to read the document.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (records.length === 0) {
    return NextResponse.json(
      { error: "No alerts were found in the document." },
      { status: 400 },
    );
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  records.forEach((record, idx) => {
    const { row, error } = parseRow(record, idx + 1);
    if (row) rows.push(row);
    if (error) errors.push(error);
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid alerts could be read from the document.", errors },
      { status: 400 },
    );
  }

  const summary = await ingestRows(filename, user.id, rows);
  summary.errors = errors;
  return NextResponse.json(summary);
}
