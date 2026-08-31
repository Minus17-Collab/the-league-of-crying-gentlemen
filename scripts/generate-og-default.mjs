// One-off/regenerate-on-demand script: builds the site-wide default Open
// Graph image (public/og-default.png) from the league logo and brand
// colors. Per-route dynamic OG images are a separate, later piece of
// work (see the site upgrade plan's Phase 5) — this is just the global
// fallback so links pasted in chat render something branded instead of
// nothing. Re-run manually: `node scripts/generate-og-default.mjs`.
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

async function main() {
  const logo = await sharp("public/league-logo.png").resize(360, 360).toBuffer();

  const svgBackground = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e1e1e" />
      <rect x="0" y="0" width="100%" height="10" fill="#c6a664" />
      <rect x="0" y="${HEIGHT - 10}" width="100%" height="10" fill="#c6a664" />
      <text x="500" y="290" font-family="Georgia, serif" font-size="64" fill="#d3b57f">The League of</text>
      <text x="500" y="365" font-family="Georgia, serif" font-size="64" fill="#d3b57f">Crying Gentlemen</text>
      <text x="500" y="410" font-family="Georgia, serif" font-size="26" fill="#f3e9d2" opacity="0.75">League history, records, and champions since 2023</text>
    </svg>
  `;

  await sharp(Buffer.from(svgBackground))
    .composite([{ input: logo, top: (HEIGHT - 360) / 2, left: 90 }])
    .png()
    .toFile("public/og-default.png");

  console.log("Generated public/og-default.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
