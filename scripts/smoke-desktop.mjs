import { _electron as electron } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { expect } from "@playwright/test";
const executable = process.argv[2];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const testData = await fs.mkdtemp(path.join(os.tmpdir(), "keystone-smoke-"));
env.KEYSTONE_TEST_DATA = testData;
const app = await electron.launch({
  ...(executable
    ? { executablePath: path.resolve(executable) }
    : { args: ["."] }),
  env,
  timeout: 30000,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".keyboard-viewport").waitFor();
  await page
    .locator(".busy-indicator")
    .waitFor({ state: "hidden", timeout: 30000 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tester", exact: true })
    .click();
  const capabilities = await page.evaluate(() => ({
    desktop: window.keystone?.desktop,
    hid: !!navigator.hid,
    serial: !!navigator.serial,
    nodeExposed: typeof window.require !== "undefined",
  }));
  if (
    !capabilities.desktop ||
    !capabilities.hid ||
    !capabilities.serial ||
    capabilities.nodeExposed
  )
    throw new Error(JSON.stringify(capabilities));
  const decoded = await page.evaluate(async () => {
    const bytes = Uint8Array.from(
      atob(
        "/Td6WFoAAATm1rRGAgAhARYAAAB0L+WjAQALaGVsbG8gd29ybGQKAKHy/8Rqf7/PAAEkDKYY2NgftvN9AQAAAAAEWVo=",
      ),
      (c) => c.charCodeAt(0),
    );
    return window.keystone.decompress([...bytes]);
  });
  if (decoded !== "hello world\n")
    throw new Error("Bundled XZ decoder failed.");
  const definitions = await page.evaluate(() =>
    window.keystone.definitions(0x5644, 0x5111, 13),
  );
  if (!definitions.some((d) => d.name === "SP-111"))
    throw new Error("Offline keyboard catalog missing.");
  const chooser = await app.evaluate(
    async ({ session, dialog, BrowserWindow }) => {
      const original = dialog.showMessageBox,
        labels = [];
      dialog.showMessageBox = async (_win, options) => {
        labels.push(options.buttons[0]);
        return { response: 0 };
      };
      try {
        const hid = await new Promise((resolve) =>
          session.defaultSession.emit(
            "select-hid-device",
            { preventDefault() {} },
            {
              deviceList: [
                {
                  deviceId: "HID_TEST",
                  name: "Named keyboard",
                  vendorId: 0x5644,
                  productId: 0x5111,
                },
              ],
            },
            resolve,
          ),
        );
        const serial = await new Promise((resolve) =>
          session.defaultSession.emit(
            "select-serial-port",
            { preventDefault() {} },
            [{ portId: "SERIAL_TEST", displayName: "ZMK USB serial" }],
            BrowserWindow.getAllWindows()[0].webContents,
            resolve,
          ),
        );
        return { hid, serial, labels };
      } finally {
        dialog.showMessageBox = original;
      }
    },
  );
  if (
    chooser.hid !== "HID_TEST" ||
    chooser.serial !== "SERIAL_TEST" ||
    chooser.labels.join("|") !== "Named keyboard|ZMK USB serial"
  )
    throw new Error("Device chooser regression: " + JSON.stringify(chooser));
  await page.keyboard.down("a");
  await page.keyboard.up("a");
  await fs.mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: "artifacts/keystone-desktop-v2.png",
    fullPage: true,
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Desktop smoke passed:", JSON.stringify(capabilities));
  console.log("Device chooser passed:", JSON.stringify(chooser));
  console.log(
    "Available keyboards:",
    await page.evaluate(async () =>
      (await navigator.hid.getDevices())
        .filter(
          (d) =>
            d.collections.some(
              (c) => c.usagePage === 0xff60 && c.usage === 0x61,
            ) ||
            (d.vendorId === 0x05ac &&
              d.productId === 0x024f &&
              d.productName === "M-ONE" &&
              d.collections.some(
                (c) => c.usagePage === 0xff1c && c.usage === 0x92,
              )) ||
            (d.vendorId === 0x0483 &&
              d.productId === 0x5230 &&
              d.collections.some((c) => c.usagePage === 0x8c && c.usage === 1)),
        )
        .map((d) => ({
          name: d.productName,
          vendorId: d.vendorId,
          productId: d.productId,
        })),
    ),
  );
  const selector = page.getByLabel("Connected keyboard");
  if (await selector.count()) {
    const choices = await selector
      .locator("option")
      .evaluateAll((items) =>
        items
          .filter((o) => o.value)
          .map((o) => ({ id: o.value, name: o.textContent })),
      );
    for (const choice of choices) {
      await selector.selectOption(choice.id);
      const model = page.getByLabel("Keyboard model / PCB");
      await page
        .locator(".busy-indicator")
        .waitFor({ state: "hidden", timeout: 30000 });
      if (await model.count()) {
        const requested = process.env.KEYSTONE_TEST_BOARD;
        if (!requested)
          throw Error(
            "Ambiguous device needs an explicit KEYSTONE_TEST_BOARD for read-only validation.",
          );
        const matches = await model
          .locator("option")
          .evaluateAll(
            (options, requested) =>
              options
                .filter(
                  (o) =>
                    o.value &&
                    o.textContent
                      .toLowerCase()
                      .includes(requested.toLowerCase()),
                )
                .map((o) => ({ value: o.value, name: o.textContent })),
            requested,
          );
        if (matches.length !== 1)
          throw Error(
            "Test board name does not identify exactly one PCB: " + requested,
          );
        await model.selectOption(matches[0].value);
        choice.name = matches[0].name;
      }
      // Embedded Vial definitions can refine the generic USB product name.
      if (!choice.name.startsWith("USB ")) {
        await expect(page.locator("main")).toHaveAttribute(
          "data-keyboard",
          new RegExp(choice.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
        choice.name = await page.locator("main").getAttribute("data-keyboard");
      }
      await expect(page.locator("main")).toHaveAttribute(
        "data-keyboard",
        choice.name,
        { timeout: 30000 },
      );
      await page
        .locator(".busy-indicator")
        .waitFor({ state: "hidden", timeout: 30000 });
      const editable = await page
        .getByRole("navigation")
        .getByRole("button", { name: "Keymap", exact: true })
        .isEnabled();
      if (!editable) throw new Error("Could not load keyboard: " + choice.name);
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Keymap", exact: true })
        .click();
      await page.locator(".keyboard-viewport").waitFor();
      const keyCount = await page.locator(".keycap").count();
      if (choice.name.includes("Pikatea")) {
        await expect(page.locator(".keycap")).toHaveCount(8);
        await expect(page.locator(".keycap.knob")).toHaveCount(1);
        await expect(
          page.getByRole("button", { name: "Unlocked", exact: true }),
        ).toBeDisabled();
        await expect(page.locator(".encoder-control button")).toHaveCount(3);
        await page.screenshot({ path: "artifacts/pikatea-keymap-v5.png" });
      }
      if (choice.name.includes("Thera75")) {
        await expect(page.locator(".encoder-control button")).toHaveCount(3);
        await page.screenshot({ path: "artifacts/thera75-keymap-v5.png" });
      }
      if (choice.name.includes("Glacier80")) {
        await expect(page.locator(".encoder-control")).toHaveCount(0);
        await expect(page.locator("main")).toHaveAttribute(
          "data-keyboard",
          choice.name,
        );
        await page.screenshot({ path: "artifacts/glacier80-keymap-v6.png" });
      }
      if (choice.name === "Wind X R1") {
        await expect(page.locator(".keycap")).toHaveCount(83);
        await expect(page.locator(".encoder-control")).toHaveCount(0);
        await page.screenshot({ path: "artifacts/wind-x-r1-keymap-v6.png" });
      }
      if (choice.name === "NIZ x108") {
        await expect(page.locator(".keycap")).toHaveCount(108);
        await expect(page.locator(".layers button")).toHaveCount(2);
        await page.screenshot({ path: "artifacts/niz-x108-keymap-v7.png" });
      }
      if (choice.name === "Besides Studio M-ONE") {
        await expect(page.locator(".keycap")).toHaveCount(82);
        await expect(page.locator(".layers button")).toHaveCount(1);
        await page.screenshot({ path: "artifacts/mone-keymap-v8.png" });
      }
      const layerCount = await page.locator(".layers button").count();
      if (choice.name === "SP-111") {
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .click();
        await page.getByLabel("Color theme", { exact: true }).click();
        await page.locator('[data-theme-id="hammerhead-dark"]').click();
        await page
          .getByRole("navigation")
          .getByRole("button", { name: "Keymap", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Apply", exact: true }),
        ).toBeDisabled();
        await page.screenshot({
          path: "artifacts/keystone-desktop-keymap-v4.png",
        });
      }
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "Macros", exact: true })
        .click();
      await expect(page.locator(".macro-panel")).toHaveAttribute(
        "aria-busy",
        "false",
        { timeout: 30000 },
      );
      if (await page.getByRole("alert").count())
        throw new Error(await page.getByRole("alert").textContent());
      if (choice.name === "NIZ x108") {
        await expect(
          page.getByLabel("Macro key and layer").locator("option"),
        ).toHaveCount(216);
        console.log("NIZ per-key macro editor verified: 108 keys × 2 layers.");
      }
      console.log(
        "Keyboard read verified:",
        JSON.stringify({
          name: choice.name,
          keyCount,
          layers: layerCount,
          macros:
            choice.name === "NIZ x108"
              ? "per-key"
              : await page.locator(".macro-tabs button").count(),
        }),
      );
    }
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page.getByLabel("Color theme", { exact: true }).click();
  await page.screenshot({ path: "artifacts/theme-menu-v5.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tester", exact: true })
    .click();
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.focus();
    win.emit("app-command", {}, "media-nexttrack");
  });
  await expect(page.locator(".recent-keys")).toContainText("Next");
  console.log("Native media observation bridge verified.");
  for (const nativeFirst of [true, false]) {
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    const native = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].emit(
          "app-command",
          {},
          "media-play-pause",
        ),
      );
    const dom = () =>
      page.evaluate(() => {
        for (const type of ["keydown", "keyup"])
          window.dispatchEvent(
            new KeyboardEvent(type, { code: "MediaPlayPause", bubbles: true }),
          );
      });
    if (nativeFirst) {
      await native();
      await dom();
    } else {
      await dom();
      await native();
    }
    await page.waitForTimeout(220); // Allow both the delayed observation and visual release timers to settle.
    await expect(page.locator(".recent-keys span")).toHaveCount(1);
  }
  console.log(
    "Native/DOM media duplicates suppressed in both delivery orders.",
  );
} finally {
  await app.close();
}
