import type { Metadata } from "next";

// The portal is private — never index it or follow its links.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
