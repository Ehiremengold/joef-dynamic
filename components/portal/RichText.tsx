import { nestMarks, toRuns, type Mark } from "@/lib/richText";

const ELEMENT: Record<Mark, (inner: React.ReactNode) => React.ReactNode> = {
  b: (inner) => <strong>{inner}</strong>,
  u: (inner) => <u className="underline decoration-2 underline-offset-2">{inner}</u>,
  i: (inner) => <em>{inner}</em>,
  sup: (inner) => <sup>{inner}</sup>,
  sub: (inner) => <sub>{inner}</sub>,
};

/** Question or option text with its bold, underline, italic, superscript and subscript (see lib/richText). */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {toRuns(text).map((r, i) => (
        <span key={i}>{nestMarks<React.ReactNode>(r, (mark, inner) => ELEMENT[mark](inner), r.text)}</span>
      ))}
    </>
  );
}
