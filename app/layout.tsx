import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const figtree = localFont({
  src: [{ path: "./fonts/figtree-var.woff2", weight: "300 900", style: "normal" }],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Joef Dynamic College — Middle School in Ikoyi, Lagos",
  description:
    "Joef Dynamic College is a middle school at 65 Eleshin Street, Ikoyi, Lagos, where curious minds grow into confident learners. Book a school tour today.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} ${figtree.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
