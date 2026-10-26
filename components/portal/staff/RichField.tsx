"use client";

import { useLayoutEffect, useRef } from "react";
import { fromStyled, PLAIN, plainText, toEditorHtml, toStyled, type Mark, type Style, type Styled } from "@/lib/richText";
import { clipboardToMarked, editorToMarked, hasBlocks, pointAt, positionIn } from "./richFieldDom";

/** What the toolbar (QuestionToolbar) can ask of a box. */
export type RichFieldControls = {
  /** Style the selection, or (with no selection) what is typed next. */
  toggle: (mark: Mark) => void;
  /** Type text in at the cursor (a symbol), in the style there. */
  insert: (text: string) => void;
  /** The style at the cursor, for showing which buttons are on. */
  style: () => Style;
  /** Whether the cursor is in this box. */
  focused: () => boolean;
};

type Selection = { start: number; end: number };
type Snapshot = { value: string; sel: Selection };

/**
 * A text box that shows its formatting as it will look: bold, underline,
 * italic, x² and H₂O appear as such, never as tags. What it holds, and saves,
 * is text with marks (lib/richText). Formatting is done here rather than by
 * the browser's own commands, which can't switch superscript or bold back
 * off at the cursor: pressing x², typing 2 and pressing x² again gives x²
 * and normal text after, as in Word. Ctrl/Cmd + B, I, U and Z work too.
 *
 * The box is kept in the form toEditorHtml draws (text, <br> and the five
 * marks) so that positions in it and in its text always line up: Enter is
 * handled here, and anything the browser builds differently is redrawn
 * before formatting.
 */
