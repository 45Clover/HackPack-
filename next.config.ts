import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: every page shows live job data, so we skip Cache Components to keep the code simple.
  devIndicators: false, // the dev badge sat on top of the 3D map / Skill tree switch
  // The early-access pages were removed (8 Nov); links already shared land on the home page.
  redirects() {
    return ["/waitlist", "/joinearly"].map((source) => ({ source, destination: "/", permanent: false }));
  },
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
