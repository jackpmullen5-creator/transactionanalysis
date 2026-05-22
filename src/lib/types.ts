// SQLite has no native enums, so these domain enums live here as string union
// types. DB columns are plain strings constrained to these values in code.

export type Role = "ADMIN" | "ANALYST";

export type CaseStatus =
  | "AI_REVIEWED"
  | "PENDING_APPROVAL"
  | "FLAGGED"
  | "HUMAN_CLEARED";

export type Disposition =
  | "FP_SINGLE_WORD"
  | "FP_SINGLE_WORD_VESSEL"
  | "FP_TWO_WORDS"
  | "FP_FULL_NAME_MISMATCH"
  | "MASS_CLOSE";

export type OfacEntityType =
  | "INDIVIDUAL"
  | "ENTITY"
  | "VESSEL"
  | "AIRCRAFT"
  | "UNKNOWN";
