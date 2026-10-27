"use client";

import AnswerReviewLoader from "@/components/portal/AnswerReviewLoader";
import { closeOnBackdrop, useCloseOnEscape } from "./useCloseOnEscape";

/** One student's result, question by question, over the page (Results tab, or an exam's results). */
export default function AnswerReviewDialog({
  attemptId,
  onClose,
  onUnauthorized,
}: {
  attemptId: string;
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  useCloseOnEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center" onMouseDown={closeOnBackdrop(onClose)}>
      <div role="dialog" aria-modal="true" aria-label="Answers" className="flex max-h-[92vh] w-full max-w-[760px] flex-col rounded-card border border-smoke bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <AnswerReviewLoader attemptId={attemptId} answerLabel="Their answer" onUnauthorized={onUnauthorized} />
        </div>
        <div className="flex justify-end border-t border-smoke p-4">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-btn bg-brand-navy px-5 py-2 text-sm font-semibold text-white hover:bg-ink">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
