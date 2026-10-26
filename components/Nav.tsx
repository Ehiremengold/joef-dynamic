"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ScrollProgress from "./fx/ScrollProgress";
import { PAGE_WIDTH } from "./pageWidth";

const links = [
  { label: "Stages", href: "/#stages" },
  { label: "Curriculum", href: "/#programs" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Partners", href: "/#partners" },
  { label: "Visit", href: "/#visit" },
];

/**
 * `wide` matches the staff section's wider column so the edges line up.
 * The links sit in a row from lg (1024px) up, where they fit on one line
 * beside the name and "Enrol now"; narrower screens (tablets, phones) get
 * the menu button instead.
 */
export default function Nav({ wide = false }: { wide?: boolean }) {
  const [open, setOpen] = useState(false);

  // Escape closes the menu; so does widening the window until the links show in the row.
  useEffect(() => {
    if (!open) return;
    const wideEnough = window.matchMedia("(min-width: 1024px)");
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onResize = () => wideEnough.matches && close();
    document.addEventListener("keydown", onKey);
    wideEnough.addEventListener("change", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      wideEnough.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/90 backdrop-blur-xl">
      <ScrollProgress />
      <div className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6 ${wide ? PAGE_WIDTH.wide : PAGE_WIDTH.standard}`}>
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <Image
            src="/images/logo.png"
            alt="Joef Dynamic College crest"
            width={34}
            height={34}
            className="h-[34px] w-[34px] shrink-0 object-contain"
          />
          <span className="whitespace-nowrap font-display text-[17px] font-semibold tracking-tight text-brand-navy">
            Joef Dynamic College
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex xl:gap-7" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-sm text-graphite transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <a
            href="/#visit"
            className="hidden whitespace-nowrap rounded-full bg-brand-red px-4 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-red-dark sm:inline-block"
          >
            Enrol now
          </a>
          <button
            type="button"
            className="cursor-pointer p-2 lg:hidden"
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
            className="overflow-hidden border-t border-hairline bg-white lg:hidden"
            aria-label="Mobile"
          >
            <ul className="flex flex-col gap-1 px-4 py-4 sm:px-6">
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
