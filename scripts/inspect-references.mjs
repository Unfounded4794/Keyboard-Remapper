import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });
  await fs.mkdir("artifacts/references", { recursive: true });
  for (const name of ["hero.avif", "mizu.avif"]) {
    await page.goto(pathToFileURL(path.resolve("reference images", name)).href);
    await page.locator("img").evaluate(async (el) => {
      await el.decode();
      el.style.maxWidth = "1500px";
      el.style.maxHeight = "1100px";
    });
    await page
      .locator("img")
      .screenshot({ path: `artifacts/references/${name.split(".")[0]}.png` });
  }
} finally {
  await browser.close();
}
