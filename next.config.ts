import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Off on purpose: every page shows live job data, so we skip Cache Components to keep the code simple.
  devIndicators: false, // the dev badge sat on top of the 3D map / Skill tree switch
  // /explore was removed (8 Nov); old links land on the home page. Not permanent, so browsers don't cache it forever.
  redirects() {
    return [{ source: "/explore", destination: "/", permanent: false }];
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
