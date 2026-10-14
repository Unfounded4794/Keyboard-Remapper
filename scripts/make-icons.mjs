import { chromium } from "playwright";
import fs from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  const svg = await fs.readFile("build/icon.svg", "utf8");
  await page.setContent(
    `<style>body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
  );
  await page.screenshot({ path: "build/icon.png", omitBackground: true });
  await page.setViewportSize({ width: 256, height: 256 });
  await page.addStyleTag({ content: "svg{width:256px;height:256px}" });
  const png = await page.screenshot({ omitBackground: true });
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await fs.writeFile("build/icon.ico", Buffer.concat([header, png]));
} finally {
  await browser.close();
}
