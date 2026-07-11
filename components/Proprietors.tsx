import Image from "next/image";
import Reveal from "./Reveal";

type Leader = {
  name: string;
  role: string;
  src: string;
  alt: string;
  quote: string;
};

const LEADERS: Leader[] = [
  {
    name: "Sir Joseph Agbebaku",
    role: "Proprietor, JOEF Dynamic Schools",
    src: "/images/proprietors/proprietor.jpg",
    alt: "Portrait of the Proprietor and Founder of Joef Dynamic College",
    quote:
      "We built this school around a single conviction: that every child, given the right foundation, can rise to become dynamic, principled and prepared for the world ahead.",
  },
  {
    name: "Mrs Marian E. Agbebaku",
    role: "Proprietress, JOEF Nursery & Primary School",
    src: "/images/proprietors/directress.jpg",
    alt: "Portrait of the Directress of Joef Dynamic College",
    quote:
      "Here, no child is a face in the crowd. We know them by name, nurture their gifts, and hold them to standards that follow them long after they leave our gates.",
  },
];

export default function Proprietors() {
  return (
    <section id="leadership" className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <Reveal className="mx-auto max-w-[640px] text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-red">
            Our Leadership
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl">
            The hearts behind the school
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-graphite">
            Joef Dynamic College is guided by educators who treat every child as
            their own, setting the tone, the values and the ambition for all
            that happens on campus.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 md:mt-20 md:grid-cols-2 md:gap-8">
          {LEADERS.map((leader, i) => (
            <Reveal
              key={leader.name}
              from={i === 0 ? "left" : "right"}
              delay={i * 120}
            >
              <figure className="group relative overflow-hidden rounded-card bg-paper shadow-[0_24px_48px_rgba(35,45,94,0.10)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={leader.src}
                    alt={leader.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 580px"
                    className="object-cover object-top transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />
                </div>
                <figcaption className="p-7 md:p-9">
                  <blockquote className="font-display text-xl leading-snug tracking-[-0.01em] text-brand-navy md:text-2xl">
                    “{leader.quote}”
                  </blockquote>
                  <div className="mt-6 flex items-center gap-3">
                    <span
                      className="h-8 w-1 rounded-full bg-brand-red"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-brand-navy">
                        {leader.name}
                      </p>
                      <p className="text-sm text-pewter">{leader.role}</p>
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
