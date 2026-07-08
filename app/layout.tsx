import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = "https://joefdynamicschools.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Joef Dynamic College | Private School in Ikoyi, Lagos (Nursery–SS3)",
    template: "%s | Joef Dynamic College, Ikoyi Lagos",
  },
  description:
    "Joef Dynamic College is a leading private school in Ikoyi, Lagos — Kindergarten, Nursery, Primary and Secondary (JSS1–SS3). Blended British & Nigerian curriculum, coding & robotics, music and moral character education. Admissions open for 2026/2027 — book a school tour.",
  keywords: [
    "Joef Dynamic College",
    "schools in Ikoyi",
    "best schools in Ikoyi Lagos",
    "top schools in Lagos",
    "private school Ikoyi",
    "nursery and primary school Ikoyi",
    "secondary school Ikoyi Lagos",
    "British curriculum school Lagos",
    "international school Lagos",
    "school in Lagos Island",
    "coding and robotics school Lagos",
    "admissions Lagos 2026/2027",
  ],
  applicationName: "Joef Dynamic College",
  authors: [{ name: "Joef Dynamic College" }],
  creator: "Joef Dynamic College",
  publisher: "Joef Dynamic College",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE_URL,
    siteName: "Joef Dynamic College",
    title: "Joef Dynamic College | Private School in Ikoyi, Lagos",
    description:
      "A leading private school in Ikoyi, Lagos — Nursery to SS3 with a blended British & Nigerian curriculum, coding & robotics and music. Admissions open 2026/2027.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Joef Dynamic College | Private School in Ikoyi, Lagos",
    description:
      "Nursery to SS3 in Ikoyi, Lagos. Blended British & Nigerian curriculum, coding & robotics, music. Admissions open 2026/2027.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "education",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "School",
  "@id": `${SITE_URL}/#school`,
  name: "Joef Dynamic College",
  alternateName: "Joef Dynamic College, Nursery & Primary School",
  slogan: "The Solid Foundation",
  description:
    "Private nursery, primary and secondary school in Ikoyi, Lagos offering a blended British and Nigerian curriculum, coding & robotics, music and moral character education.",
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  image: `${SITE_URL}/opengraph-image`,
  email: "info@joefdynamicschools.com",
  telephone: "+234-803-403-5705",
  foundingLocation: "Ikoyi, Lagos, Nigeria",
  address: [
    {
      "@type": "PostalAddress",
      streetAddress: "78 Norman Williams Street",
      addressLocality: "Ikoyi",
      addressRegion: "Lagos",
      addressCountry: "NG",
    },
    {
      "@type": "PostalAddress",
      streetAddress: "65 Eleshin Street",
      addressLocality: "Ikoyi",
      addressRegion: "Lagos",
      postalCode: "106104",
      addressCountry: "NG",
    },
  ],
  geo: {
    "@type": "GeoCoordinates",
    latitude: 6.4482699,
    longitude: 3.4139649,
  },
  areaServed: [
    { "@type": "Place", name: "Ikoyi" },
    { "@type": "Place", name: "Lagos Island" },
    { "@type": "Place", name: "Victoria Island" },
    { "@type": "Place", name: "Lagos" },
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "16:00",
  },
  telephoneNumbers: ["+234-803-403-5705", "+234-812-636-9992"],
  sameAs: [
    "https://www.facebook.com/joefdynamiccollege",
    "https://youtube.com/@joefdynamiccollege",
    "https://maps.google.com/?q=Joef+Dynamic+College,+Ikoyi,+Lagos",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variable must live on <html> (:root): Tailwind theme tokens
    // resolve var() references at :root, so a body-scoped variable is invisible.
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
