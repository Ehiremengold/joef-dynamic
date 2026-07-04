import Image from "next/image";
import Reveal from "./Reveal";

export default function About() {
  return (
    <section id="about" className="bg-mist">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <Reveal className="relative mx-auto w-full max-w-[520px]">
          <div className="relative aspect-[4/3] -rotate-2 overflow-hidden rounded-card">
            <Image
              src="/images/student-geometry.jpg"
              alt="A student working carefully with a ruler on graph paper"
              fill
              sizes="(max-width: 768px) 90vw, 520px"
              className="object-cover"
            />
          </div>
          <span className="absolute -bottom-3 left-6 -rotate-3 rounded-btn bg-ink px-2.5 py-1 text-sm font-semibold text-white">
            Precision in practice
          </span>
        </Reveal>

        <Reveal delay={120} className="max-w-[520px]">
          <h2 className="font-display text-4xl font-extrabold leading-[1.13] tracking-tight md:text-5xl">
            Growing steadily, from the very first term
          </h2>
          <p className="mt-6 leading-relaxed text-graphite">
            Joef Dynamic College was built on a simple belief: the middle years
            decide how a child feels about learning for the rest of their
            life. Our classrooms are small enough for every student to be
            known, and structured enough for every student to be stretched.
          </p>
          <p className="mt-4 leading-relaxed text-graphite">
            Every detail, from our daily routines to our termly parent
            reviews, is designed to help students build discipline, character
            and genuine curiosity.
          </p>
          <dl className="mt-8 space-y-5 border-l-2 border-ink pl-6">
            <div>
              <dt className="font-display text-lg font-bold tracking-tight">Our mission</dt>
              <dd className="mt-1 text-graphite">
                To raise disciplined, confident learners prepared for senior
                secondary school and beyond.
              </dd>
            </div>
            <div>
              <dt className="font-display text-lg font-bold tracking-tight">Our vision</dt>
              <dd className="mt-1 text-graphite">
                A community where every child in Ikoyi has access to quality,
                character-first education.
              </dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
