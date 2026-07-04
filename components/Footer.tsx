const columns = [
  {
    heading: "School",
    links: [
      { label: "About us", href: "#about" },
      { label: "Programs", href: "#programs" },
      { label: "Why us", href: "#why-us" },
      { label: "Visit us", href: "#visit" },
    ],
  },
  {
    heading: "For Parents",
    links: [
      { label: "Admissions", href: "#visit" },
      { label: "Term dates", href: "#visit" },
      { label: "Parent updates", href: "#visit" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "0803 403 5705", href: "tel:+2348034035705" },
      {
        label: "65 Eleshin St, Ikoyi, Lagos",
        href: "https://maps.google.com/?q=Joef+Dynamic+College,+65+Eleshin+St,+Ikoyi,+Lagos",
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <p className="font-display text-xl font-extrabold tracking-tight">
              Joef&nbsp;Dynamic<span className="text-brand-pink">.</span>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-smoke">
              A middle school in Ikoyi, Lagos, raising disciplined, confident
              learners for ages 10–15.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {col.heading}
              </h3>
              <ul className="mt-6 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-smoke transition-colors duration-200 hover:text-white"
                      {...(l.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-graphite pt-6 text-sm text-smoke">
          <p>© {new Date().getFullYear()} Joef Dynamic College. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
