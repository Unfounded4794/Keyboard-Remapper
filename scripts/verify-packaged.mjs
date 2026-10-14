// CI launch check with no attached keyboard or configuration writes required.
import { _electron as electron } from "playwright";
import { expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const executable = process.argv[2],
  expectedArch = process.argv[3];
if (!executable)
  throw Error(
    "Usage: npm run test:packaged -- <executable> [expected-architecture]",
  );
const metadata = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const env = {
  ...process.env,
  KEYSTONE_TEST_DATA: await fs.mkdtemp(
    path.join(os.tmpdir(), "keystone-package-"),
  ),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  executablePath: path.resolve(executable),
  env,
  // GitHub's Linux VM restricts Chromium user namespaces; this flag is test-only.
  args: process.env.CI && process.platform === "linux" ? ["--no-sandbox"] : [],
  timeout: 30000,
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".keyboard-viewport").waitFor();
  await page
    .locator(".busy-indicator")
    .waitFor({ state: "hidden", timeout: 30000 });
  const runtime = await app.evaluate(({ app }) => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    appPath: app.getAppPath(),
  }));
  if (
    runtime.version !== metadata.version ||
    (expectedArch && runtime.arch !== expectedArch) ||
    !runtime.appPath.endsWith("app.asar")
  )
    throw Error("Unexpected packaged runtime: " + JSON.stringify(runtime));
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
    throw Error(
      "Packaged renderer capabilities failed: " + JSON.stringify(capabilities),
    );
  const hasCatalog = await page.evaluate(async () =>
    (await window.keystone.definitions(0x5644, 0x5111, 13)).some(
      (d) => d.name === "SP-111",
    ),
  );
  if (!hasCatalog) throw Error("Offline keyboard catalog is missing.");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await expect(page.getByLabel("Color theme", { exact: true })).toBeVisible();
  if (errors.length) throw Error("Renderer errors: " + errors.join("\n"));
  console.log(
    "Packaged launch passed:",
    JSON.stringify({
      version: runtime.version,
      platform: runtime.platform,
      arch: runtime.arch,
      ...capabilities,
    }),
  );
} finally {
  await app.close();
}
