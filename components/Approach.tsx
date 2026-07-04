import Image from "next/image";
import Reveal from "./Reveal";

export default function Approach() {
  return (
    <section className="bg-brand-pink">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <Reveal className="max-w-[520px]">
          <span className="inline-block rounded-btn bg-ink px-2.5 py-1 text-sm font-semibold text-white">
            Our approach
          </span>
          <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.13] tracking-tight md:text-5xl">
            Structure and play, working together
          </h2>
          <p className="mt-6 leading-relaxed">
            Mornings are for focused academics. Afternoons open up into clubs,
            sport and creative work. The rhythm is deliberate, children learn
            best when effort and joy take turns.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Child-first teaching that meets every learner where they are",
              "Hands-on discovery across science, tech and the arts",
              "Character and leadership woven into every school day",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M3 10.5L8 15l9-10" />
                </svg>
                <span className="font-semibold">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="relative mx-auto w-full max-w-[520px]">
          <div className="relative aspect-[4/3] rotate-2 overflow-hidden rounded-btn">
            <Image
              src="/images/students-drawing.jpg"
              alt="Students sprawled out drawing together"
              fill
              sizes="(max-width: 768px) 90vw, 520px"
              className="object-cover"
            />
          </div>
          <span className="absolute -top-3 right-8 rotate-3 rounded-btn bg-ink px-2.5 py-1 text-sm font-semibold text-white">
            Creative hour
          </span>
        </Reveal>
      </div>
    </section>
  );
}
