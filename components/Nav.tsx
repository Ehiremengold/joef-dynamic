"use client";

import { useState } from "react";

const links = [
  { label: "About", href: "#about" },
  { label: "Programs", href: "#programs" },
  { label: "Why Us", href: "#why-us" },
  { label: "Visit", href: "#visit" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header>
      {/* Utility bar */}
      <div className="bg-ink text-white">
        <div className="mx-auto flex min-h-10 max-w-[1200px] items-center justify-center px-4 py-2 text-[13px]">
          <p className="text-center">
            Admissions are open for the 2026/2027 session —{" "}
            <a href="#visit" className="font-semibold underline underline-offset-2 hover:text-signal-yellow transition-colors duration-200">
              book a school tour
            </a>
          </p>
        </div>
      </div>

      {/* Main nav */}
      <div className="border-b border-smoke bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4">
          <a href="#" className="font-display text-xl font-extrabold tracking-tight">
            Joef&nbsp;Dynamic<span className="text-brand-pink">.</span>
          </a>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-ink transition-colors duration-200 hover:text-pewter"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="tel:+2348034035705"
              className="hidden rounded-btn border border-ink px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-white sm:inline-block"
            >
              0803 403 5705
            </a>
            <a
              href="#visit"
              className="hidden rounded-btn bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#2a2935] sm:inline-block"
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-smoke px-4 py-4 md:hidden" aria-label="Mobile">
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="block rounded-btn px-2 py-3 text-base font-semibold hover:bg-mist"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#visit"
                  className="mt-2 block rounded-btn bg-ink px-4 py-3 text-center text-base font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  Enrol now
                </a>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
