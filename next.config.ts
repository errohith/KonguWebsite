import type { NextConfig } from "next";

// Static security headers applied to every response, including static assets.
// The Content-Security-Policy depends on runtime configuration (payment
// checkout script origin) and is set per request in `src/proxy.ts`.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
];

const nextConfig: NextConfig = {
  // Cache Components is intentionally disabled: nearly every page is
  // per-member and privacy-sensitive, so all routes render dynamically and
  // nothing member-specific can be cached into a shared static shell.
  cacheComponents: false,
  poweredByHeader: false,
  // @node-rs/argon2 ships a native binary and must not be bundled.
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Enables forbidden()/unauthorized() for role checks in the admin area.
    authInterrupts: true,
    serverActions: {
      // Photo/document uploads go through server actions.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
