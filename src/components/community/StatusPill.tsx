import type { FeedbackStatus, SuggestionStatus } from "../../api/types";

const FEEDBACK: Record<FeedbackStatus, { label: string; cls: string }> = {
  open: { label: "Received", cls: "" },
  in_review: { label: "Being looked at", cls: "pill-blue" },
  resolved: { label: "Resolved", cls: "pill-green" },
};

const SUGGESTION: Record<SuggestionStatus, { label: string; cls: string }> = {
  pending: { label: "Waiting for review", cls: "" },
  planned: { label: "Planned", cls: "pill-blue" },
  implemented: { label: "Implemented", cls: "pill-green" },
  rejected: { label: "Declined", cls: "pill-red" },
};

export function FeedbackStatusPill({ status }: { status: FeedbackStatus }) {
  const s = FEEDBACK[status];
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

export function SuggestionStatusPill({ status }: { status: SuggestionStatus }) {
  const s = SUGGESTION[status];
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

export const FEEDBACK_STATUS_LABELS = FEEDBACK;
export const SUGGESTION_STATUS_LABELS = SUGGESTION;
