import type { MetadataRoute } from "next";

const SITE_URL = "https://joefdynamicschools.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The portal is private — keep it out of search results.
        disallow: ["/portal", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
