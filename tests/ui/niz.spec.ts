import { test, expect } from "@playwright/test";
import { wiredNizPlayback } from "../helpers/niz-playback";
test("NIZ uses the existing connection, keymap and graphical per-key macro controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Hid extends EventTarget {
      opened = false;
      vendorId = 0x0483;
      productId = 0x5230;
      productName = "Program";
      collections = [
        {
          usagePage: 0x8c,
          usage: 1,
          inputReports: [
            { reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] },
          ],
          outputReports: [
            { reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] },
          ],
        },
      ];
      records = Array.from({ length: 216 }, (_, i) => {
        const b = new Uint8Array(64);
        b.set([0, 0xf0, Math.floor(i / 108) + 1, (i % 108) + 1, 0, 1, 43]);
        return b;
      });
      writing: Uint8Array[] = [];
      writes = 0;
      constructor() {
        super();
        this.records[41].fill(0);
        this.records[41].set([
          0, 0xf0, 1, 42, 2, 1, 0, 0, 1, 0, 4, 67, 58, 58, 67,
        ]);
      }
      async open() {
        this.opened = true;
      }
      async close() {
        this.opened = false;
      }
      emit(b: Uint8Array) {
        const e = new Event("inputreport");
        Object.assign(e, { reportId: 0, data: new DataView(b.buffer) });
        this.dispatchEvent(e);
      }
      async sendReport(_id: number, b: Uint8Array) {
        if (b[1] === 0xf9) {
          const r = new Uint8Array(64);
          r[1] = 0xf9;
          r.set(new TextEncoder().encode("X108EC(S);V1.0.22;V1.0;"), 2);
          this.emit(r);
        }
        if (b[1] === 0xf2) {
          this.records.forEach((r) => this.emit(r.slice()));
          this.emit(new Uint8Array(64).fill(0xf6));
        }
        if (b[1] === 0xf1) {
          this.writes++;
          this.writing = [];
        }
        if (b[1] === 0xf0) this.writing.push(b.slice());
        if (b[1] === 0xf6) this.records = this.writing.map((r) => r.slice());
      }
    }
    const d = new Hid();
    Object.assign(window, { nizDevice: d });
    const hid = new EventTarget();
    Object.assign(hid, {
      getDevices: async () => [d],
      requestDevice: async () => [d],
    });
    Object.defineProperty(navigator, "hid", { value: hid });
  });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-keyboard",
    "NIZ x108",
  );
  await expect(page.locator(".keycap")).toHaveCount(108);
  await expect(page.locator(".layers button")).toHaveCount(2);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.locator(".layer-action-groups")).toHaveCount(0);
  await expect(page.locator(".keycode-grid")).toContainText("Right Fn");
  await page.getByTestId("key-niz:42").click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await expect(page.getByLabel("Macro key and layer")).toHaveValue("41");
  await expect(
    page.getByLabel("Macro key and layer").locator("option"),
  ).toHaveCount(216);
  await expect(page.getByLabel("Visual actions").locator("button")).toHaveCount(
    7,
  );
  await page.getByLabel("Macro sequence").fill("{KC_A}");
  await page
    .getByRole("button", { name: "Save to keyboard", exact: true })
    .click();
  await expect(page.locator(".macro-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Macro sequence")).toHaveValue(
    "{+KC_A}{3}{-KC_A}",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { nizDevice: { writes: number } }).nizDevice
          .writes,
    ),
  ).toBe(1);
  await expect(page.getByLabel("Macro key and layer")).toHaveValue("41");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Keymap", exact: true })
    .click();
  await expect(page.getByLabel("Layer 0", { exact: true })).toHaveText("Base");
  await expect(page.getByLabel("Layer 1", { exact: true })).toHaveText("Fn");
  await page.getByLabel("Layer 1", { exact: true }).click();
  await page.getByTestId("key-niz:55").click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await expect(page.getByLabel("Macro key and layer")).toHaveValue("162");
  await expect(
    page.getByLabel("Macro key and layer").locator("option:checked"),
  ).toHaveText("Fn · LShift");
  await page.getByLabel("Macro timing").selectOption("none");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.keyboard.down("Control");
  await page.keyboard.press("v");
  await page.keyboard.up("Control");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page
    .getByRole("button", { name: "Save to keyboard", exact: true })
    .click();
  await expect(page.getByLabel("Macro sequence")).toHaveValue(
    "{+KC_LCTL}{3}{+KC_V}{3}{-KC_V}{3}{-KC_LCTL}",
  );
  const wire = await page.evaluate(() => [
    ...(window as unknown as { nizDevice: { records: Uint8Array[] } }).nizDevice
      .records[162],
  ]);
  expect(wire.slice(2, 4)).toEqual([2, 55]);
  expect(wiredNizPlayback([Uint8Array.from(wire)]).map((f) => f.keys)).toEqual([
    [67],
    [67, 59],
    [67],
    [],
  ]);
});
