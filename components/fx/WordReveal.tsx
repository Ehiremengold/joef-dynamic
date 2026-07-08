"use client";

import { motion } from "motion/react";

const TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
} as const;

/**
 * Masked word-by-word reveal for headings — each word rises out of an
 * invisible clip as the heading scrolls into view.
 *
 * The viewport observer lives on the (un-clipped) heading element and the
 * words animate via variant propagation: a word span inside overflow-hidden
 * is fully clipped, so IntersectionObserver would never fire on it directly.
 */
export default function WordReveal({
  text,
  className = "",
  as = "h2",
}: {
  text: string;
  className?: string;
  as?: keyof typeof TAGS;
}) {
  const MotionTag = TAGS[as];
  const words = text.split(" ");

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span
            key={i}
            className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <motion.span
              className="inline-block"
              variants={{
                hidden: { y: "115%" },
                visible: {
                  y: 0,
                  transition: {
                    duration: 0.65,
                    delay: i * 0.055,
                    ease: [0.22, 1, 0.36, 1],
                  },
                },
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </span>
    </MotionTag>
  );
}
