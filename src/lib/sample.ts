// Generates a realistic sample OFAC-alert CSV for demos and the downloadable
// template. Includes a mix of single-word, two-word, vessel, full-name-mismatch
// and exact-match (will-be-flagged) scenarios.

const SAMPLE_ROWS: string[][] = [
  // alert, dateCreated, matchedTerm, ofacEntity, entityType
  ["10001", "2026-05-01", "ACME GLOBAL SHIPPING / JOHN SMITH", "JOHN MICHAEL SMITH", "INDIVIDUAL"],
  ["10002", "2026-05-02", "PAYMENT TO VICTORIA HOLDINGS", "VICTORIA", "VESSEL"],
  ["10003", "2026-05-02", "WIRE REF AL RASHID TRADING", "AL RASHID GENERAL TRADING", "ENTITY"],
  ["10004", "2026-05-03", "MARIA GONZALEZ FERNANDEZ", "PEDRO ANTONIO RAMIREZ", "INDIVIDUAL"],
  ["10005", "2026-05-03", "TRANSFER TO IBRAHIM", "IBRAHIM", "INDIVIDUAL"],
  ["10006", "2026-05-04", "VESSEL HORIZON STAR FUEL", "HORIZON", "VESSEL"],
  ["10007", "2026-05-04", "GLOBAL TANG SHIPPING CO", "TANG", "VESSEL"],
  ["10008", "2026-05-05", "KARIM SALEH ENTERPRISES", "KARIM SALEH", "INDIVIDUAL"],
  ["10009", "2026-05-05", "VLADIMIR PUTIN", "VLADIMIR PUTIN", "INDIVIDUAL"],
  ["10010", "2026-05-06", "PAYMENT JING WANG LOGISTICS", "WANG", "INDIVIDUAL"],
  ["10011", "2026-05-06", "ORINOCO PETROLEUM EXPORT", "ORINOCO IRON CASTV", "ENTITY"],
  ["10012", "2026-05-07", "AHMED AL MASRI CONSULTING", "AHMED AL MASRI", "INDIVIDUAL"],
];

export function sampleCsv(): string {
  const header = [
    "Alert Number",
    "Date Created",
    "Matched Term",
    "OFAC Entity",
    "OFAC Entity Type",
  ];
  const lines = [header, ...SAMPLE_ROWS].map((cols) =>
    cols
      .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
      .join(","),
  );
  return lines.join("\n") + "\n";
}
