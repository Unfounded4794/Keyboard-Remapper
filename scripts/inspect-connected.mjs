import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = {
  ...process.env,
  KEYSTONE_TEST_DATA: await fs.mkdtemp(
    path.join(os.tmpdir(), "keystone-inspect-"),
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
  const data = await page.evaluate(async () => {
    const devices = await navigator.hid.getDevices();
    const result = [];
    for (const d of devices) {
      const entry = {
        name: d.productName,
        vid: d.vendorId,
        pid: d.productId,
        collections: d.collections.map((c) => ({
          page: c.usagePage,
          usage: c.usage,
        })),
      };
      if (d.productName.toLowerCase().includes("pikatea")) {
        if (!d.opened) await d.open();
        const c = d.collections.find(
          (c) => c.usagePage === 0xff60 && c.usage === 0x61,
        );
        if (c) {
          const command = async (bytes) => {
            const response = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                d.removeEventListener("inputreport", receive);
                reject(Error("timeout"));
              }, 2500);
              const receive = (e) => {
                clearTimeout(timeout);
                d.removeEventListener("inputreport", receive);
                resolve([
                  ...new Uint8Array(
                    e.data.buffer,
                    e.data.byteOffset,
                    e.data.byteLength,
                  ),
                ]);
              };
              d.addEventListener("inputreport", receive);
            });
            await d.sendReport(
              c.outputReports[0].reportId,
              Uint8Array.from([...bytes, ...Array(32 - bytes.length).fill(0)]),
            );
            return response;
          };
          const id = await command([254, 0]);
          entry.vial = id.slice(0, 4);
          if (id[0] > 0 && id[0] < 7) {
            const size = await command([254, 1]);
            const n =
              size[0] + size[1] * 256 + size[2] * 65536 + size[3] * 16777216;
            const bytes = [];
            for (let p = 0; p * 32 < n; p++)
              bytes.push(...(await command([254, 2, p & 255, p >> 8])));
            entry.definition = JSON.parse(
              await window.keystone.decompress(bytes.slice(0, n)),
            );
            entry.unlock = (await command([254, 5])).slice(0, 12);
          }
        }
      }
      result.push(entry);
    }
    return result;
  });
  await fs.mkdir("build", { recursive: true });
  await fs.writeFile(
    "build/connected-inspection.json",
    JSON.stringify(data, null, 2),
  );
  console.log(JSON.stringify(data, null, 2));
} finally {
  await app.close();
}
