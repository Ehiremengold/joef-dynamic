"use client";

import Image from "next/image";
import { motion } from "motion/react";
import WordReveal from "./fx/WordReveal";

const partners = [
  {
    src: "/images/partners/cambridge.png",
    alt: "Cambridge International Education",
    w: 680,
    h: 380,
  },
  {
    src: "/images/partners/british-council.png",
    alt: "British Council",
    w: 760,
    h: 330,
  },
  {
    src: "/images/partners/british-dyslexia.png",
    alt: "British Dyslexia Association",
    w: 640,
    h: 430,
  },
];

export default function Partners() {
  return (
    <section id="partners" className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
        <WordReveal
          text="Partners"
          className="text-center font-display text-3xl font-bold tracking-[-0.015em] text-brand-navy md:text-4xl"
        />

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-14 gap-y-10 md:mt-14 md:gap-x-24">
          {partners.map((p, i) => (
            <motion.div
              key={p.src}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              transition={{
                type: "spring",
                stiffness: 90,
                damping: 16,
                delay: i * 0.12,
              }}
              whileHover={{ scale: 1.05 }}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                sizes="(max-width: 768px) 40vw, 220px"
                className="h-12 w-auto object-contain md:h-16"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
