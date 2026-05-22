import type { Disposition } from "./types";

// Human-readable label for each disposition (used in dropdowns/filters).
export const DISPOSITION_LABELS: Record<Disposition, string> = {
  FP_SINGLE_WORD: "False positive — single word",
  FP_SINGLE_WORD_VESSEL: "False positive — single word (vessel)",
  FP_TWO_WORDS: "False positive — two words",
  FP_FULL_NAME_MISMATCH: "False positive — full name mismatch",
  MASS_CLOSE: "Mass close — no suspicious activity",
};

export const ALL_DISPOSITIONS: Disposition[] = [
  "FP_SINGLE_WORD",
  "FP_SINGLE_WORD_VESSEL",
  "FP_TWO_WORDS",
  "FP_FULL_NAME_MISMATCH",
  "MASS_CLOSE",
];

// Render the final disposition text shown to the compliance team, filling any
// XXXX placeholders from the matched word(s).
export function renderDisposition(
  disposition: Disposition,
  words: string[] = [],
): string {
  switch (disposition) {
    case "FP_SINGLE_WORD":
      return `False positive hit on single word ${words[0] ?? "XXXX"}.`;
    case "FP_SINGLE_WORD_VESSEL":
      return `False positive hit on single word ${words[0] ?? "XXXX"}, which is a vessel.`;
    case "FP_TWO_WORDS":
      return `False positive hit on single words ${words[0] ?? "XXXX"} and ${
        words[1] ?? "XXXX"
      }.`;
    case "FP_FULL_NAME_MISMATCH":
      return "False positive full name mismatch.";
    case "MASS_CLOSE":
      return "Mass close after review completion. No suspicious activity detected.";
  }
}