export default function RichField({
  value,
  onChange,
  label,
  placeholder,
  multiline = false,
  minHeight,
  controlsRef,
  onFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Read out by screen readers, as a label would be. */
  label: string;
  placeholder?: string;
  /** Line breaks allowed (the question, the paste box); an option stays on one line. */
  multiline?: boolean;
  /** CSS min-height, e.g. "4.5rem". */
  minHeight?: string;
  /** Filled with this box's controls, for a toolbar that acts on it before it has been clicked. */
  controlsRef?: React.RefObject<RichFieldControls | null>;
  /** The cursor came into this box: a toolbar acts on the box last typed in. */
  onFocus?: (controls: RichFieldControls) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // What the box shows right now, as text with marks. It is only redrawn when
  // the value changes from outside (cleared after a save, another question
  // opened) or by a change made here; never on an ordinary keystroke.
  const shown = useRef<string | null>(null);
  // The style the next typed character gets, after a button was pressed with
  // nothing selected; forgotten once used or once the cursor moves.
  const pending = useRef<{ at: number; style: Style } | null>(null);
  // Where a phone keyboard or accent input began a word in a pending style.
  const composing = useRef<{ at: number; style: Style } | null>(null);
  const history = useRef<{ past: Snapshot[]; future: Snapshot[]; lastTyped: number }>({ past: [], future: [], lastTyped: 0 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === shown.current) return;
    el.innerHTML = toEditorHtml(value);
    shown.current = value;
    history.current = { past: [], future: [], lastTyped: 0 };
  }, [value]);

  const selection = (): Selection | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
    return { start: positionIn(el, r.startContainer, r.startOffset), end: positionIn(el, r.endContainer, r.endOffset) };
  };

  const select = ({ start, end }: Selection) => {
    const el = ref.current;
    if (!el) return;
    const range = document.createRange();
    range.setStart(...pointAt(el, start));
    range.setEnd(...pointAt(el, end));
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  /** Save the box as it is now, so Ctrl+Z can come back to it. A run of typing is one step, as in Word. */
  const remember = (typed: boolean) => {
    const h = history.current;
    const now = Date.now();
    if (!(typed && now - h.lastTyped < 1000 && h.past.length > 0)) {
      h.past.push({ value: shown.current ?? "", sel: selection() ?? { start: 0, end: 0 } });
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.lastTyped = typed ? now : 0;
  };

  /** Redraw the box from a new text, put the selection back, and report the change. */
  const show = (styled: Styled, sel: Selection) => {
    const el = ref.current;
    if (!el) return;
    const next = fromStyled(styled);
    el.innerHTML = toEditorHtml(next);
    shown.current = next;
    select(sel);
    if (next !== value) onChangeRef.current(next);
  };

  const current = (): Styled => toStyled(ref.current ? editorToMarked(ref.current) : shown.current ?? "");

  /** Bring the box back to the form it is drawn in, if the browser built something else, keeping the cursor. */
  const settle = () => {
    const el = ref.current;
    if (!el || !hasBlocks(el)) return;
    const sel = selection();
    el.innerHTML = toEditorHtml(editorToMarked(el));
    if (sel) select(sel);
  };

  /** The style typing continues in at a point: the character before it (or after, at a line's start). */
  const styleAt = (s: Styled, at: number): Style => {
    if (pending.current?.at === at) return pending.current.style;
    if (at === 0 || s.text[at - 1] === "\n") return s.styles[at] && s.text[at] !== "\n" ? s.styles[at] : PLAIN;
    return s.styles[at - 1];
  };

  /** Put text in place of the selection: styled as given, or in the style at the cursor. */
  const replace = (insert: Styled | string, sel: Selection) => {
    const s = current();
    const ins = typeof insert === "string" ? { text: insert, styles: Array<Style>(insert.length).fill(styleAt(s, sel.start)) } : insert;
    remember(false);
    pending.current = null;
    show(
      { text: s.text.slice(0, sel.start) + ins.text + s.text.slice(sel.end), styles: [...s.styles.slice(0, sel.start), ...ins.styles, ...s.styles.slice(sel.end)] },
      { start: sel.start + ins.text.length, end: sel.start + ins.text.length }
    );
  };

  /** The selection, or the end of the box if the cursor isn't in it (focusing it first). */
  const here = (): Selection => {
    const el = ref.current!;
    if (document.activeElement !== el) el.focus();
    settle();
    const end = current().text.length;
    return selection() ?? { start: end, end };
  };

  const toggle = (mark: Mark) => {
    if (!ref.current) return;
    const sel = here();
    const s = current();
    const flip = (st: Style, on: boolean): Style => {
      const next = { ...st, [mark]: on };
      // A character is raised or lowered, never both.
      if (on && mark === "sup") next.sub = false;
      if (on && mark === "sub") next.sup = false;
      return next;
    };
    if (sel.start === sel.end) {
      // Nothing selected: switch the style for what is typed next.
      const st = styleAt(s, sel.start);
      pending.current = { at: sel.start, style: flip(st, !st[mark]) };
      select(sel);
      return;
    }
    const picked = s.styles.slice(sel.start, sel.end).filter((_, i) => s.text[sel.start + i] !== "\n");
    const on = !picked.every((st) => st[mark]);
    remember(false);
    pending.current = null;
    show({ text: s.text, styles: s.styles.map((st, i) => (i >= sel.start && i < sel.end ? flip(st, on) : st)) }, sel);
  };

  const undoRedo = (back: boolean) => {
    const h = history.current;
    const step = (back ? h.past : h.future).pop();
    if (!step) return;
    (back ? h.future : h.past).push({ value: shown.current ?? "", sel: selection() ?? step.sel });
    h.lastTyped = 0;
    pending.current = null;
    show(toStyled(step.value), step.sel);
  };

  const controls: RichFieldControls = {
    toggle,
    insert: (text) => {
      if (ref.current) replace(text, here());
    },
    style: () => {
      const sel = selection();
      return sel ? styleAt(current(), sel.start) : PLAIN;
    },
    focused: () => !!ref.current && document.activeElement === ref.current,
  };
  useLayoutEffect(() => {
    if (controlsRef) controlsRef.current = controls;
  });

  // The browser's own events (React's onBeforeInput is an older event without inputType).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const beforeInput = (ev: InputEvent) => {
      if (ev.inputType === "historyUndo" || ev.inputType === "historyRedo") {
        ev.preventDefault();
        return undoRedo(ev.inputType === "historyUndo");
      }
      // A phone keyboard or accent input is mid-word: leave it alone (compositionend styles it).
      if (ev.isComposing) return;
      const sel = selection();
      if (ev.inputType === "insertParagraph" || ev.inputType === "insertLineBreak") {
        // Enter: a line break drawn the box's own way (an option stays on one line).
        ev.preventDefault();
        if (multiline && sel) replace("\n", sel);
        return;
      }
      // The first character after a button press with nothing selected: type it in the chosen style.
      if (ev.inputType === "insertText" && ev.data && pending.current && sel && sel.start === sel.end && sel.start === pending.current.at) {
        ev.preventDefault();
        return replace(ev.data, sel);
      }
      // Ordinary typing and deleting: the browser does it; keep the box as it was, for Ctrl+Z.
      remember(true);
    };
    const compositionStart = () => {
      const sel = selection();
      composing.current = pending.current && sel && sel.start === pending.current.at ? { ...pending.current } : null;
    };
    // The word is finished: give it the style chosen before it began.
    const compositionEnd = () => {
      const started = composing.current;
      composing.current = null;
      if (!started) return;
      requestAnimationFrame(() => {
        const sel = selection();
        if (!sel) return;
        const s = current();
        pending.current = null;
        show({ text: s.text, styles: s.styles.map((st, i) => (i >= started.at && i < sel.start ? started.style : st)) }, sel);
      });
    };
    // A style chosen for the next character is forgotten once the cursor goes elsewhere.
    const moved = () => {
      if (pending.current && !composing.current && selection()?.start !== pending.current.at) pending.current = null;
    };
    el.addEventListener("beforeinput", beforeInput);
    el.addEventListener("compositionstart", compositionStart);
    el.addEventListener("compositionend", compositionEnd);
    document.addEventListener("selectionchange", moved);
    return () => {
      el.removeEventListener("beforeinput", beforeInput);
      el.removeEventListener("compositionstart", compositionStart);
      el.removeEventListener("compositionend", compositionEnd);
      document.removeEventListener("selectionchange", moved);
    };
  });

  /** After ordinary typing: read what the box now holds. */
  function read() {
    const el = ref.current;
    if (!el) return;
    const next = editorToMarked(el);
    if (next === shown.current) return;
    shown.current = next;
    if (next !== value) onChange(next);
  }

  function keyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const mark = ({ b: "b", i: "i", u: "u" } as const)[key as "b" | "i" | "u"];
    if (mark) {
      e.preventDefault();
      toggle(mark);
    } else if (key === "z" || key === "y") {
      e.preventDefault();
      undoRedo(key === "z" && !e.shiftKey);
    }
  }

  // Only ever let in text and the five marks: never another page's colours, fonts or pictures.
  function paste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const copied = html ? clipboardToMarked(html) : null;
    let text = copied ?? e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (!multiline) text = text.replace(/\s*\n\s*/g, " ");
    // Formatted copy keeps its own styles; plain text takes the style at the cursor.
    replace(copied ? toStyled(text) : text, here());
  }

  const empty = !plainText(value).trim();

  return (
    <div className="relative">
      <div
        ref={ref}
        role="textbox"
        aria-label={label}
        aria-multiline={multiline}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={read}
        onBlur={read}
        onPaste={paste}
        onDrop={(e) => e.preventDefault()}
        onFocus={() => onFocus?.(controls)}
        onKeyDown={keyDown}
        style={{ minHeight }}
        className="w-full cursor-text whitespace-pre-wrap break-words rounded-btn border border-smoke bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand-navy [&_u]:underline-offset-2"
      />
      {empty && placeholder && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-2 bottom-2 overflow-hidden whitespace-pre-wrap text-sm leading-relaxed text-pewter/80"
        >
          {placeholder}
        </span>
      )}
    </div>
  );
}
