import Image from "next/image";
import Reveal from "./Reveal";
import Parallax from "./fx/Parallax";
import WordReveal from "./fx/WordReveal";

const highlights = [
  {
    title: "Blended British & Nigerian curricula",
    text: "International breadth and depth, anchored in the national curriculum your child will be examined on. The best of both worlds, in one timetable.",
  },
  {
    title: "Coding & robotics expertise",
    text: "Not a once-a-term novelty — real programming and robotics taught by specialists, from primary through senior college.",
  },
  {
    title: "Computer-based teaching",
    text: "Lessons delivered the way modern exams and workplaces actually run, so nothing about a screen ever intimidates your child.",
  },
  {
    title: "Music, sport & the arts",
    text: "Music lessons, sporting activities and creative arts on the timetable for every child — because confidence is built outside the classroom too.",
  },
];

export default function Programs() {
  return (
    <section id="programs" className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <div className="max-w-[480px]">
            <WordReveal
              text="A curriculum with the best of both worlds."
              className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
            />
            <Reveal delay={180}>
            <p className="mt-6 text-[17px] leading-relaxed text-graphite">
              Most schools make you choose: international polish or national
              exam readiness. Joef Dynamic blends the British and Nigerian
              curricula so your child gets both — global thinking, local
              excellence.
            </p>
            <a
              href="/#visit"
              className="mt-8 inline-block text-[17px] font-medium text-brand-red hover:underline"
            >
              See it in action on a tour ›
            </a>
            </Reveal>
          </div>

          <Reveal delay={120} from="right" className="mx-auto w-full max-w-[560px]">
            <Parallax amount={28}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                <Image
                  src="/images/student-geometry.jpg"
                  alt="A student working carefully with a ruler on graph paper"
                  fill
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </Parallax>
          </Reveal>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h, i) => (
            <Reveal key={h.title} delay={i * 100}>
              <div className="h-full rounded-card bg-canvas p-8">
                <h3 className="font-display text-[17px] font-semibold leading-snug text-ink">
                  {h.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-mid-gray">
                  {h.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
