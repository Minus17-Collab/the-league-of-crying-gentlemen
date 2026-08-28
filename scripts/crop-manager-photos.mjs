// One-off: crops the throwback photos in `Manager Photos/` (not checked
// in — see .gitignore) into square, face-centered avatars in
// `public/manager-photos/`, named by the manager's actual first name
// (lowercase) per `franchises.display_name`, matching the site's
// existing "read from public/" asset convention (see next.config.ts --
// this is a static export, so images must be plain files under public/).
//
// Crop rectangles below are NATIVE PIXEL coordinates (source photos are
// all 1320x2868), picked by visually inspecting each source photo --
// there's no face-detection library in this project, so these are
// manual estimates. Re-run and eyeball the output in
// public/manager-photos/ after any change; adjust the rectangle if a
// face looks off-center.
//
// Run with:
//   node scripts/crop-manager-photos.mjs

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC_DIR = "Manager Photos";
const OUT_DIR = "public/manager-photos";
const OUTPUT_SIZE = 480; // final square avatar size, px

mkdirSync(OUT_DIR, { recursive: true });

function log(...args) {
  console.log("[crop-manager-photos]", ...args);
}

/**
 * @param {string} srcFile - file inside SRC_DIR
 * @param {string} outName - output first-name (lowercase, no extension)
 * @param {{ left: number, top: number, width: number, height: number }} crop
 * @param {number} [rotate] - degrees clockwise to rotate BEFORE cropping (crop rect is in POST-rotation coordinates)
 */
async function makeAvatar(srcFile, outName, crop, rotate) {
  let pipeline = sharp(`${SRC_DIR}/${srcFile}`);
  if (rotate) pipeline = pipeline.rotate(rotate);
  const outPath = `${OUT_DIR}/${outName}.jpg`;
  await pipeline
    .extract(crop)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toFile(outPath);
  log(`wrote ${outPath} (from ${srcFile}, crop ${JSON.stringify(crop)}${rotate ? `, rotated ${rotate}deg` : ""})`);
}

async function main() {
  // Straightforward single-subject crops (no rotation needed).
  await makeAvatar("Brent.png", "brent", { left: 267, top: 633, width: 800, height: 800 });
  await makeAvatar("Bryan.png", "bryan", { left: 63, top: 343, width: 1100, height: 1100 });
  await makeAvatar("Zach.png", "zack", { left: 192, top: 768, width: 950, height: 950 });
  await makeAvatar("Josh.png", "josh", { left: 325, top: 138, width: 700, height: 700 });
  // Kendall.png has Kendall (left) and his mom (right) -- crop excludes her.
  await makeAvatar("Kendall.png", "kendall", { left: 90, top: 730, width: 620, height: 620 });

  // Trevon.png has two people: Lucas Grant (back, left) and Trevon
  // Benjamin (front, right, closer to camera) -- split into two avatars.
  await makeAvatar("Trevon.png", "lucas", { left: 40, top: 802, width: 700, height: 700 });
  await makeAvatar("Trevon.png", "trevon", { left: 590, top: 1217, width: 730, height: 730 });

  // Devin.png is shot sideways (jersey text reads correctly only if you
  // tilt your head right, meaning the TRUE "up" is the current right
  // edge) -- rotate 90deg counter-clockwise (sharp: -90) before
  // cropping. Crop rect below is in POST-rotation coordinates and is a
  // first-pass estimate; verify visually and adjust.
  await makeAvatar("Devin.png", "devin", { left: 867, top: 43, width: 900, height: 900 }, 90);

  log("done -- view public/manager-photos/*.jpg and adjust crop rectangles above if any face looks off-center");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
