"use client";

import Image from "next/image";
import { motion } from "motion/react";
import Reveal from "./Reveal";
import WordReveal from "./fx/WordReveal";

const photos = [
  {
    src: "/images/gallery/early-years.jpg",
    alt: "Young Joef Dynamic pupils in uniform posing in the school garden",
    caption: "Early years",
  },
  {
    src: "/images/gallery/first-lady-meeting.jpg",
    alt: "Students meeting the First lady of Lagos State",
    caption: "Meeting with the First lady of Lagos State",
  },
  {
    src: "/images/gallery/career-day.jpg",
    alt: "Students dressed as doctors for career day",
    caption: "Career day",
  },
  {
    src: "/images/gallery/aviation-trip.jpg",
    alt: "A student stepping off an aircraft on an aviation excursion",
    caption: "Aviation excursion",
  },
  {
    src: "/images/gallery/art-gallery.jpg",
    alt: "Students studying paintings on an art gallery visit",
    caption: "Art gallery visit",
  },
  {
    src: "/images/gallery/medal-ceremony.jpg",
    alt: "A student receiving a medal at an award ceremony",
    caption: "Medal ceremony",
  },
  {
    src: "/images/gallery/college-students.jpg",
    alt: "Smiling college students in uniform",
    caption: "College life",
  },
  {
    src: "/images/gallery/excursion-line.jpg",
    alt: "Students lined up on a school excursion",
    caption: "School excursion",
  },
];

export default function Gallery() {
  return (
    <section id="gallery" className="bg-canvas">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[640px] text-center">
          <WordReveal
            text="Life at Joef Dynamic Schools."
            className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.015em] text-brand-navy md:text-5xl lg:text-nowrap"
          />
          <Reveal delay={180}>
            <p className="mt-5 text-[17px] leading-relaxed text-mid-gray">
              Excursions, award nights, sports days and career days, moments
              from our students&rsquo; week, straight from our school
              community.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          {photos.map((p, i) => (
            <motion.figure
              key={p.src}
              initial={{
                opacity: 0,
                scale: 0.82,
                rotate: i % 2 === 0 ? -5 : 5,
                y: 32,
              }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -60px 0px" }}
              transition={{
                type: "spring",
                stiffness: 110,
                damping: 15,
                delay: (i % 4) * 0.09,
              }}
            >
              <motion.div
                whileHover={{ scale: 1.04, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
                className="relative aspect-square overflow-hidden rounded-card"
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 280px"
                  className="object-cover"
                />
              </motion.div>
              <figcaption className="mt-2 text-center text-[13px] text-mid-gray">
                {p.caption}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
