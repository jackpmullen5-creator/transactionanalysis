import type { Disposition, OfacEntityType } from "./types";
import { renderDisposition } from "./dispositions";

// Words that carry no identifying weight when comparing names/terms.
const STOPWORDS = new Set([
  "THE",
  "OF",
  "AND",
  "AKA",
  "FKA",
  "DBA",
  "LTD",
  "LLC",
  "INC",
  "CO",
  "CORP",
  "COMPANY",
  "LIMITED",
]);

// Vessel-name indicators used as a fallback when the entity type is UNKNOWN.
const VESSEL_HINTS = [
  "M/V",
  "MV",
  "M/T",
  "MT",
  "S/S",
  "SS",
  "VESSEL",
  "TANKER",
  "TANG",
];

export function normalize(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stable dedupe key for repeat-case detection: same flagged text + same entity.
export function matchKey(matchedTerm: string, ofacEntity: string): string {
  return `${normalize(matchedTerm)}|${normalize(ofacEntity)}`;
}

function tokens(input: string): string[] {
  return normalize(input)
    .split(" ")
    .filter((w) => w.length > 0);
}

function significantTokens(input: string): string[] {
  return tokens(input).filter((w) => !STOPWORDS.has(w) && w.length > 1);
}

function looksLikeVessel(ofacEntity: string, type: OfacEntityType): boolean {
  if (type === "VESSEL") return true;
  const upper = ` ${ofacEntity.toUpperCase()} `;
  return VESSEL_HINTS.some((hint) => upper.includes(` ${hint} `));
}

export interface AnalysisResult {
  // null disposition => could not decision => flag for human review.
  disposition: Disposition | null;
  // Confidence the engine has in an automatic clear, 0..1.
  confidence: number;
  // The word(s) used to fill XXXX in the disposition text.
  words: string[];
  // Rendered disposition text (null when flagged).
  dispositionText: string | null;
  // Human-readable explanation of the decision.
  reasoning: string;
}

// Deterministic, auditable disposition engine.
//
// Compares the flagged transaction text against the matched OFAC entity and
// chooses one of the false-positive dispositions, or returns null (flag) when
// the overlap is too strong to safely auto-clear.
export function analyze(
  matchedTerm: string,
  ofacEntity: string,
  ofacEntityType: OfacEntityType,
): AnalysisResult {
  const termTokens = significantTokens(matchedTerm);
  const entityTokens = significantTokens(ofacEntity);
  const entitySet = new Set(entityTokens);

  // Shared significant words, in the order they appear in the flagged text.
  const shared = termTokens.filter((w) => entitySet.has(w));
  const uniqueShared: string[] = [];
  for (const w of shared) if (!uniqueShared.includes(w)) uniqueShared.push(w);

  const normTerm = normalize(matchedTerm);
  const normEntity = normalize(ofacEntity);

  // 1) Exact match to the sanctioned entity — potential TRUE positive. Never
  //    auto-clear; this must go to a human.
  if (normTerm === normEntity && normTerm.length > 0) {
    return {
      disposition: null,
      confidence: 0,
      words: [],
      dispositionText: null,
      reasoning:
        "Flagged text is an exact match to the OFAC entity. Cannot be auto-dispositioned as a false positive — flagged for human review.",
    };
  }

  // 2) Strong overlap (3+ shared significant words) but not exact — too close
  //    to safely auto-clear.
  if (uniqueShared.length >= 3) {
    return {
      disposition: null,
      confidence: 0.2,
      words: uniqueShared,
      dispositionText: null,
      reasoning: `Flagged text shares ${uniqueShared.length} significant words with the OFAC entity (${uniqueShared.join(
        ", ",
      )}). Overlap is too strong to auto-clear — flagged for human review.`,
    };
  }

  // 3) Two shared words.
  if (uniqueShared.length === 2) {
    const words = uniqueShared.slice(0, 2);
    return {
      disposition: "FP_TWO_WORDS",
      confidence: 0.8,
      words,
      dispositionText: renderDisposition("FP_TWO_WORDS", words),
      reasoning: `Only the words "${words[0]}" and "${words[1]}" overlap with the OFAC entity "${ofacEntity}"; the full identities differ. Treated as a two-word false positive.`,
    };
  }

  // 4) One shared word — vessel vs ordinary single-word hit.
  if (uniqueShared.length === 1) {
    const word = uniqueShared[0];
    if (looksLikeVessel(ofacEntity, ofacEntityType)) {
      return {
        disposition: "FP_SINGLE_WORD_VESSEL",
        confidence: 0.85,
        words: [word],
        dispositionText: renderDisposition("FP_SINGLE_WORD_VESSEL", [word]),
        reasoning: `Single word "${word}" matched the OFAC entity "${ofacEntity}", which is a vessel. Treated as a single-word vessel false positive.`,
      };
    }
    return {
      disposition: "FP_SINGLE_WORD",
      confidence: 0.85,
      words: [word],
      dispositionText: renderDisposition("FP_SINGLE_WORD", [word]),
      reasoning: `Single word "${word}" matched the OFAC entity "${ofacEntity}"; the rest of the identity does not match. Treated as a single-word false positive.`,
    };
  }

  // 5) No significant overlap — the names are different. If both sides are
  //    multi-word names, this is a clean full-name mismatch. Otherwise we lack
  //    enough signal and flag it.
  if (termTokens.length >= 2 && entityTokens.length >= 2) {
    return {
      disposition: "FP_FULL_NAME_MISMATCH",
      confidence: 0.7,
      words: [],
      dispositionText: renderDisposition("FP_FULL_NAME_MISMATCH"),
      reasoning: `Flagged full name "${matchedTerm}" shares no significant words with the OFAC entity "${ofacEntity}". Treated as a full name mismatch.`,
    };
  }

  return {
    disposition: null,
    confidence: 0,
    words: [],
    dispositionText: null,
    reasoning: `Unable to determine a reliable disposition for flagged text "${matchedTerm}" vs OFAC entity "${ofacEntity}". Flagged for human review.`,
  };
}
