import Image from "next/image";

function Sticker({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`absolute rounded-btn bg-ink px-2.5 py-1 text-sm font-semibold text-white ${className}`}
    >
      {children}
    </span>
  );
}

export default function Hero() {
  return (
    <section className="bg-brand-pink">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        {/* Copy */}
        <div className="max-w-[560px]">
          <span className="animate-rise inline-block rounded-btn bg-signal-yellow px-2.5 py-1 text-sm font-semibold text-ink">
            Middle school · Ikoyi, Lagos
          </span>
          <h1
            className="animate-rise mt-6 font-display text-5xl font-extrabold leading-[1.06] tracking-tight md:text-[64px]"
            style={{ animationDelay: "80ms" }}
          >
            Bright futures are built in the middle years.
          </h1>
          <p className="animate-rise mt-6 text-lg leading-relaxed" style={{ animationDelay: "160ms" }}>
            At Joef Dynamic College, students aged 10–15 grow into confident,
            curious learners, guided by dedicated educators in a safe,
            structured campus at the heart of Ikoyi.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <a
              href="#visit"
              className="inline-flex items-center gap-2 rounded-btn bg-ink px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-[#2a2935]"
            >
              Book a school tour
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 8h12M9 3l5 5-5 5" />
              </svg>
            </a>
            <a
              href="#programs"
              className="inline-flex items-center rounded-btn border border-ink px-6 py-3.5 font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white"
            >
              Explore programs
            </a>
          </div>
        </div>

        {/* Photo collage */}
        <div
          className="animate-rise relative mx-auto h-[380px] w-full max-w-[480px] md:h-[460px]"
          style={{ animationDelay: "200ms" }}
        >
          <div className="absolute left-0 top-4 w-[62%] -rotate-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-btn">
              <Image
                src="/images/student-pencil.jpg"
                alt="A Joef Dynamic student holding up a pencil"
                fill
                sizes="(max-width: 768px) 60vw, 300px"
                className="object-cover"
                priority
              />
            </div>
            <Sticker className="-bottom-3 left-4 -rotate-3">Adaeze · JSS 2</Sticker>
          </div>
          <div className="absolute bottom-0 right-0 w-[58%] rotate-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-btn">
              <Image
                src="/images/student-writing.jpg"
                alt="A student focused on his classwork"
                fill
                sizes="(max-width: 768px) 55vw, 280px"
                className="object-cover"
                priority
              />
            </div>
            <Sticker className="-top-3 right-4 rotate-2">Tobi · JSS 3</Sticker>
          </div>
        </div>
      </div>
    </section>
  );
}
