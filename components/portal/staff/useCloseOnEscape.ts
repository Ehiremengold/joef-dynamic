"use client";

import { useEffect } from "react";

/** Closes a dialog when Escape is pressed. Pair with `closeOnBackdrop` for clicks outside it. */
export function useCloseOnEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** onMouseDown for a dialog's backdrop: a press on the backdrop itself (not the dialog) closes it. */
export const closeOnBackdrop = (onClose: () => void) => (e: React.MouseEvent) => {
  if (e.target === e.currentTarget) onClose();
};
