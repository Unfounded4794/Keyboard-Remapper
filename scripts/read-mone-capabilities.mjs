// Only EVision's documented read-capabilities command (03). No begin/end,
// config writes, resets, calibration, motor or firmware commands are sent.
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = {
  ...process.env,
  KEYSTONE_TEST_DATA: await fs.mkdtemp(
    path.join(os.tmpdir(), "keystone-mone-cap-"),
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
    const devices = (await navigator.hid.getDevices()).filter(
      (d) =>
        d.vendorId === 0x05ac &&
        d.productId === 0x024f &&
        d.productName === "M-ONE" &&
        d.collections.some(
          (c) =>
            c.usagePage === 0xff1c &&
            c.usage === 0x92 &&
            c.outputReports.some(
              (r) =>
                r.reportId === 4 &&
                r.items.reduce(
                  (n, i) => n + i.reportCount * i.reportSize,
                  0,
                ) === 504,
            ),
        ),
    );
    if (devices.length !== 1)
      throw Error("Expected one matching M-ONE vendor interface.");
    const d = devices[0];
    if (!d.opened) await d.open();
    let cleanup = () => {};
    try {
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(Error("Read capabilities timed out"));
        }, 2500);
        const listener = (e) => {
          if (e.reportId !== 4 || e.data.byteLength !== 63) return;
          cleanup();
          resolve([...new Uint8Array(e.data.buffer, e.data.byteOffset, 63)]);
        };
        cleanup = () => {
          clearTimeout(timer);
          d.removeEventListener("inputreport", listener);
        };
        d.addEventListener("inputreport", listener);
      });
      const packet = new Uint8Array(63);
      packet.set([10, 0, 3, 7, 0, 0, 0]);
      await d.sendReport(4, packet);
      return { response: await response };
    } catch (e) {
      return { error: String(e) };
    } finally {
      cleanup();
      await d.close();
    }
  });
  await fs.writeFile(
    "build/mone-research/capabilities.json",
    JSON.stringify(data, null, 2),
  );
  console.log(JSON.stringify(data));
} finally {
  await app.close();
}
