import Reveal from "./Reveal";
import WordReveal from "./fx/WordReveal";

const stages = [
  {
    name: "Kindergarten & Nursery",
    ages: "Ages 2–5",
    text: "Warm, playful early years where curiosity is protected and the first habits of learning take root.",
  },
  {
    name: "Primary School",
    ages: "Ages 5–10",
    text: "Strong literacy and numeracy foundations, with music, sport and computer lessons from the very start.",
  },
  {
    name: "Junior College",
    ages: "JSS 1–3",
    text: "The blended British and Nigerian curricula in full stride; academics, clubs and character, structured for BECE success.",
  },
  {
    name: "Senior College",
    ages: "SS 1–3",
    text: "Focused preparation for WASSCE and beyond, with mentoring that turns teenagers into confident young adults.",
  },
];

export default function Stages() {
  return (
    <section id="stages" className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="max-w-[640px]">
          <WordReveal
            text="One school. Every stage."
            className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
          />
          <Reveal delay={180}>
            <p className="mt-5 text-[17px] leading-relaxed text-mid-gray">
              From a child&rsquo;s first day of kindergarten to their final
              WASSCE paper, they grow inside one community that knows them,
              no stressful school changes, no starting over.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <Reveal key={s.name} delay={i * 100}>
              <div className="flex h-full flex-col rounded-card bg-white p-8">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-red">
                  {s.ages}
                </p>
                <h3 className="mt-3 font-display text-[21px] font-semibold leading-snug text-ink">
                  {s.name}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-mid-gray">
                  {s.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
