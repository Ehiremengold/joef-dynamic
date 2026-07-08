import Image from "next/image";
import Reveal from "./Reveal";
import Parallax from "./fx/Parallax";
import WordReveal from "./fx/WordReveal";

export default function About() {
  return (
    <section id="about" className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <Reveal from="left" className="mx-auto w-full max-w-[560px]">
            <Parallax amount={28}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                <Image
                  src="/images/classroom-teacher.jpg"
                  alt="A teacher guiding students around a classroom table"
                  fill
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </Parallax>
          </Reveal>

          <div className="max-w-[480px]">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-red">
                Motto: The Solid Foundation
              </p>
            </Reveal>
            <WordReveal
              text="An institution raising a generation with good moral standards."
              className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
            />
            <Reveal delay={180}>
              <p className="mt-6 text-[17px] leading-relaxed text-graphite">
                Joef Dynamic School was built on a simple belief: the school years
                decide how a child feels about learning and who they become
                for the rest of their life. Our classrooms are small enough for
                every student to be known, and structured enough for every
                student to be stretched.
              </p>
              <p className="mt-4 text-[17px] leading-relaxed text-graphite">
                In a serene corner of Ikoyi, we pair serious academics with
                serious care: qualified teachers, a calm campus, and values
                that follow our students home.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
