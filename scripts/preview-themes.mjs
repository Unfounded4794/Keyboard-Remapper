import { chromium } from "playwright";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
const ids = [
  "gateway",
  "midnight-rainbow",
  "awaken",
  "reforged",
  "mictlan",
  "lazurite",
  "great-wave",
  "half-blade",
  "donuts",
  "mizu",
  "stone-age",
  "red-samurai",
  "hammerhead-dark",
  "deku",
  "mecha-01",
  "basin",
  "black-panther",
  "fuji",
  "wavez",
  "hero",
];
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await fs.mkdir("artifacts/themes-v4", { recursive: true });
  await p.goto("http://127.0.0.1:5173");
  const images = [];
  for (const id of ids) {
    await p.getByRole("button", { name: "Settings", exact: true }).click();
    await p.getByLabel("Color theme", { exact: true }).click();
    await p.locator(`[data-theme-id="${id}"]`).click();
    const name = await p.getByLabel("Color theme").textContent();
    await expect(p.locator("html")).toHaveAttribute("data-theme", id);
    await p.getByRole("button", { name: "Tester", exact: true }).click();
    const bytes = await p
      .locator(".keyboard-viewport")
      .screenshot({ path: `artifacts/themes-v4/${id}.png` });
    images.push({ id, name, data: bytes.toString("base64") });
  }
  await fs.writeFile(
    "artifacts/themes-v4/index.html",
    `<!doctype html><meta charset="utf-8"><title>Keystone reference themes</title><style>body{background:#181b20;color:#eee;font:18px system-ui;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;background:#24262c;padding:12px;border-radius:8px}img{width:100%}figcaption{margin:0 0 8px}</style>` +
      images
        .map(
          (i) =>
            `<figure><figcaption>${i.name}</figcaption><img src="${i.id}.png"></figure>`,
        )
        .join(""),
  );
  const sheet = await browser.newPage({
    viewport: { width: 2200, height: 1100 },
  });
  for (let group = 0; group < 5; group++) {
    await sheet.setContent(
      `<style>body{background:#181b20;color:#eee;font:20px system-ui;margin:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0;background:#24262c;padding:10px;border-radius:8px}img{width:100%}figcaption{margin:0 0 6px}</style>` +
        images
          .slice(group * 4, group * 4 + 4)
          .map(
            (i) =>
              `<figure><figcaption>${i.name}</figcaption><img src="data:image/png;base64,${i.data}"></figure>`,
          )
          .join(""),
    );
    await sheet
      .locator("img")
      .last()
      .evaluate(async (i) => i.decode());
    await sheet.screenshot({
      path: `artifacts/themes-v4/sheet-${group + 1}.png`,
      fullPage: true,
    });
  }
  console.log(`Rendered ${images.length} reference themes.`);
} finally {
  await browser.close();
}
