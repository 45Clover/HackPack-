import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: every page shows live job data, so we skip Cache Components to keep the code simple.
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
