import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // ~8 MB of JSON: load it from node_modules at runtime instead of bundling it into the route.
  serverExternalPackages: ["country-state-city"],
  outputFileTracingIncludes: { "/legal/[doc]": ["./content/legal/**"] },
};

export default nextConfig;
