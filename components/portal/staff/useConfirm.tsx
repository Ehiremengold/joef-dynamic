"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  /** Red confirm button, for things that can't be undone. */
  danger?: boolean;
  /** Ask for a short written reason; the confirm button waits for one. */
  reason?: { label: string; placeholder?: string };
};

/**
 * A confirmation dialog in the portal's own style, in place of the browser's
 * confirm()/prompt(). Render `dialog` once in the component, then:
 *
 *   const answer = await confirm({ title: "Delete exam?", confirmLabel: "Delete", danger: true });
 *   if (!answer) return;          // cancelled
 *   answer.reason                 // what they typed, when `reason` was asked for
 */
export function useConfirm() {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const [reason, setReason] = useState("");
  const settle = useRef<(answer: false | { reason: string }) => void>(() => {});

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<false | { reason: string }>((resolve) => {
        settle.current = resolve;
        setReason("");
        setOpen(options);
      }),
    []
  );

  const close = useCallback((answer: false | { reason: string }) => {
    setOpen(null);
    settle.current(answer);
  }, []);

  const dialog = open ? (
    <ConfirmDialog options={open} reason={reason} setReason={setReason} onClose={close} />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  options,
  reason,
  setReason,
  onClose,
}: {
  options: ConfirmOptions;
  reason: string;
  setReason: (r: string) => void;
  onClose: (answer: false | { reason: string }) => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const blocked = Boolean(options.reason) && reason.trim().length === 0;

  useEffect(() => {
    (options.reason ? reasonRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options.reason, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-[440px] rounded-card border border-smoke bg-white p-6">
        <h3 id="confirm-title" className="font-display text-lg font-bold tracking-tight">{options.title}</h3>
        {options.message && <div className="mt-2 text-sm leading-relaxed text-graphite">{options.message}</div>}
        {options.reason && (
          <>
            <label className="mt-4 block text-sm font-semibold" htmlFor="confirm-reason">{options.reason.label}</label>
            <textarea
              id="confirm-reason"
              ref={reasonRef}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={options.reason.placeholder}
              className="mt-2 w-full rounded-btn border border-smoke px-3 py-2.5 text-sm outline-none focus:border-brand-navy"
            />
          </>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-graphite hover:text-ink"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={blocked}
            onClick={() => onClose({ reason: reason.trim() })}
            className={`cursor-pointer rounded-btn px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              options.danger ? "bg-brand-red hover:bg-brand-red-dark" : "bg-brand-navy hover:bg-ink"
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
