import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OUT_DIR = resolve(__dirname, "..", "public", "og");
const WIDTH = 1200;
const HEIGHT = 630;

const REGULAR = readFile(
  resolve(__dirname, "..", "node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff"),
);
const BOLD = readFile(
  resolve(__dirname, "..", "node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff"),
);

function h(type, props, ...children) {
  return { type, props: { ...props, children } };
}

function bg() {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a0f14 0%, #2d1a1f 50%, #1a0f14 100%)",
        color: "#f5e6c8",
        textAlign: "center",
        padding: 60,
        position: "relative",
      },
    },
    h("div", {
      style: {
        position: "absolute",
        top: 40,
        left: 40,
        right: 40,
        bottom: 40,
        border: "2px solid #c9a227",
        borderRadius: 4,
        display: "flex",
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontFamily: "Playfair Display",
            fontWeight: 700,
            lineHeight: 1.1,
            color: "#c9a227",
            marginBottom: 24,
          },
        },
        h("div", { style: { display: "flex" } }, "The League of"),
        h("div", { style: { display: "flex" } }, "Crying Gentlemen"),
      ),
      h(
        "div",
        { style: { display: "flex", fontSize: 32, fontFamily: "Playfair Display", fontWeight: 400, opacity: 0.9 } },
        "Fantasy Football Record Book",
      ),
    ),
  );
}

async function generateDefault() {
  const [regular, bold] = await Promise.all([REGULAR, BOLD]);
  const svg = await satori(bg(), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Playfair Display", data: regular, weight: 400, style: "normal" },
      { name: "Playfair Display", data: bold, weight: 700, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
  const png = resvg.render();
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(resolve(OUT_DIR, "default.png"), png.asPng());
  console.log("Generated public/og/default.png");
}

async function main() {
  await generateDefault();
}

main().catch((err) => {
  console.error("OG generation failed:", err);
  process.exit(1);
});
