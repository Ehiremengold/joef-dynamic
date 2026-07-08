"use client";

import { motion, useScroll, useSpring } from "motion/react";

/** Thin brand-red reading-progress bar pinned under the sticky nav. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.3,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="absolute inset-x-0 bottom-0 h-[2.5px] origin-left bg-brand-red"
    />
  );
}
