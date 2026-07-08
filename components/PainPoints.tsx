import Reveal from "./Reveal";
import WordReveal from "./fx/WordReveal";

const worries = [
  {
    question: "Will my child be more than a number?",
    answer:
      "With one teacher to every fifteen students, every child here is known by name, their strengths, their struggles, their spark. Termly reviews keep you in the picture.",
  },
  {
    question: "Will they be safe every day?",
    answer:
      "A gated, serene campus on a quiet Ikoyi street, with supervised arrivals and departures. You drop them off knowing exactly who is watching over them.",
  },
  {
    question: "Will they be ready for a digital future?",
    answer:
      "Computer-based teaching runs through every class, and coding & robotics are on the timetable, not an afterthought. Your child graduates fluent in the tools of tomorrow.",
  },
  {
    question: "Will they grow up grounded?",
    answer:
      "Moral upbringing programmes are woven into daily school life. We raise children who are as respectful and disciplined as they are ambitious.",
  },
];

export default function PainPoints() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[680px] text-center">
          <WordReveal
            text="The questions every parent asks."
            className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
          />
          <Reveal delay={200}>
            <p className="mt-5 text-[17px] leading-relaxed text-mid-gray">
              Choosing a school is a big decision. We built Joef Dynamic around
              the answers.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {worries.map((w, i) => (
            <Reveal
              key={w.question}
              delay={(i % 2) * 120}
              from={i % 2 === 0 ? "left" : "right"}
            >
              <div className="h-full rounded-card bg-canvas p-8 md:p-10">
                <h3 className="font-display text-[24px] font-semibold leading-snug text-ink">
                  &ldquo;{w.question}&rdquo;
                </h3>
                <p className="mt-4 text-[17px] leading-relaxed text-graphite">
                  {w.answer}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
