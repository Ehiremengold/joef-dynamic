"use client";

import Image from "next/image";
import { motion } from "motion/react";

const WORDS = ["Raising", "dynamic", "minds."];
const spring = { type: "spring", stiffness: 90, damping: 14 } as const;

type Slide =
  | { kind: "image"; src: string; alt: string; w: string }
  | { kind: "video"; src: string; poster: string; w: string };

/* Width classes vary so the strip reads like a real film reel,
   not a uniform grid. The video sits mid-strip so it's on screen
   at first paint. */
const SLIDES: Slide[] = [
  {
    kind: "image",
    src: "/images/hero/hero-01.jpg",
    alt: "Students in colourful sports uniforms presenting their environmental art posters",
    w: "w-[300px] md:w-[360px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-05.jpg",
    alt: "A student working at a computer in the ICT lab",
    w: "w-[280px] md:w-[340px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-07.jpg",
    alt: "Life at Joef Dynamic College",
    w: "w-[320px] md:w-[400px]",
  },
  {
    kind: "video",
    src: "/images/hero/hero-video.mp4",
    poster: "/images/hero/hero-video-poster.jpg",
    w: "w-[340px] md:w-[440px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-10.jpg",
    alt: "Joef Dynamic College students receiving 2nd position at the RoboCode Champions quiz",
    w: "w-[320px] md:w-[400px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-03.jpg",
    alt: "Students learning together in class",
    w: "w-[280px] md:w-[340px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-12.jpg",
    alt: "A school-wide gathering at Joef Dynamic College",
    w: "w-[340px] md:w-[430px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-08.jpg",
    alt: "Students during an activity at school",
    w: "w-[300px] md:w-[370px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-11.jpg",
    alt: "Joef Dynamic students celebrating together",
    w: "w-[290px] md:w-[350px]",
  },
  {
    kind: "image",
    src: "/images/hero/hero-04.jpg",
    alt: "Hands-on learning at Joef Dynamic College",
    w: "w-[280px] md:w-[340px]",
  },
];

/* Slight alternating tilt, echoing the crest's playful energy */
const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2, 1.5, -1, 2];

function MediaCard({
  slide,
  index,
  priority = false,
}: {
  slide: Slide;
  index: number;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative mr-5 h-56 shrink-0 overflow-hidden rounded-[22px] bg-cool-wash shadow-[0_18px_32px_rgba(35,45,94,0.16)] md:h-72 ${slide.w}`}
      style={{ transform: `rotate(${TILTS[index % TILTS.length]}deg)` }}
    >
      {slide.kind === "video" ? (
        <video
          src={slide.src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={slide.poster}
          className="h-full w-full object-cover"
          aria-label="A short film about life at Joef Dynamic College"
        />
      ) : (
        <Image
          src={slide.src}
          alt={slide.alt}
          fill
          sizes="(max-width: 768px) 60vw, 440px"
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="object-cover"
        />
      )}
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper pb-16 pt-10 md:pb-20 md:pt-14">
      {/* ---- Copy ---- */}
      <div className="mx-auto max-w-[860px] px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block rounded-full bg-brand-gold px-5 py-2 text-xs font-semibold text-brand-navy"
        >
          Admissions open · 2026/2027 · Kindergarten to SS3
        </motion.p>

        <h1 className="mt-6 font-display text-[35px] font-bold leading-[1.02] tracking-[-0.025em] text-brand-navy md:text-[72px] lg:text-[84px]">
          {WORDS.map((w, i) => (
            <span
              key={i}
              className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom"
            >
              <motion.span
                className="inline-block"
                initial={{ y: "115%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.15 + i * 0.09,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {w}
                {i < WORDS.length - 1 ? " " : ""}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-[560px] text-lg leading-relaxed text-graphite"
        >
          School is meant to be loved, not endured. A blended British and
          Nigerian education in Ikoyi, where every child is known by name and
          prepared for tomorrow with coding, robotics and music.
        </motion.p>
      </div>

      {/* ---- Moving media strip ---- */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="group relative mt-12 md:mt-14"
      >
        <div className="overflow-hidden py-4">
          <div className="animate-hero-marquee flex w-max group-hover:[animation-play-state:paused]">
            {SLIDES.map((slide, i) => (
              // eager-load only the first few cards that are on screen at load
              <MediaCard key={`a-${i}`} slide={slide} index={i} priority={i < 4} />
            ))}
            {/* duplicate pass for the seamless loop */}
            <div aria-hidden="true" className="contents">
              {SLIDES.map((slide, i) => (
                <MediaCard key={`b-${i}`} slide={slide} index={i} />
              ))}
            </div>
          </div>
        </div>
        {/* edge fades so cards emerge from the page, not a hard border */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-paper to-transparent md:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-paper to-transparent md:w-28" />
      </motion.div>

      {/* ---- CTA ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto mt-10 flex w-fit flex-wrap items-center justify-center gap-5 px-6 md:mt-12"
      >
        <motion.a
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          transition={spring}
          href="/#visit"
          className="rounded-full bg-brand-red px-7 py-3.5 text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-brand-red-dark"
        >
          Book a school tour
        </motion.a>
        <a
          href="/#programs"
          className="text-[17px] font-medium text-brand-navy underline-offset-4 transition-colors duration-200 hover:text-brand-red hover:underline"
        >
          Explore our curriculum ›
        </a>

        {/* hand-drawn arrow nudging toward the CTA */}
        <motion.svg
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          viewBox="0 0 120 90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="absolute -left-24 top-1/2 hidden h-14 w-[72px] -translate-y-1/2 text-brand-red/70 lg:block"
          aria-hidden="true"
        >
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 1.15, ease: "easeOut" }}
            d="M10 20c30-10 70 5 92 34M92 44l12 12 14-12"
          />
        </motion.svg>
      </motion.div>
    </section>
  );
}
