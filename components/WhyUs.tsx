import Reveal from "./Reveal";

const features = [
  {
    title: "Certified educators",
    text: "Every teacher is qualified, vetted and continually trained — and deeply invested in your child's growth.",
    icon: (
      <path d="M16 4l12 6-12 6L4 10l12-6zM8 13v7c0 2 4 4 8 4s8-2 8-4v-7M28 10v8" />
    ),
  },
  {
    title: "Safe, secure campus",
    text: "A gated campus on Eleshin Street with supervised arrivals and departures, every single day.",
    icon: (
      <path d="M16 3l11 4v8c0 7-4.5 12-11 14C9.5 27 5 22 5 15V7l11-4zM11 16l3.5 3.5L21 13" />
    ),
  },
  {
    title: "Small class sizes",
    text: "With one teacher to every fifteen students, no child gets lost in the crowd.",
    icon: (
      <path d="M11 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 27c0-4.4 3.6-8 8-8s8 3.6 8 8M22 13a4 4 0 1 0-1-7.9M21 19c4 .5 7 3.9 7 8" />
    ),
  },
  {
    title: "Parents in the loop",
    text: "Termly reviews, open days and direct lines to teachers keep you part of the journey.",
    icon: (
      <path d="M4 7h24v15H15l-6 5v-5H4V7zM9 12h14M9 17h9" />
    ),
  },
];

export default function WhyUs() {
  return (
    <section id="why-us" className="bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <Reveal className="mx-auto max-w-[800px] text-center">
          <h2 className="font-display text-4xl font-extrabold leading-[1.13] tracking-tight md:text-5xl">
            Why parents choose Joef Dynamic
          </h2>
          <p className="mt-4 text-lg text-graphite">
            We know children thrive when they feel safe, seen and challenged.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 90} className="rounded-card border border-smoke bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-ink"
                aria-hidden="true"
              >
                {f.icon}
              </svg>
              <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{f.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
