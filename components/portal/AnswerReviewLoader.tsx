"use client";

import { useApi } from "@/lib/client/api";
import type { AnswerReview } from "@/lib/types";
import AnswerReviewView from "./AnswerReviewView";

/** Fetch one result's answers and show them: for a student their own, for staff anyone's. */
export default function AnswerReviewLoader({
  attemptId,
  answerLabel,
  onUnauthorized,
}: {
  attemptId: string;
  /** How the chosen answer is labelled: "Your answer" for a student, "Their answer" for staff. */
  answerLabel: string;
  onUnauthorized?: () => void;
}) {
  const q = useApi<{ review: AnswerReview }>(`/api/attempts/${attemptId}/review`, onUnauthorized);
  if (q.error) return <p className="rounded-btn bg-mist px-4 py-3 text-sm text-graphite" role="alert">{q.error.message}</p>;
  if (!q.data) return <p className="text-sm text-graphite">Opening the answers…</p>;
  return <AnswerReviewView review={q.data.review} answerLabel={answerLabel} />;
}
