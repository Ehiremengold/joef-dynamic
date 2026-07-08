import Image from "next/image";
import Reveal from "./Reveal";
import Parallax from "./fx/Parallax";
import WordReveal from "./fx/WordReveal";

const details = [
  {
    label: "Campus 1",
    value: "78, Norman Williams Street, Ikoyi, Lagos",
    href: "https://maps.google.com/?q=Joef+Dynamic+College,+78+Norman+Williams+St,+Ikoyi,+Lagos",
  },
  {
    label: "Campus 2",
    value: "65, Eleshin Street, Ikoyi, Lagos",
    href: "https://maps.google.com/?q=Joef+Dynamic+College,+65+Eleshin+St,+Ikoyi,+Lagos",
  },
  { label: "Phone", value: "0803 403 5705", href: "tel:+2348034035705" },
  { label: "Phone", value: "0812 636 9992", href: "tel:+2348126369992" },
  {
    label: "Email",
    value: "info@joefdynamicschools.com",
    href: "mailto:info@joefdynamicschools.com",
  },
  { label: "Hours", value: "Monday to Friday, 8:00 am to 4:00 pm" },
];

export default function Visit() {
  return (
    <section id="visit" className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <Reveal delay={120} from="left" className="order-2 mx-auto w-full max-w-[560px] md:order-1">
            <Parallax amount={28}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                <Image
                  src="/images/student-pencil.jpg"
                  alt="A Joef Dynamic student concentrating with a pencil in hand"
                  fill
                  sizes="(max-width: 768px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
            </Parallax>
          </Reveal>

          <div className="order-1 max-w-[480px] md:order-2">
            <WordReveal
              text="See the joy of learning in action."
              className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl"
            />
            <Reveal delay={160}>
            <p className="mt-6 text-[17px] leading-relaxed text-graphite">
              No website can show you a school&rsquo;s atmosphere. Walk our
              halls, meet the teachers, watch a class, then decide. Tours run
              every weekday, at both of our Ikoyi campuses.
            </p>

            <dl className="mt-10 space-y-4">
              {details.map((d, i) => (
                <div key={`${d.label}-${i}`} className="flex gap-6">
                  <dt className="w-16 shrink-0 text-[13px] font-medium uppercase tracking-wide text-pewter">
                    {d.label}
                  </dt>
                  <dd className="text-[15px] font-medium text-ink">
                    {d.href ? (
                      <a
                        href={d.href}
                        className="transition-colors duration-200 hover:text-brand-red"
                        {...(d.href.startsWith("http")
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <a
              href="tel:+2348034035705"
              className="mt-10 inline-block rounded-full bg-brand-red px-7 py-3.5 text-[17px] font-medium text-white transition-colors duration-200 hover:bg-brand-red-dark"
            >
              Call to book a tour
            </a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
