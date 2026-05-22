// Minimal RFC-4180-ish CSV parser supporting quoted fields, escaped quotes
// ("") and both \n and \r\n line endings. Returns an array of row objects keyed
// by the (lowercased, trimmed) header names.

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully empty trailing lines.
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cells[idx] ?? "").trim();
    });
    records.push(record);
  }
  return records;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // handled by the following \n; ignore standalone \r
    } else {
      field += char;
    }
  }

  // Flush last field/row if there is trailing content.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
