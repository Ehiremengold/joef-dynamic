import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Portal | Joef Dynamic College",
  description:
    "Take the common entrance test, sit class CBT tests, check results, or manage exams as staff.",
};

const areas = [
  {
    href: "/portal/entrance",
    title: "Common Entrance",
    text: "Prospective students: enter your name and take the entrance test online.",
    cta: "Take the test",
    icon: (
      <path d="M6 4h14a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm4 8h8M10 16h8M10 20h5M26 10l2 2-6 6h-2v-2l6-6z" />
    ),
  },
  {
    href: "/portal/cbt",
    title: "Student CBT & Results",
    text: "JS1–SS3 students: take your class tests and check your results any time.",
    cta: "Open student area",
    icon: (
      <path d="M4 6h24v16H4zM4 26h24M12 10l-3 3 3 3M20 10l3 3-3 3" />
    ),
  },
  {
    href: "/portal/staff",
    title: "Staff Section",
    text: "Set questions for entrance and class tests, and review every result.",
    cta: "Staff sign in",
    icon: (
      <path d="M16 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM5 28c0-6 5-10 11-10s11 4 11 10M22 4l2 2-2 2" />
    ),
  },
];

export default function PortalHome() {
  return (
    <>
      <Nav />
      <main className="bg-mist">
        <section className="bg-brand-navy text-white">
          <div className="mx-auto max-w-[1200px] px-4 py-14">
            <span className="inline-block rounded-btn bg-brand-gold px-2.5 py-1 text-sm font-semibold text-ink">
              JDC Portal
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
              Tests and results, all in one place
            </h1>
            <p className="mt-4 max-w-[560px] text-lg text-white/85">
              Choose where you need to go, entrance candidates, current
              students, and staff each have their own area.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-14">
          <div className="grid gap-4 md:grid-cols-3">
            {areas.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex cursor-pointer flex-col rounded-card border border-smoke bg-white p-6 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-brand-navy"
                  aria-hidden="true"
                >
                  {a.icon}
                </svg>
                <h2 className="mt-4 font-display text-xl font-bold tracking-tight">
                  {a.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite">
                  {a.text}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 font-semibold text-brand-red">
                  {a.cta}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">
                    <path d="M2 8h12M9 3l5 5-5 5" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
