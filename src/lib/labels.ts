import type { CaseStatus } from "./types";

export const STATUS_LABELS: Record<CaseStatus, string> = {
  AI_REVIEWED: "AI Reviewed",
  PENDING_APPROVAL: "Pending Human Approval",
  FLAGGED: "Flagged for Human Review",
  HUMAN_CLEARED: "Human Cleared",
};

export const STATUS_BADGE_CLASS: Record<CaseStatus, string> = {
  AI_REVIEWED: "ai",
  PENDING_APPROVAL: "pending",
  FLAGGED: "flagged",
  HUMAN_CLEARED: "cleared",
};
