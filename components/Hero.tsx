"use client";

import Image from "next/image";
import { motion } from "motion/react";
import HeroShot from "./fx/HeroShot";

const WORDS = ["Raising", "dynamic", "minds."];

export default function Hero() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-20 md:pt-28">
        <div className="mx-auto max-w-[880px] text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm font-semibold text-brand-red"
          >
            Admissions open · 2026/2027 · Kindergarten to SS3
          </motion.p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-[-0.02em] text-brand-navy md:text-7xl lg:text-[80px]">
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
            className="mx-auto mt-6 max-w-[620px] text-lg leading-relaxed text-mid-gray md:text-xl"
          >
            A blended British and Nigerian education in the heart of Ikoyi —
            where every child is known by name, grounded in good morals, and
            prepared for tomorrow with coding, robotics and music.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              href="/#visit"
              className="rounded-full bg-brand-red px-7 py-3.5 text-[17px] font-medium text-white transition-colors duration-200 hover:bg-brand-red-dark"
            >
              Book a school tour
            </motion.a>
            <a
              href="/#programs"
              className="text-[17px] font-medium text-brand-red transition-opacity duration-200 hover:underline"
            >
              Explore our curriculum ›
            </a>
          </motion.div>
        </div>

        <HeroShot className="mx-auto mt-16 max-w-[1000px]">
          <div className="relative aspect-[16/9] overflow-hidden rounded-card">
            <Image
              src="/images/students-drawing.jpg"
              alt="Joef Dynamic students drawing together in class"
              fill
              sizes="(max-width: 1024px) 100vw, 1000px"
              className="object-cover"
              priority
            />
          </div>
        </HeroShot>
      </div>
    </section>
  );
}
