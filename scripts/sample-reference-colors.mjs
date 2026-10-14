import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
// Normalized coordinates on flat cap faces, away from legends and side walls.
const points = {
  "awakens.jpg": [
    [0.156, 0.382],
    [0.094, 0.343],
    [0.647, 0.382],
  ],
  "basin.webp": [
    [0.262, 0.272],
    [0.361, 0.373],
    [0.262, 0.409],
    [0.263, 0.453],
    [0.268, 0.497],
    [0.13, 0.368],
    [0.72, 0.409],
  ],
  "black panther.webp": [
    [0.197, 0.313],
    [0.083, 0.315],
    [0.083, 0.128],
  ],
  "deku.jpg": [
    [0.256, 0.246],
    [0.094, 0.304],
    [0.067, 0.158],
  ],
  "donuts.jpg": [
    [0.306, 0.408],
    [0.154, 0.441],
    [0.285, 0.497],
  ],
  "fuji.webp": [
    [0.223, 0.397],
    [0.492, 0.276],
    [0.644, 0.4],
  ],
  "gateway.webp": [
    [0.267, 0.329],
    [0.578, 0.308],
    [0.158, 0.378],
  ],
  "great wave.webp": [
    [0.12, 0.434],
    [0.226, 0.441],
    [0.263, 0.441],
    [0.303, 0.441],
    [0.368, 0.441],
  ],
  "half blade.webp": [
    [0.254, 0.445],
    [0.166, 0.497],
    [0.579, 0.487],
  ],
  "hammerhead.png": [
    [0.265, 0.391],
    [0.122, 0.391],
    [0.6, 0.391],
  ],
  "lazurite.png": [
    [0.331, 0.714],
    [0.061, 0.7],
    [0.162, 0.522],
  ],
  "mecha 01.webp": [
    [0.252, 0.416],
    [0.083, 0.415],
    [0.093, 0.283],
  ],
  "mictlan.webp": [
    [0.239, 0.277],
    [0.6, 0.318],
    [0.678, 0.354],
  ],
  "midnight rainbow.webp": [[0.28, 0.299]],
  "red samurai.jpg": [
    [0.335, 0.447],
    [0.132, 0.447],
    [0.692, 0.447],
  ],
  "reforged.webp": [
    [0.353, 0.497],
    [0.201, 0.497],
    [0.719, 0.497],
  ],
  "stone age.webp": [
    [0.351, 0.354],
    [0.163, 0.354],
    [0.604, 0.354],
  ],
  "wavez.webp": [
    [0.391, 0.496],
    [0.234, 0.509],
  ],
  "hero.avif": [
    [0.36, 0.299],
    [0.097, 0.299],
    [0.617, 0.338],
  ],
  "mizu.avif": [
    [0.207, 0.404],
    [0.089, 0.404],
    [0.605, 0.404],
  ],
};
const browser = await chromium.launch();
const out = {};
try {
  const p = await browser.newPage();
  for (const [name, coords] of Object.entries(points)) {
    await p.goto(pathToFileURL(path.resolve("reference images", name)).href);
    out[name] = await p.locator("img").evaluate(async (el, coords) => {
      await el.decode();
      const c = document.createElement("canvas");
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(el, 0, 0);
      return {
        width: c.width,
        height: c.height,
        samples: coords.map(([x, y]) => {
          const d = ctx.getImageData(
            Math.floor(x * c.width) - 3,
            Math.floor(y * c.height) - 3,
            7,
            7,
          ).data;
          const med = [0, 1, 2].map(
            (ch) =>
              Array.from({ length: 49 }, (_, i) => d[i * 4 + ch]).sort(
                (a, b) => a - b,
              )[24],
          );
          return "#" + med.map((v) => v.toString(16).padStart(2, "0")).join("");
        }),
      };
    }, coords);
  }
  await fs.writeFile(
    "artifacts/references/sampled-colors.json",
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out));
} finally {
  await browser.close();
}
