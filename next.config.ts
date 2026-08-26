import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed as a static site on GitHub Pages, which has no server
  // runtime — no Route Handlers, no image optimizer, no ISR/revalidate.
  // Every dynamic route must be resolvable via generateStaticParams at
  // build time (see AGENTS.md for why the ESPN sync job instead runs as
  // a standalone GitHub Actions script, not a Route Handler).
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
