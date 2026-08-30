// One-off/regenerate-on-demand script: derives the site's favicon and app
// icons from public/league-logo.png. Not run in CI or at build time — the
// output files are committed to public/ and src/app/favicon.ico. Re-run
// this manually (`node scripts/generate-icons.mjs`) if league-logo.png
// ever changes.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

const SRC = "public/league-logo.png";

async function main() {
  await Promise.all([
    sharp(SRC).resize(512, 512).png().toFile("public/icon.png"),
    sharp(SRC).resize(180, 180).png().toFile("public/apple-touch-icon.png"),
    sharp(SRC).resize(32, 32).png().toFile("public/favicon-32.png"),
    sharp(SRC).resize(16, 16).png().toFile("public/favicon-16.png"),
  ]);

  const icoBuffer = await pngToIco("public/icon.png");
  await writeFile("src/app/favicon.ico", icoBuffer);

  console.log("Generated icon.png, apple-touch-icon.png, favicon-{16,32}.png, and favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
