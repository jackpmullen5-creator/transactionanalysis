import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { parseCsv } from "@/lib/csv";
import { ingestRows, parseRow, type ParsedRow, type RowError } from "@/lib/ingest";
import { sampleCsv } from "@/lib/sample";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let csvText: string;
  let filename: string;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body?.sample) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    csvText = sampleCsv();
    filename = `sample-dataset-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    csvText = await file.text();
    filename = file.name || "upload.csv";
  }

  const records = parseCsv(csvText);
  if (records.length === 0) {
    return NextResponse.json(
      { error: "The file contained no data rows." },
      { status: 400 },
    );
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  records.forEach((record, idx) => {
    const { row, error } = parseRow(record, idx + 2); // +2: header is line 1
    if (row) rows.push(row);
    if (error) errors.push(error);
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows found.", errors },
      { status: 400 },
    );
  }

  const summary = await ingestRows(filename, user.id, rows);
  summary.errors = errors;
  return NextResponse.json(summary);
}
