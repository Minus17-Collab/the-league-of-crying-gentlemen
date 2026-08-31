import type { MetadataRoute } from "next";

// Required for static export ("output: export" in next.config.ts).
export const dynamic = "force-static";

// Default: keep the site out of search results for members' real names
// while staying fully reachable to anyone with the link. This is a
// default, not a permanent decision — the league can revisit it (see
// the site upgrade plan's Phase 0.6) in favor of access-gating or
// anonymizing names instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
