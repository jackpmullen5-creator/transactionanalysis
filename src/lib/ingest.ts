import type { Prisma } from "@prisma/client";
import type { Disposition, OfacEntityType } from "./types";
import { prisma } from "./db";
import { analyze, matchKey } from "./analysis";
import { renderDisposition } from "./dispositions";

export interface ParsedRow {
  alertNumber: string;
  dateCreated: Date;
  dueDate: Date;
  watchlist: string;
  subjectType: string;
  matchedTerm: string;
  ofacEntity: string;
  ofacEntityType: OfacEntityType;
}

export interface RowError {
  line: number;
  message: string;
}

export interface IngestSummary {
  datasetId: string;
  total: number;
  aiReviewed: number;
  pendingApproval: number;
  flagged: number;
  errors: RowError[];
}

function pick(record: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function addOneMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function parseEntityType(value: string): OfacEntityType {
  const v = value.trim().toUpperCase();
  if (["VESSEL", "SHIP", "BOAT"].includes(v)) return "VESSEL";
  if (["INDIVIDUAL", "PERSON", "PEP"].includes(v)) return "INDIVIDUAL";
  if (["ENTITY", "ORG", "ORGANIZATION", "COMPANY", "BUSINESS"].includes(v))
    return "ENTITY";
  if (["AIRCRAFT", "PLANE"].includes(v)) return "AIRCRAFT";
  return "UNKNOWN";
}

// Validate and normalize a raw CSV record into a ParsedRow.
export function parseRow(
  record: Record<string, string>,
  line: number,
): { row?: ParsedRow; error?: RowError } {
  const alertNumber = pick(record, "alert number", "alertnumber", "alert");
  const matchedTerm = pick(
    record,
    "matched term",
    "match info",
    "matchedterm",
    "flagged term",
    "transaction match",
  );
  const ofacEntity = pick(
    record,
    "ofac entity",
    "ofacentity",
    "matched entity",
    "entity",
    "watchlist entity",
  );

  if (!alertNumber) {
    return { error: { line, message: "Missing Alert Number" } };
  }
  if (!matchedTerm) {
    return { error: { line, message: "Missing Matched Term" } };
  }
  if (!ofacEntity) {
    return { error: { line, message: "Missing OFAC Entity" } };
  }

  const createdRaw = pick(record, "date created", "datecreated", "created");
  const dateCreated = parseDate(createdRaw) ?? new Date();

  const dueRaw = pick(record, "due date", "duedate", "due");
  const dueDate = parseDate(dueRaw) ?? addOneMonth(dateCreated);

  const watchlist = pick(record, "watchlist", "list") || "OFAC";
  const subjectType =
    pick(record, "subject type", "subjecttype", "subject") || "Transaction";
  const ofacEntityType = parseEntityType(
    pick(record, "ofac entity type", "entity type", "entitytype", "type"),
  );

  return {
    row: {
      alertNumber,
      dateCreated,
      dueDate,
      watchlist,
      subjectType,
      matchedTerm,
      ofacEntity,
      ofacEntityType,
    },
  };
}

// Build the Transaction create payload for a single parsed row, applying the
// repeat-case + analysis bucketing logic. `precedents` maps matchKey -> the
// disposition a human previously cleared it with.
interface Precedent {
  disposition: Disposition;
  alertNumber: string;
}

function buildTransaction(
  row: ParsedRow,
  precedents: Map<string, Precedent>,
): Prisma.TransactionCreateWithoutDatasetInput {
  const key = matchKey(row.matchedTerm, row.ofacEntity);
  const precedent = precedents.get(key);

  const base = {
    alertNumber: row.alertNumber,
    dateCreated: row.dateCreated,
    dueDate: row.dueDate,
    watchlist: row.watchlist,
    subjectType: row.subjectType,
    matchedTerm: row.matchedTerm,
    ofacEntity: row.ofacEntity,
    ofacEntityType: row.ofacEntityType,
    matchKey: key,
  };

  // Repeat case: a human previously cleared this exact flagged-text + entity
  // combination. Auto-clear via AI, reusing that disposition.
  if (precedent) {
    const result = analyze(row.matchedTerm, row.ofacEntity, row.ofacEntityType);
    const words = result.words;
    const text = renderDisposition(precedent.disposition, words);
    const reasoning = `Repeat of previously human-cleared case (alert ${precedent.alertNumber}). Auto-cleared by AI using the established disposition.`;
    return {
      ...base,
      status: "AI_REVIEWED",
      disposition: precedent.disposition,
      dispositionText: text,
      reasoning,
      logs: {
        create: {
          action: "AI_AUTO_CLEAR",
          disposition: precedent.disposition,
          dispositionText: text,
          reasoning,
        },
      },
    };
  }

  // New case: run the deterministic engine.
  const result = analyze(row.matchedTerm, row.ofacEntity, row.ofacEntityType);

  if (result.disposition) {
    return {
      ...base,
      status: "PENDING_APPROVAL",
      disposition: result.disposition,
      dispositionText: result.dispositionText,
      reasoning: result.reasoning,
      logs: {
        create: {
          action: "AI_PROPOSE",
          disposition: result.disposition,
          dispositionText: result.dispositionText,
          reasoning: result.reasoning,
        },
      },
    };
  }

  return {
    ...base,
    status: "FLAGGED",
    disposition: null,
    dispositionText: null,
    reasoning: result.reasoning,
    logs: {
      create: {
        action: "AI_FLAG",
        reasoning: result.reasoning,
      },
    },
  };
}

// Ingest a full set of parsed rows: create the dataset and all transactions,
// bucketing each one. Returns a summary.
export async function ingestRows(
  filename: string,
  uploadedById: string,
  rows: ParsedRow[],
): Promise<IngestSummary> {
  // Load human-established precedents for the keys in this batch.
  const keys = Array.from(
    new Set(rows.map((r) => matchKey(r.matchedTerm, r.ofacEntity))),
  );

  const cleared = await prisma.transaction.findMany({
    where: { matchKey: { in: keys }, status: "HUMAN_CLEARED", disposition: { not: null } },
    orderBy: { decidedAt: "desc" },
    select: { matchKey: true, disposition: true, alertNumber: true },
  });

  const precedents = new Map<string, Precedent>();
  for (const c of cleared) {
    if (!precedents.has(c.matchKey) && c.disposition) {
      precedents.set(c.matchKey, {
        disposition: c.disposition as Disposition,
        alertNumber: c.alertNumber,
      });
    }
  }

  const created = rows.map((r) => buildTransaction(r, precedents));

  const dataset = await prisma.dataset.create({
    data: {
      filename,
      uploadedById,
      transactions: { create: created },
    },
    include: { transactions: { select: { status: true } } },
  });

  const counts = { aiReviewed: 0, pendingApproval: 0, flagged: 0 };
  for (const t of dataset.transactions) {
    if (t.status === "AI_REVIEWED") counts.aiReviewed++;
    else if (t.status === "PENDING_APPROVAL") counts.pendingApproval++;
    else if (t.status === "FLAGGED") counts.flagged++;
  }

  return {
    datasetId: dataset.id,
    total: dataset.transactions.length,
    aiReviewed: counts.aiReviewed,
    pendingApproval: counts.pendingApproval,
    flagged: counts.flagged,
    errors: [],
  };
}
