// Descriptor-only M-ONE inspection; no configuration commands or writes.
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = {
  ...process.env,
  KEYSTONE_TEST_DATA: await fs.mkdtemp(
    path.join(os.tmpdir(), "keystone-mone-"),
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  await page.locator(".keyboard-viewport").waitFor();
  await page
    .locator(".busy-indicator")
    .waitFor({ state: "hidden", timeout: 60000 });
  const data = await page.evaluate(async (features) => {
    const results = [];
    for (const d of (await navigator.hid.getDevices()).filter(
      (d) =>
        d.vendorId === 0x05ac &&
        d.productId === 0x024f &&
        d.productName === "M-ONE",
    )) {
      const entry = {
        name: d.productName,
        vid: d.vendorId,
        pid: d.productId,
        collections: d.collections,
        features: [],
      };
      if (features && d.collections.some((c) => c.featureReports.length)) {
        try {
          await d.open();
          for (const id of new Set(
            d.collections.flatMap((c) =>
              c.featureReports.map((r) => r.reportId),
            ),
          )) {
            const raw = await Promise.race([
              d.receiveFeatureReport(id),
              new Promise((_, reject) =>
                setTimeout(() => reject(Error("GET_FEATURE timeout")), 2000),
              ),
            ]);
            entry.features.push({
              id,
              bytes: [
                ...new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength),
              ],
            });
          }
        } catch (e) {
          entry.featureError = String(e);
        } finally {
          if (d.opened) await d.close();
        }
      }
      results.push(entry);
    }
    return results;
  }, process.argv.includes("--features"));
  await fs.mkdir("build/mone-research", { recursive: true });
  await fs.writeFile(
    "build/mone-research/descriptor.json",
    JSON.stringify(data, null, 2),
  );
  console.log(
    JSON.stringify(
      data.map((d) => ({
        ...d,
        features: d.features.map((f) => ({ id: f.id, length: f.bytes.length })),
        collections: d.collections.map((c) => ({
          page: c.usagePage,
          usage: c.usage,
          input: c.inputReports.map((r) => ({
            id: r.reportId,
            bits: r.items.reduce((n, i) => n + i.reportCount * i.reportSize, 0),
          })),
          output: c.outputReports.map((r) => ({
            id: r.reportId,
            bits: r.items.reduce((n, i) => n + i.reportCount * i.reportSize, 0),
          })),
          feature: c.featureReports.map((r) => ({
            id: r.reportId,
            bits: r.items.reduce((n, i) => n + i.reportCount * i.reportSize, 0),
          })),
        })),
      })),
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
