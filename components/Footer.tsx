import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    heading: "School",
    links: [
      { label: "About us", href: "/#about" },
      { label: "Stages", href: "/#stages" },
      { label: "Curriculum", href: "/#programs" },
      { label: "Gallery", href: "/#gallery" },
      { label: "Partners", href: "/#partners" },
      { label: "Visit us", href: "/#visit" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "0803 403 5705", href: "tel:+2348034035705" },
      { label: "0812 636 9992", href: "tel:+2348126369992" },
      { label: "0803 531 7472", href: "tel:+2348035317472" },
      {
        label: "info@joefdynamicschools.com",
        href: "mailto:info@joefdynamicschools.com",
      },
      {
        label: "78, Norman Williams St, Ikoyi, Lagos",
        href: "https://maps.google.com/?q=Joef+Dynamic+College,+78+Norman+Williams+St,+Ikoyi,+Lagos",
      },
      {
        label: "65, Moshalashi St, Ikoyi, Lagos",
        href: "https://maps.google.com/?q=Joef+Dynamic+College,+65+Moshalashi+St,+Ikoyi,+Lagos",
      },
      {
        label: "40, Moshalashi St, Ikoyi, Lagos",
        href: "https://maps.google.com/?q=Joef+Dynamic+College,+40+Moshalashi+St,+Ikoyi,+Lagos",
      },
    ],
  },
];

const socials = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/joefdynamiccollege",
    path: "M13.5 9H16V6h-2.5C11.6 6 10 7.6 10 9.5V11H8v3h2v7h3v-7h2.5l.5-3H13v-1.2c0-.5.3-.8.5-.8z",
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@joefdynamiccollege",
    path: "M21.6 7.2c.8.2 1.4.8 1.6 1.6.4 1.5.4 4.4.4 4.4s0 2.9-.4 4.4c-.2.8-.8 1.4-1.6 1.6-1.5.4-9.6.4-9.6.4s-8.1 0-9.6-.4c-.8-.2-1.4-.8-1.6-1.6C.4 16.1.4 13.2.4 13.2s0-2.9.4-4.4c.2-.8.8-1.4 1.6-1.6C3.9 6.8 12 6.8 12 6.8s8.1 0 9.6.4zM9.8 16.6l6.4-3.4-6.4-3.4v6.8z",
  },
];

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/logo.png"
                alt="Joef Dynamic College crest"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <p className="font-display text-[17px] font-semibold tracking-tight">
                Joef Dynamic College
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Raising Dynamic Minds, Building a Better Tomorrow. Kindergarten,
              Nursery, Primary and College (JSS1–SS3) in Ikoyi, Lagos.
            </p>
            <div className="mt-6 flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="rounded-full border border-white/25 p-2.5 text-white/80 transition-colors duration-200 hover:border-white hover:text-white"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {col.heading}
              </h3>
              <ul className="mt-6 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/70 transition-colors duration-200 hover:text-white"
                      {...(l.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-white/15 pt-6 text-sm text-white/60">
          <p>
            © {new Date().getFullYear()} Joef Dynamic College. Motto: The Solid
            Foundation. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
