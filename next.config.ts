import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next 16 PPR) is intentionally left off: this is a live
  // data dashboard, so the /api/* route handlers should run at request time and
  // always read the latest rows from Supabase. With it on, build-time prerender
  // would freeze an empty response. Route handlers are dynamic by default here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
