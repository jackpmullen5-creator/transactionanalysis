import Anthropic from "@anthropic-ai/sdk";
import type { OfacEntityType } from "./types";

// One extracted alert, before validation/normalization in ingest.parseRow.
export interface ExtractedAlert {
  alertNumber: string;
  dateCreated: string;
  dueDate: string;
  watchlist: string;
  subjectType: string;
  matchedTerm: string;
  ofacEntity: string;
  ofacEntityType: OfacEntityType;
}

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are a compliance data-extraction engine for an OFAC sanctions-screening team.
You receive a PDF containing one or more transaction alerts that were flagged during sanctions screening.
The layout is NOT fixed — alerts may appear as tables, forms, lists, or free text, and field labels vary.
Your job is to read the document and extract EVERY distinct alert as a structured record.

For each alert, capture:
- alertNumber: the alert/case identifier (often a ~5-digit number). If absent, synthesize a stable one from context.
- dateCreated: the date the alert was created/opened, ISO format (YYYY-MM-DD) if determinable, else "".
- dueDate: the review due date if present, ISO format, else "" (the system defaults it to one month after dateCreated).
- watchlist: the watchlist that triggered the hit. Default to "OFAC" if not stated.
- subjectType: what was screened. Default to "Transaction" if not stated.
- matchedTerm: the exact portion of OUR transaction that was flagged (the wire text / name / token that matched).
- ofacEntity: the name of the entity on the OFAC list that the transaction matched against.
- ofacEntityType: classify the OFAC entity as one of INDIVIDUAL, ENTITY, VESSEL, AIRCRAFT, or UNKNOWN.

Be thorough: do not skip alerts, do not merge distinct alerts, and do not invent alerts that are not present.
If a field is genuinely not present, use an empty string (or UNKNOWN for ofacEntityType) rather than guessing.`;

const ALERTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    alerts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          alertNumber: { type: "string" },
          dateCreated: { type: "string" },
          dueDate: { type: "string" },
          watchlist: { type: "string" },
          subjectType: { type: "string" },
          matchedTerm: { type: "string" },
          ofacEntity: { type: "string" },
          ofacEntityType: {
            type: "string",
            enum: ["INDIVIDUAL", "ENTITY", "VESSEL", "AIRCRAFT", "UNKNOWN"],
          },
        },
        required: [
          "alertNumber",
          "dateCreated",
          "dueDate",
          "watchlist",
          "subjectType",
          "matchedTerm",
          "ofacEntity",
          "ofacEntityType",
        ],
      },
    },
  },
  required: ["alerts"],
} as const;

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not configured. Set it in your environment (and in Vercel project settings) to enable PDF analysis.",
    );
    this.name = "MissingApiKeyError";
  }
}

// Read a PDF (as raw bytes) and let Claude extract the alerts it contains.
export async function extractAlertsFromPdf(
  pdf: Buffer,
): Promise<ExtractedAlert[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();

  const client = new Anthropic();
  const base64 = pdf.toString("base64");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ALERTS_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: "Extract every transaction alert in this document as structured records, following the schema exactly.",
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: { alerts?: ExtractedAlert[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The analysis model returned an unparseable response.");
  }

  return Array.isArray(parsed.alerts) ? parsed.alerts : [];
}
