"use client";

import Image from "next/image";
import { motion } from "motion/react";

const WORDS = ["Raising", "dynamic", "minds."];
const spring = { type: "spring", stiffness: 90, damping: 14 } as const;

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 pb-16 pt-10 md:grid-cols-[1.05fr_1fr] md:gap-6 md:pb-20 md:pt-14">
        {/* ---- Copy ---- */}
        <div className="relative z-10 max-w-[560px]">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm font-semibold text-brand-red"
          >
            Admissions open · 2026/2027 · Kindergarten to SS3
          </motion.p>

          <h1 className="mt-4 font-display text-[52px] font-bold leading-[1.02] tracking-[-0.025em] text-brand-navy md:text-[68px] lg:text-[80px]">
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
            className="mt-6 max-w-[480px] text-lg leading-relaxed text-graphite"
          >
            School is meant to be loved, not endured. A blended British and
            Nigerian education in Ikoyi, where every child is known by name
            and prepared for tomorrow with coding, robotics and music.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center gap-5"
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
          </motion.div>

          {/* hand-drawn arrow pointing from the copy toward the kids */}
          <motion.svg
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            viewBox="0 0 120 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="absolute -left-2 top-[38%] hidden h-16 w-20 -scale-x-100 text-brand-red/70 lg:block"
            aria-hidden="true"
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: 1.15, ease: "easeOut" }}
              d="M14 8c38 6 64 28 70 66M74 62l10 13 14-9"
            />
          </motion.svg>
        </div>

        {/* ---- Stage: blob + kids + accents ---- */}
        <div className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[500px] md:h-[560px]">
          {/* gold blob */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: 0.25 }}
            className="animate-blob absolute left-[6%] top-[12%] h-[78%] w-[88%] bg-brand-gold"
          />
          {/* navy circle accent */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: 0.5 }}
            className="absolute left-0 top-[8%] h-24 w-24 rounded-full bg-brand-navy sm:h-28 sm:w-28"
          />
          {/* red squircle accent */}
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -20 }}
            animate={{ opacity: 1, scale: 1, rotate: -8 }}
            transition={{ ...spring, delay: 0.62 }}
            className="absolute bottom-[6%] left-[2%] h-20 w-20 rounded-[28px] bg-brand-red/90 sm:h-24 sm:w-24"
          />
          {/* green dot */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring, delay: 0.75 }}
            className="absolute right-[4%] top-[6%] h-5 w-5 rounded-full bg-brand-green"
          />
          {/* navy scribble spiral */}
          <motion.svg
            initial={{ opacity: 0, rotate: -30 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.9 }}
            viewBox="0 0 80 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="absolute right-[10%] top-[14%] h-12 w-12 text-brand-navy/80"
            aria-hidden="true"
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.95, ease: "easeOut" }}
              d="M62 34c-4-12-18-18-30-12S14 42 22 52s26 8 32-2 0-24-12-26-24 8-22 20"
            />
          </motion.svg>

          {/* the kids */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...spring, delay: 0.4 }}
            className="absolute inset-x-0 bottom-0 z-10"
          >
            <div className="animate-floaty">
              <Image
                src="/images/hero-kids.png"
                alt="Three excited Joef Dynamic students in uniform jumping for joy with their school bags"
                width={1536}
                height={2048}
                priority
                sizes="(max-width: 768px) 90vw, 520px"
                className="mx-auto h-auto w-[88%] drop-shadow-[0_24px_36px_rgba(27,33,72,0.18)]"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
