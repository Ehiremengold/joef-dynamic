"use client";

import { useEffect, useRef, useState } from "react";
import type { Mark, Style } from "@/lib/richText";
import type { RichFieldControls } from "./RichField";

const STYLES: { mark: Mark; label: React.ReactNode; name: string; look: string }[] = [
  { mark: "b", label: "B", name: "Bold", look: "font-bold" },
  { mark: "u", label: "U", name: "Underline", look: "underline" },
  { mark: "i", label: "I", name: "Italic", look: "italic" },
  { mark: "sup", label: <>x<sup>2</sup></>, name: "Superscript, e.g. x² or 10³", look: "" },
  { mark: "sub", label: <>x<sub>2</sub></>, name: "Subscript, e.g. H₂O", look: "" },
];

/** What the Symbols panel offers, by subject. Each one is typed in as it is. */
const SYMBOLS: { group: string; items: string[] }[] = [
  { group: "Maths", items: ["√", "∛", "²", "³", "½", "⅓", "¼", "¾", "π", "°", "±", "×", "÷", "≠", "≈", "≤", "≥", "∞", "∑", "∫", "∆", "∠", "⊥", "∥", "≅", "∴", "∵", "′", "″", "∈", "∉", "⊂", "∪", "∩", "∅", "₦"] },
  { group: "Greek", items: ["α", "β", "γ", "δ", "ε", "θ", "λ", "μ", "ρ", "σ", "φ", "ω", "Δ", "Σ", "Ω"] },
  { group: "Chemistry & physics", items: ["→", "⇌", "←", "↑", "↓", "⁺", "⁻", "·", "°C", "Å", "Ω"] },
];

// No background here: each button sets its own, so an "on" colour can't lose to white.
const BUTTON = "h-8 min-w-8 cursor-pointer rounded-btn border px-1.5 text-sm hover:border-brand-navy";

/**
 * Formatting for the question boxes (RichField): bold, underline, italic,
 * superscript and subscript style the selected words, or what is typed next,
 * and Symbols types in √, π, →, … Each acts on the box `field` gives (the
 * last one typed in). A button shows as pressed while the cursor is in that style.
 */
export default function QuestionToolbar({ field }: { field: () => RichFieldControls | null }) {
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [on, setOn] = useState<Partial<Style>>({});
  // Pressing a button mustn't take the cursor (and the selection) out of the box.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  // Which styles the cursor is in, while it is in the box: when it moves, and after a
  // keyboard shortcut (Ctrl+B changes the style without moving it).
  const refresh = () => {
    const box = field();
    setOn(box?.focused() ? box.style() : {});
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const update = () => refreshRef.current();
    document.addEventListener("selectionchange", update);
    document.addEventListener("keyup", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("keyup", update);
    };
  }, []);

  const toggle = (mark: Mark) => {
    field()?.toggle(mark);
    refresh();
  };
  const insert = (text: string) => field()?.insert(text);

  return (
    <>
      <div data-tour="question-toolbar" className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
        {STYLES.map((s) => (
          <button
            key={s.mark}
            type="button"
            onMouseDown={keepFocus}
            onClick={() => toggle(s.mark)}
            aria-label={s.name}
            aria-pressed={on[s.mark] ?? false}
            title={s.name}
            className={`${BUTTON} ${s.look} ${on[s.mark] ? "border-brand-navy bg-brand-navy/10 text-brand-navy" : "border-smoke bg-white"}`}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setSymbolsOpen((o) => !o)}
          aria-expanded={symbolsOpen}
          className={`${BUTTON} px-2.5 font-semibold ${symbolsOpen ? "border-brand-navy bg-brand-navy text-white" : "border-smoke bg-white"}`}
        >
          √ π Symbols
        </button>
      </div>
      {symbolsOpen && (
        <div className="basis-full rounded-btn border border-smoke bg-white p-3">
          {SYMBOLS.map(({ group, items }) => (
            <div key={group} className="mt-2 first:mt-0">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-pewter">{group}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {items.map((sym) => (
                  <button
                    key={`${group}-${sym}`}
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => insert(sym)}
                    aria-label={`Insert ${sym}`}
                    // Several of these are drawn small in most fonts; a size up keeps them readable.
                    className={`${BUTTON} h-9 min-w-9 border-smoke bg-white text-base font-medium`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="mt-3 text-[12px] leading-relaxed text-pewter">
            Click in a box first; the symbol goes where the cursor is. For a square root of more than one term, use
            brackets: √(x + 1). For powers and chemical formulas, press x<sup>2</sup> or x<sub>2</sub>, type the
            number, then press it again to go back to normal: x<sup>2</sup>, 10<sup>-3</sup>, H<sub>2</sub>SO<sub>4</sub>,
            Ca<sup>2+</sup>. Or select a number already typed and press the button.
          </p>
        </div>
      )}
    </>
  );
}
