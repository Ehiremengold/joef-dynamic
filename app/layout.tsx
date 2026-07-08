import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Joef Dynamic College | Ikoyi, Lagos",
  description:
    "Joef Dynamic College, Nursery & Primary School, Ikoyi, Lagos — Kindergarten to SS3 with blended British & Nigerian curricula, coding & robotics, music and moral upbringing. Admissions open 2026/2027. Book a school tour today.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variable must live on <html> (:root): Tailwind theme tokens
    // resolve var() references at :root, so a body-scoped variable is invisible.
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
