import { toRuns } from "@/lib/richText";

/** Question or option text with its bold, underline and italic (see lib/richText). */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {toRuns(text).map((r, i) => {
        let node: React.ReactNode = r.text;
        if (r.i) node = <em>{node}</em>;
        if (r.u) node = <u className="underline decoration-2 underline-offset-2">{node}</u>;
        if (r.b) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
