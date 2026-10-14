// Documented EVision V2 reads only. No begin/end,
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
      const query = async (cmd, offset, size) => {
        const packet = new Uint8Array(63);
        packet[2] = cmd;
        packet[3] = size;
        packet[4] = offset & 255;
        packet[5] = offset >> 8;
        const sum = cmd + size + packet[4] + packet[5];
        packet[0] = sum & 255;
        packet[1] = sum >> 8;
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

        await d.sendReport(4, packet);
        const r = await response;
        if (
          r[0] !== packet[0] ||
          r[1] !== packet[1] ||
          r[2] !== cmd ||
          r[3] !== size ||
          r[4] !== packet[4] ||
          r[5] !== packet[5] ||
          r[6] !== 0
        )
          throw Error("Unexpected reply " + JSON.stringify(r));
        return r.slice(7, 7 + size);
      };
      const read = async (cmd, size) => {
        let a = [];
        while (a.length < size)
          a.push(
            ...(await query(cmd, a.length, Math.min(56, size - a.length))),
          );
        return a;
      };
      const capabilities = await read(3, 64);
      if (
        capabilities[0] !== 170 ||
        capabilities[1] !== 85 ||
        capabilities[5] !== 170 ||
        capabilities[6] !== 24
      )
        throw Error("Unsupported capabilities");
      const factory = await read(7, 510);
      if (!factory.some((v, i) => i % 3 === 0 && v === 32))
        throw Error("Unknown factory keymap encoding");
      return {
        capabilities,
        config: await read(5, 192),
        factory,
        current: await read(8, 510),
        macros: await read(0x14, 3072),
        physical: await read(0x1b, 170),
      };
    } catch (e) {
      return { error: String(e) };
    } finally {
      cleanup();
      await d.close();
    }
  });
  await fs.writeFile(
    "build/mone-research/configuration.json",
    JSON.stringify(data, null, 2),
  );
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          Array.isArray(v) ? { length: v.length, first: v.slice(0, 32) } : v,
        ]),
      ),
    ),
  );
} finally {
  await app.close();
}
