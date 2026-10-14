// Read-only NIZ inspection. Never sends write, calibration, lock or reset commands.
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = {
  ...process.env,
  KEYSTONE_TEST_DATA: await fs.mkdtemp(path.join(os.tmpdir(), "keystone-niz-")),
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
        d.vendorId === 0x0483 &&
        d.productId === 0x5230 &&
        d.collections.some((c) => c.usagePage === 0x8c && c.usage === 1),
    );
    if (devices.length !== 1)
      throw Error("Expected one NIZ 0483:5230 Program interface.");
    const d = devices[0],
      queue = [];
    let waiter;
    const receive = (e) => {
      if (e.reportId !== 0 || e.data.byteLength !== 64) return;
      const bytes = [
        ...new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength),
      ];
      if (waiter) {
        const w = waiter;
        waiter = null;
        w(bytes);
      } else queue.push(bytes);
    };
    const next = () =>
      queue.length
        ? Promise.resolve(queue.shift())
        : new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              waiter = null;
              reject(Error("NIZ read timeout"));
            }, 3000);
            waiter = (bytes) => {
              clearTimeout(timer);
              resolve(bytes);
            };
          });
    const send = async (op) => {
      if (![0xf9, 0xf2].includes(op)) throw Error("Read-only command guard");
      const bytes = new Uint8Array(64);
      bytes[1] = op;
      await d.sendReport(0, bytes);
    };
    if (!d.opened) await d.open();
    d.addEventListener("inputreport", receive);
    try {
      await send(0xf9);
      const versionPacket = await next();
      if (versionPacket[0] !== 0 || versionPacket[1] !== 0xf9)
        throw Error("Unexpected NIZ version response");
      const version = new TextDecoder()
        .decode(Uint8Array.from(versionPacket.slice(2)))
        .replace(/\0.*$/s, "");
      if (!/^X?108EC\b/i.test(version))
        throw Error("Board version is not 108: " + version);
      await send(0xf2);
      const reports = [],
        deadline = Date.now() + 30000;
      while (reports.length < 8192 && Date.now() < deadline) {
        const bytes = await next();
        if (bytes[0] === 0xf6)
          return { version, collections: d.collections, reports };
        if (bytes[0] !== 0 || bytes[1] !== 0xf0)
          throw Error("Unexpected NIZ keymap packet");
        reports.push(bytes);
      }
      throw Error("Missing NIZ stream terminator");
    } finally {
      d.removeEventListener("inputreport", receive);
      await d.close();
    }
  });
  await fs.mkdir("build/niz-research", { recursive: true });
  await fs.writeFile(
    process.argv[2] ?? "build/niz-research/connected-profile.json",
    JSON.stringify(data, null, 2),
  );
  console.log(
    JSON.stringify({
      version: data.version,
      reports: data.reports.length,
      layers: [...new Set(data.reports.map((r) => r[2]))],
      keyIds: [...new Set(data.reports.map((r) => r[3]))].length,
      actionTypes: [...new Set(data.reports.map((r) => r[4]))],
    }),
  );
} finally {
  await app.close();
}
