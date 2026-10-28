"use client";

/** The icons the exam cards use, drawn like the rest of the portal's (24px, 1.8 stroke). */
const PATHS = {
  // A pencil: edit the title, class and duration.
  details: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  // A list with ticks: the questions.
  questions: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  // A calendar with a clock: date and time.
  schedule: "M8 2v4M16 2v4M3 10h18M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M17.5 15.5V18l1.5 1M22 18a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z",
  // People: who is sitting it.
  sittings: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  // A bar chart: how students did.
  results: "M3 3v18h18M8 17v-5M13 17V8M18 17v-9",
  // A sheet with an arrow going in: send to Term scores.
  send: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 15h6M12 12l3 3-3 3",
} as const;

export type IconName = keyof typeof PATHS;

/**
 * A square button showing only an icon. Its name appears in a label above
 * it on hover or keyboard focus, and is what screen readers announce.
 * `pressed` keeps it highlighted while the panel it opens is showing.
 */
export default function IconButton({
  icon,
  label,
  onClick,
  pressed,
  tone = "ink",
  tour,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  /** "navy" for actions that send something elsewhere, as the text buttons beside them are. */
  tone?: "ink" | "navy";
  tour?: string;
}) {
  const colours =
    tone === "navy"
      ? pressed
        ? "border-brand-navy bg-brand-navy text-white"
        : "border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white"
      : pressed
        ? "border-ink bg-ink text-white"
        : "border-ink text-ink hover:bg-ink hover:text-white";
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-tour={tour}
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={`peer inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-btn border transition-colors duration-200 ${colours}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={PATHS[icon]} />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-btn bg-ink px-2 py-1 text-[12px] font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
