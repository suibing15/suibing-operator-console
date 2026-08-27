import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/console", "/login", "/school-portal", "/invoices", "/api/"],
    },
    sitemap: "https://suibingitservices.online/sitemap.xml",
  };
}
