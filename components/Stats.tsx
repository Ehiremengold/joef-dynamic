import Reveal from "./Reveal";

const stats = [
  { value: "K–SS3", label: "Every stage, one school" },
  { value: "2", label: "Curriculum. British & Nigerian, blended" },
  { value: "1:15", label: "Teacher-to-student ratio" },
  { value: "8am", label: "Doors open, Mon–Fri" },
];

export default function Stats() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-10 px-6 py-16 md:grid-cols-4 md:py-20">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className="text-center">
            <p className="font-display text-4xl font-bold tracking-tight text-brand-navy">
              {s.value}
            </p>
            <p className="mx-auto mt-2 max-w-[180px] text-sm text-mid-gray">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
