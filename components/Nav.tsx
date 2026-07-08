"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ScrollProgress from "./fx/ScrollProgress";

const links = [
  { label: "Stages", href: "/#stages" },
  { label: "Curriculum", href: "/#programs" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Partners", href: "/#partners" },
  { label: "Visit", href: "/#visit" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/90 backdrop-blur-xl">
      <ScrollProgress />
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/logo.png"
            alt="Joef Dynamic College crest"
            width={34}
            height={34}
            className="h-[34px] w-[34px] object-contain"
          />
          <span className="font-display text-[17px] font-semibold tracking-tight text-brand-navy">
            Joef Dynamic College
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-graphite transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/#visit"
            className="hidden rounded-full bg-brand-red px-4 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-red-dark sm:inline-block"
          >
            Enrol now
          </a>
          <button
            type="button"
            className="cursor-pointer p-2 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {/* Animated hamburger — two bars rotate into an X */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <motion.path
                d="M4 8h16"
                animate={open ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: "50%", originY: "50%" }}
              />
              <motion.path
                d="M4 16h16"
                animate={open ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: "50%", originY: "50%" }}
              />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-hairline bg-white md:hidden"
            aria-label="Mobile"
          >
            <ul className="flex flex-col gap-1 px-6 py-4">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: 0.05 + i * 0.045,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link
                    href={l.href}
                    className="block rounded-btn px-2 py-3 text-base font-medium hover:bg-canvas"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                </motion.li>
              ))}
              <motion.li
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.28,
                  delay: 0.05 + links.length * 0.045,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <a
                  href="/#visit"
                  className="mt-2 block rounded-full bg-brand-red px-4 py-3 text-center text-base font-medium text-white"
                  onClick={() => setOpen(false)}
                >
                  Enrol now
                </a>
              </motion.li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
