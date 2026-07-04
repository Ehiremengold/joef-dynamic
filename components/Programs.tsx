import Reveal from "./Reveal";

const programs = [
  {
    title: "Mathematics",
    caption: "Numeracy, algebra & problem solving",
    icon: (
      <path d="M6 6h20M6 16h20M6 26h20M10 2v8M22 12v8M14 22v8" />
    ),
  },
  {
    title: "English & Literature",
    caption: "Reading, writing & confident speech",
    icon: (
      <path d="M4 6c4-2 8-2 12 0v20c-4-2-8-2-12 0V6zm24 0c-4-2-8-2-12 0v20c4-2 8-2 12 0V6z" />
    ),
  },
  {
    title: "Basic Science & Tech",
    caption: "Hands-on experiments & discovery",
    icon: (
      <path d="M13 4h6M14 4v9l-7 12a3 3 0 0 0 3 4h12a3 3 0 0 0 3-4l-7-12V4M10 21h12" />
    ),
  },
  {
    title: "ICT & Coding",
    caption: "Digital literacy for a digital Lagos",
    icon: (
      <path d="M4 7h24v16H4zM4 27h24M12 12l-4 3.5 4 3.5M20 12l4 3.5-4 3.5" />
    ),
  },
  {
    title: "Creative & Cultural Arts",
    caption: "Art, music, drama & heritage",
    icon: (
      <path d="M16 4a12 12 0 1 0 0 24c2 0 3-1.5 2-3-1.2-1.8.2-4 2.5-4H24a4 4 0 0 0 4-4C28 9 22.6 4 16 4zM10 13h.02M16 9h.02M22 13h.02" />
    ),
  },
  {
    title: "Business Studies",
    caption: "Enterprise & everyday economics",
    icon: (
      <path d="M11 9V6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3M4 9h24v18H4zM4 17h24" />
    ),
  },
];

export default function Programs() {
  return (
    <section id="programs" className="bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:py-24">
        <Reveal className="mx-auto max-w-[800px] text-center">
          <h2 className="font-display text-4xl font-extrabold leading-[1.13] tracking-tight md:text-5xl">
            A curriculum that stretches every learner
          </h2>
          <p className="mt-4 text-lg text-graphite">
            Our junior secondary program blends the Nigerian national
            curriculum with clubs, projects and mentoring, so structure and
            play work together.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p, i) => (
            <Reveal key={p.title} delay={(i % 3) * 90}>
            <a
              href="#visit"
              className="group flex cursor-pointer items-center gap-4 rounded-card border border-smoke bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-mist"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-ink"
                aria-hidden="true"
              >
                {p.icon}
              </svg>
              <span className="flex-1">
                <span className="block font-display text-lg font-bold tracking-tight">
                  {p.title}
                </span>
                <span className="block text-[13px] text-graphite">{p.caption}</span>
              </span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                <path d="M7 4l6 6-6 6" />
              </svg>
            </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
