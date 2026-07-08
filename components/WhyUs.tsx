import Reveal from "./Reveal";
import WordReveal from "./fx/WordReveal";

const features = [
  {
    title: "Competent, qualified teachers",
    text: "Every educator is vetted, certified and continually trained and invested in your child by name.",
    icon: (
      <path d="M16 4l12 6-12 6L4 10l12-6zM8 13v7c0 2 4 4 8 4s8-2 8-4v-7M28 10v8" />
    ),
  },
  {
    title: "Serene learning environment",
    text: "A calm, gated campus on a quiet Ikoyi street space to think, play and grow safely.",
    icon: (
      <path d="M16 3l11 4v8c0 7-4.5 12-11 14C9.5 27 5 22 5 15V7l11-4zM11 16l3.5 3.5L21 13" />
    ),
  },
  {
    title: "Coding & robotics expertise",
    text: "Specialist-led programming and robotics on the timetable, from primary upward.",
    icon: <path d="M4 7h24v16H4zM4 27h24M12 12l-4 3.5 4 3.5M20 12l4 3.5-4 3.5" />,
  },
  {
    title: "Computer-based teaching",
    text: "Modern, screen-fluent lessons that mirror how today's exams and workplaces run.",
    icon: <path d="M6 5h20v14H6zM2 23h28M13 27h6" />,
  },
  {
    title: "Music lessons",
    text: "Instruments, rhythm and performance for every age, confidence you can hear.",
    icon: (
      <path d="M12 25a4 4 0 1 1-4-4c1.5 0 3 .7 4 1.8V6l16-3v17a4 4 0 1 1-4-4c1.5 0 3 .7 4 1.8" />
    ),
  },
  {
    title: "Sporting activities",
    text: "Inter-house sports, athletics and team games that build healthy, resilient children.",
    icon: (
      <path d="M16 28a12 12 0 1 0 0-24 12 12 0 0 0 0 24zM4.5 12h23M4.5 20h23M16 4c-4 6-4 18 0 24M16 4c4 6 4 18 0 24" />
    ),
  },
  {
    title: "Moral upbringing programmes",
    text: "Character, discipline and respect woven deliberately into everyday school life.",
    icon: (
      <path d="M16 27S5 20 5 12.5C5 8.9 7.9 6 11.5 6c1.8 0 3.5.8 4.5 2.2C17 6.8 18.7 6 20.5 6 24.1 6 27 8.9 27 12.5 27 20 16 27 16 27z" />
    ),
  },
  {
    title: "Parents in the loop",
    text: "Termly reviews, open days and a direct line to your child's teachers.",
    icon: <path d="M4 7h24v15H15l-6 5v-5H4V7zM9 12h14M9 17h9" />,
  },
];

export default function WhyUs() {
  return (
    <section id="why-us" className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[640px] text-center">
          <WordReveal
            text="What distinguishes us from others."
            className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
          />
          <Reveal delay={180}>
            <p className="mt-5 text-[17px] leading-relaxed text-mid-gray">
              The things parents tell us made the difference.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 100}>
              <div className="h-full rounded-card bg-canvas p-8">
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-brand-navy"
                  aria-hidden="true"
                >
                  {f.icon}
                </svg>
                <h3 className="mt-5 font-display text-[17px] font-semibold text-ink">
                  {f.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-mid-gray">
                  {f.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
