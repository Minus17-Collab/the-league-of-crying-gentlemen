import type { MetadataRoute } from "next";

// Required for static export ("output: export" in next.config.ts) — this
// route has no per-request data, so it's safe to force-static.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The League of Crying Gentlemen",
    short_name: "LCG",
    description: "League history, records, and champions since 2023.",
    start_url: "/",
    display: "standalone",
    background_color: "#1e1e1e",
    theme_color: "#6b1e1e",
    icons: [
      {
        src: "/favicon-16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
