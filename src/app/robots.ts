import type { MetadataRoute } from "next";
import { getEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  if (env.APP_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/how-it-works", "/membership", "/faq", "/contact", "/safety", "/privacy", "/terms"],
      disallow: ["/api/", "/admin", "/dashboard", "/profiles/", "/search", "/settings"],
    },
  };
}
