import Reveal from "./Reveal";
import WordReveal from "./fx/WordReveal";

export default function CtaBand() {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-6 py-24 text-center md:py-32">
        <Reveal>
          <p className="text-sm font-semibold text-brand-red">
            Admissions open · 2026/2027
          </p>
        </Reveal>
        <WordReveal
          text="Ready to give your child the solid foundation?"
          className="mx-auto mt-4 max-w-[760px] font-display text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-brand-navy md:text-6xl"
        />
        <Reveal delay={220}>
          <p className="mx-auto mt-6 max-w-[480px] text-[17px] leading-relaxed text-mid-gray">
            Spots fill up fast. Book a tour, meet our teachers, and join the JDC
            family.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/#visit"
              className="rounded-full bg-brand-red px-7 py-3.5 text-[17px] font-medium text-white transition-colors duration-200 hover:bg-brand-red-dark"
            >
              Book a school tour
            </a>
            <a
              href="tel:+2348034035705"
              className="rounded-full border border-ink px-7 py-3.5 text-[17px] font-medium text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
            >
              Call 0803 403 5705
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
