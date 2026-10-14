import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.KEYSTONE_TEST_DATA = await fs.mkdtemp(
  path.join(os.tmpdir(), "keystone-selection-"),
);
const app = await electron.launch({
  executablePath: path.resolve(
    process.argv[2] ?? "release/0.3.0/win-unpacked/Keystone.exe",
  ),
  env,
});
try {
  const p = await app.firstWindow();
  await p
    .locator(".busy-indicator")
    .waitFor({ state: "hidden", timeout: 30000 });
  await p.getByLabel("Connected keyboard").selectOption({ label: "SP-111" });
  await p.locator('main[data-keyboard="SP-111"]').waitFor();
  await p
    .locator(".busy-indicator")
    .waitFor({ state: "hidden", timeout: 30000 });
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  const picker = p.getByLabel("Color theme");
  if (await picker.count()) {
    await picker.click();
    await p.locator('[data-theme-id="gateway"]').click();
  } else
    await p
      .getByRole("button", { name: "GMK Gateway theme", exact: true })
      .click();
  await p
    .getByRole("navigation")
    .getByRole("button", { name: "Keymap", exact: true })
    .click();
  const alt = p.locator(".keycap").filter({ hasText: /^RAlt$/ });
  const space = p
    .locator(".keycap")
    .filter({ hasText: /^Space$/ })
    .last();
  for (let i = 0; i < 8; i++) {
    await alt.click();
    await space.click();
  }
  await p.screenshot({ path: "artifacts/selection-repro.png" });
  console.log(
    await alt.evaluate((el) => {
      const s = getComputedStyle(el),
        f = getComputedStyle(el.querySelector(".keyface")),
        v = getComputedStyle(el.querySelector("svg rect,svg path"));
      return {
        classes: el.className,
        outline: s.outline,
        background: s.background,
        shadow: s.boxShadow,
        filter: f.filter,
        fill: v.fill,
        stroke: v.stroke,
      };
    }),
  );
  const box = await alt.boundingBox();
  const capture = await p.screenshot({
    clip: {
      x: box.x - 5,
      y: box.y - 5,
      width: box.width + 10,
      height: box.height + 10,
    },
  });
  console.log(
    "Yellow pixels near deselected key:",
    await p.evaluate(async (data) => {
      const i = new Image();
      i.src = `data:image/png;base64,${data}`;
      await i.decode();
      const c = document.createElement("canvas");
      c.width = i.width;
      c.height = i.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(i, 0, 0);
      const bytes = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let j = 0; j < bytes.length; j += 4)
        if (bytes[j] > 180 && bytes[j + 1] > 170 && bytes[j + 2] < 130) n++;
      return n;
    }, capture.toString("base64")),
  );
} finally {
  await app.close();
}
