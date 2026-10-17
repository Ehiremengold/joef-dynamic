import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its built-in font metrics (.afm) files from disk using a
  // path relative to its own package folder at runtime. If webpack bundles
  // it, that relative path breaks (ENOENT looking inside .next/server/...).
  // Marking it external makes Next require() it straight from node_modules
  // instead, where its own relative paths resolve correctly. bcrypt is a
  // native addon (a .node binary): it must be loaded from node_modules too.
  serverExternalPackages: ["pdfkit", "bcrypt"],
};

export default nextConfig;
