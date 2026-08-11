import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/l/", "/promo/", "/privacy-policy"],
        disallow: ["/admin", "/dashboard", "/login", "/api/"],
      },
    ],
  };
}
