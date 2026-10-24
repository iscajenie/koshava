import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic dynamic rendering: almost every page depends on the visitor's cart and session.
  cacheComponents: false,
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
