import Image from "next/image";
import Reveal from "./Reveal";

const details = [
  {
    label: "Address",
    value: "65 Eleshin Street, Ikoyi, Lagos 106104",
    href: "https://maps.google.com/?q=Joef+Dynamic+College,+65+Eleshin+St,+Ikoyi,+Lagos",
  },
  { label: "Phone", value: "0803 403 5705", href: "tel:+2348034035705" },
  { label: "Hours", value: "Monday – Friday, 8:00 am – 4:00 pm" },
];

export default function Visit() {
  return (
    <section id="visit" className="bg-mist">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal delay={120} className="relative order-2 mx-auto w-full max-w-[520px] md:order-1">
            <div className="relative aspect-[4/3] -rotate-2 overflow-hidden rounded-card">
              <Image
                src="/images/classroom-teacher.jpg"
                alt="A teacher guiding students around a classroom table"
                fill
                sizes="(max-width: 768px) 90vw, 520px"
                className="object-cover"
              />
            </div>
            <span className="absolute -bottom-3 right-8 rotate-2 rounded-btn bg-ink px-2.5 py-1 text-sm font-semibold text-white">
              Come see a class in session
            </span>
          </Reveal>

          <Reveal className="order-1 max-w-[520px] md:order-2">
            <h2 className="font-display text-4xl font-extrabold leading-[1.13] tracking-tight md:text-5xl">
              Schedule a visit and see the joy of learning in action
            </h2>
            <p className="mt-6 leading-relaxed text-graphite">
              The best way to know if Joef Dynamic is right for your family is
              to walk our halls. Call us or stop by, we would love to show you
              around.
            </p>

            <dl className="mt-8 space-y-4">
              {details.map((d) => (
                <div key={d.label} className="flex gap-4">
                  <dt className="w-20 shrink-0 text-sm font-semibold uppercase tracking-wide text-pewter">
                    {d.label}
                  </dt>
                  <dd className="font-semibold">
                    {d.href ? (
                      <a
                        href={d.href}
                        className="underline decoration-smoke underline-offset-4 transition-colors duration-200 hover:decoration-ink"
                        {...(d.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <a
              href="tel:+2348034035705"
              className="mt-8 inline-flex items-center gap-2 rounded-btn bg-ink px-6 py-3.5 font-semibold text-white transition-colors duration-200 hover:bg-[#2a2935]"
            >
              Call to book a tour
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 8h12M9 3l5 5-5 5" />
              </svg>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
