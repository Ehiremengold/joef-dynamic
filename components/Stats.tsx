import Reveal from "./Reveal";

const stats = [
  { value: "10–15", label: "Ages we teach" },
  { value: "1:15", label: "Teacher-to-student ratio" },
  { value: "15+", label: "Subjects & clubs" },
  { value: "8am", label: "Doors open, Mon–Fri" },
];

export default function Stats() {
  return (
    <section className="border-b border-smoke bg-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="text-center md:text-left">
            <p className="font-display text-3xl font-extrabold tracking-tight">{s.value}</p>
            <p className="mt-1 text-[13px] text-graphite">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
