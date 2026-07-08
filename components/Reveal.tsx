"use client";

import { motion } from "motion/react";

type From = "up" | "down" | "left" | "right" | "zoom";

const OFFSETS: Record<From, Record<string, number>> = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: -32 },
  right: { x: 32 },
  zoom: { scale: 0.96 },
};

export default function Reveal({
  children,
  delay = 0,
  from = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  from?: From;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, ...OFFSETS[from] }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{
        type: "spring",
        stiffness: 80,
        damping: 17,
        mass: 0.9,
        delay: delay / 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
