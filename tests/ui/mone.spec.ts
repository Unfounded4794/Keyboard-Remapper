import { test, expect } from "@playwright/test";
import fs from "node:fs";
const factory = JSON.parse(
  fs.readFileSync(
    new URL("../../src/core/mone-factory.json", import.meta.url),
    "utf8",
  ),
);
import { createFakeMone } from "../helpers/mone-device";
test("M-ONE automatically uses the existing remap and graphical macro workflow", async ({
  page,
}) => {
  await page.addInitScript({
    content: `
    const d=(${createFakeMone.toString()})(${JSON.stringify(factory)});
    window.moneDevice=d;
    const hid=new EventTarget();Object.assign(hid,{getDevices:async()=>[d],requestDevice:async()=>[d]});
    Object.defineProperty(navigator,'hid',{value:hid});
  `,
  });
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute(
    "data-keyboard",
    "Besides Studio M-ONE",
  );
  await expect(page.locator(".keycap")).toHaveCount(82);
  await expect(page.locator(".layers button")).toHaveCount(1);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await expect(page.locator(".layer-action-groups")).toHaveCount(0);
  await expect(page.locator(".keycode-grid")).toContainText("Fn");
  await page.getByTestId("key-mone:31").click();
  await page.getByRole("button", { name: "Basic", exact: true }).click();
  await page
    .locator(".keycode-grid")
    .getByRole("button", { name: "B", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply (1)", exact: true }).click();
  await expect(page.getByTestId("key-mone:31")).toHaveText("B");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await expect(page.locator(".macro-tabs button")).toHaveCount(16);
  await page.getByLabel("Macro timing").selectOption("none");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.keyboard.down("Control");
  await page.keyboard.press("v");
  await page.keyboard.up("Control");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByLabel("Visual actions")).toContainText("V");
  await page
    .getByRole("button", { name: "Save to keyboard", exact: true })
    .click();
  await expect(page.getByLabel("Macro sequence")).toHaveValue(
    "{+KC_LCTL}{1}{+KC_V}{1}{-KC_V}{1}{-KC_LCTL}",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Keymap", exact: true })
    .click();
  await page.getByTestId("key-mone:45").click();
  await page
    .locator(".categories")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await page
    .locator(".keycode-grid")
    .getByRole("button", { name: "Macro 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply (1)", exact: true }).click();
  await expect(page.getByTestId("key-mone:45")).toHaveText("Macro 1");
  const writes = await page.evaluate(
    () =>
      (
        window as unknown as {
          moneDevice: {
            writes: { cmd: number; offset: number; data: number[] }[];
          };
        }
      ).moneDevice.writes,
  );
  expect(writes.filter((w) => w.cmd === 9)).toEqual([
    { cmd: 9, offset: 93, data: [32, 0, 5] },
    { cmd: 9, offset: 135, data: [112, 0, 0] },
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
