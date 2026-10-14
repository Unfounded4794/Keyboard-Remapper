import { test, expect, type Page } from "@playwright/test";
async function chooseTheme(page: Page, id: string) {
  const picker = page.getByLabel("Color theme", { exact: true });
  if ((await picker.getAttribute("aria-expanded")) !== "true")
    await picker.click();
  await page.locator(`[role="option"][data-theme-id="${id}"]`).click();
}
async function hardware(page: Page, count = 1, unknown = false, vial = false) {
  await page.addInitScript(
    ({ count, unknown, vial }) => {
      class Hid extends EventTarget {
        opened = false;
        vendorId = vial ? 0x5049 : unknown ? 0xfafa : 0x5644;
        productId = vial ? 2 : unknown ? 0x1bad : 0x5111;
        productName = vial ? "Pikatea" : unknown ? "Unlisted" : "SP-111";
        unlocked = false;
        polls = 0;
        matrixReads = 0;
        collections = [
          {
            usagePage: 0xff60,
            usage: 0x61,
            inputReports: [
              { reportId: 0, items: [{ reportSize: 8, reportCount: 32 }] },
            ],
            outputReports: [
              { reportId: 0, items: [{ reportSize: 8, reportCount: 32 }] },
            ],
          },
        ];
        map = new Map();
        macros = new Uint8Array(179);
        options = 0;
        writes: number[] = [];
        async open() {
          this.opened = true;
        }
        async close() {
          this.opened = false;
        }
        async sendReport(_id: number, packet: Uint8Array) {
          const d = packet.slice();
          if ([3, 5, 15].includes(d[0])) this.writes.push(d[0]);
          switch (d[0]) {
            case 1:
              d[1] = 0;
              d[2] = 13;
              break;
            case 0xfe:
              if (!vial) d[0] = 255;
              else if (d[1] === 0) {
                d.fill(0);
                d[0] = 4;
              } else if (d[1] === 1) {
                d.fill(0);
                d[0] = 32;
              } else if (d[1] === 2) d.fill(0);
              else if (d[1] === 3) {
                const ccw = this.map.get(`e:${d[2]}:${d[3]}:0`) ?? 0xa9,
                  cw = this.map.get(`e:${d[2]}:${d[3]}:1`) ?? 0xaa;
                d.set([ccw >> 8, ccw & 255, cw >> 8, cw & 255]);
              } else if (d[1] === 4) {
                this.writes.push(254);
                this.map.set(`e:${d[2]}:${d[3]}:${d[4]}`, d[5] * 256 + d[6]);
              } else if (d[1] === 5) {
                d.fill(255);
                d.set([this.unlocked ? 1 : 0, 0, 0, 0, 0, 7]);
              } else if (d[1] === 6) this.polls = 0;
              else if (d[1] === 7) {
                if (++this.polls >= 2) this.unlocked = true;
                d.set([
                  this.unlocked ? 1 : 0,
                  this.unlocked ? 0 : 1,
                  this.unlocked ? 0 : 25,
                ]);
              }
              break;
            case 0x11:
              d[1] = vial ? 3 : 2;
              break;
            case 0xc:
              d[1] = 4;
              break;
            case 0xd:
              d[1] = 0;
              d[2] = 179;
              break;
            case 4: {
              this.matrixReads++;
              const c = this.map.get(`${d[1]}:${d[2]},${d[3]}`) ?? 4;
              d[4] = c >> 8;
              d[5] = c & 255;
              break;
            }
            case 5:
              this.map.set(`${d[1]}:${d[2]},${d[3]}`, d[4] * 256 + d[5]);
              break;
            case 2:
              if (d[1] === 2) new DataView(d.buffer).setUint32(2, this.options);
              break;
            case 3:
              this.options = new DataView(d.buffer).getUint32(2);
              break;
            case 0xe: {
              const o = d[1] * 256 + d[2];
              d.set(this.macros.slice(o, o + d[3]), 4);
              break;
            }
            case 0xf: {
              const o = d[1] * 256 + d[2];
              this.macros.set(d.slice(4, 4 + d[3]), o);
              break;
            }
          }
          queueMicrotask(() => {
            const e = new Event("inputreport");
            Object.assign(e, { reportId: 0, data: new DataView(d.buffer) });
            this.dispatchEvent(e);
          });
        }
      }
      const devices = Array.from({ length: count }, (_, i) => {
        const d = new Hid();
        if (i) {
          d.vendorId = 0xcafe;
          d.productId = 0x10 + i;
          d.productName = i === 1 ? "Second keyboard" : "Third keyboard";
          d.macros[0] = 65 + i;
        }
        return d;
      });
      if (vial)
        window.keystone = {
          desktop: true,
          decompress: async () =>
            JSON.stringify({
              name: "Pikatea Macropad GB3",
              vendorId: "0x5049",
              productId: "0x0002",
              matrix: { rows: 1, cols: 8 },
              layouts: {
                keymap: [
                  [
                    ...Array.from({ length: 7 }, (_, i) => `0,${i}`),
                    "{x:1}",
                    "0,7",
                  ],
                  ["0,0\n\n\n\n\n\n\n\n\ne", "0,1\n\n\n\n\n\n\n\n\ne"],
                ],
              },
            }),
        };
      if (count > 1)
        localStorage.setItem(
          "keystone.definitions",
          JSON.stringify(
            devices.slice(1).map((d) => ({
              name: d.productName,
              vendorId: d.vendorId,
              productId: d.productId,
              matrix: { rows: 1, cols: 2 },
              layouts: { keymap: [["0,0", "0,1"]] },
            })),
          ),
        );
      Object.defineProperty(navigator, "hid", {
        value: Object.assign(new EventTarget(), {
          getDevices: async () => devices,
          requestDevice: async () => [devices[0]],
        }),
        configurable: true,
      });
    },
    { count, unknown, vial },
  );
}
test("layout choices are immediate, close outside, persist, and never write firmware options", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  const apply = page.getByRole("button", { name: "Apply", exact: true });
  await expect(apply).toBeVisible();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  const option = page.locator(".layout-popover select").first();
  await option.selectOption("1");
  await expect(apply).toBeDisabled();
  await page.locator(".board-panel").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".layout-popover")).toHaveCount(0);
  await page.reload();
  await expect(apply).toBeVisible();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await expect(page.locator(".layout-popover select").first()).toHaveValue("1");
  expect(
    await page.evaluate(
      async () => (await navigator.hid.getDevices())[0].writes,
    ),
  ).toEqual([]);
});

test("cancel discards all remaps", async ({ page }) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  const key = page.locator(".keycap").first();
  await key.click();
  const boardBefore = await page.locator(".board-panel").boundingBox();
  await page
    .locator(".keycode-grid")
    .getByRole("button", { name: "B", exact: true })
    .click();
  expect((await page.locator(".board-panel").boundingBox())!.y).toBe(
    boardBefore!.y,
  );
  await page.getByRole("button", { name: "Layer 1", exact: true }).click();
  await key.click();
  await page
    .locator(".keycode-grid")
    .getByRole("button", { name: "C", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply (2)", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await expect(key).toContainText("A");
  await page.getByRole("button", { name: "Layer 0", exact: true }).click();
  await expect(key).toContainText("A");
  expect(
    await page.evaluate(
      async () => (await navigator.hid.getDevices())[0].writes,
    ),
  ).toEqual([]);
});

test("country legends change and ISO chatter is visibly red", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Tester enter layout").selectOption("1");
  await page.getByLabel("Legend language").selectOption("hu");
  await expect(page.getByTestId("key-2,11")).toContainText("Ő");
  await page.evaluate(() => {
    for (const type of ["keydown", "keyup", "keydown", "keyup"])
      window.dispatchEvent(
        new KeyboardEvent(type, { code: "Backslash", bubbles: true }),
      );
  });
  const red = page.locator('.keycap[data-state="chatter"]');
  await expect(red).toHaveCount(1);
  await expect(red.locator("svg path,svg rect")).toHaveCSS(
    "fill",
    "rgb(239, 117, 128)",
  );
  await expect(page.locator(".chatter-results")).toContainText(
    "fast re-presses",
  );
});

test("selection restores the theme color and scroll width stays stable", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await chooseTheme(page, "hammerhead-dark");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Keymap", exact: true })
    .click();
  const key = page.locator(".keycap").first(),
    shape = key.locator("svg path,svg rect");
  const before = await shape.evaluate((el) => getComputedStyle(el).fill),
    width = await page.locator(".content").evaluate((el) => el.clientWidth);
  await key.click();
  await key.click();
  expect(await shape.evaluate((el) => getComputedStyle(el).fill)).toBe(before);
  await page
    .locator(".categories")
    .getByRole("button", { name: "Special", exact: true })
    .click();
  expect(await page.locator(".content").evaluate((el) => el.clientWidth)).toBe(
    width,
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    await page.evaluate(() => innerHeight),
  );
  const reset = page.locator('.palette-key[title*="Reset persistent"]');
  await expect(reset).toBeVisible();
  await reset.hover();
  await expect(page.locator(".key-help")).toContainText(
    "Reset persistent keyboard settings",
  );
});

test("physical highlighting explains absent matrix data and falls back", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(page.getByLabel("Key highlight source")).toBeVisible();
  await page.getByLabel("Key highlight source").selectOption("matrix");
  await expect(page.locator(".matrix-status")).toContainText("Press a key");
  await page.locator(".board-panel").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("a");
  await expect(page.getByLabel("Key highlight source")).toHaveValue("events", {
    timeout: 7000,
  });
  await expect(page.locator(".matrix-status")).toContainText(
    "No physical switch data",
  );
});

test("layer actions assign real codes and labels fit inside key shapes", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await page.locator(".keycap").first().click();
  await page
    .locator(".categories")
    .getByRole("button", { name: "Layers", exact: true })
    .click();
  for (const action of ["MO", "TG", "TO", "DF", "OSL", "TT", "PDF"])
    await expect(
      page.getByRole("button", { name: `${action}(1)`, exact: true }),
    ).toBeVisible();
  await page.getByRole("button", { name: "TG(1)", exact: true }).click();
  await expect(page.locator(".keycap").first()).toContainText("TG(1)");
  await page.setViewportSize({ width: 1050, height: 760 });
  const overflows = await page.locator(".key-label").evaluateAll(
    (els) =>
      els.filter((el) => {
        const a = el.getBoundingClientRect(),
          b = el.querySelector("span")!.getBoundingClientRect();
        return (
          b.left < a.left - 1 ||
          b.right > a.right + 1 ||
          b.top < a.top - 1 ||
          b.bottom > a.bottom + 1
        );
      }).length,
  );
  expect(overflows).toBe(0);
});

test("USB capture import reports measured cadence and default is 300 cycles", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".test-legend")).toContainText("300+");
  await page.getByLabel("USB capture file").setInputFiles({
    name: "reports.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        unit: "ms",
        timestamps: Array.from({ length: 101 }, (_, i) => i),
      }),
    ),
  });
  await expect(page.getByLabel("USB polling tester")).toContainText("1,000 Hz");
  await expect(page.getByLabel("USB polling tester")).toContainText(
    "1.000 ms median",
  );
});

test("new selections clear the previous key's paint and filtered highlight", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  const a = page.locator(".keycap").nth(1),
    b = page.locator(".keycap").nth(2);
  const fill = await a
    .locator("svg rect,svg path")
    .evaluate((el) => getComputedStyle(el).fill);
  for (let i = 0; i < 5; i++) {
    await a.click();
    await b.click();
    await expect(a).not.toHaveClass(/selected/);
    await expect(a.locator("svg rect,svg path")).toHaveCSS("fill", fill);
    await expect(a.locator(".keyface")).toHaveCSS("filter", "none");
  }
  await expect(page.locator(".keycap.selected")).toHaveCount(1);
});

test("binary layout switches and compact theme picker", async ({ page }) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Layout", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  const toggle = page.getByRole("switch").first();
  await expect(toggle).toBeVisible();
  const checked = await toggle.isChecked();
  await toggle.click();
  expect(await toggle.isChecked()).toBe(!checked);
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Color theme", { exact: true }).click();
  await expect(
    page.getByRole("listbox", { name: "Color themes" }).getByRole("option"),
  ).toHaveCount(29);
  await expect(page.locator(".theme-grid")).toHaveCount(0);
  await chooseTheme(page, "hero");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Color theme", { exact: true })).toContainText(
    "GMK Hero",
  );
});

test("recent press colors stay alternating when the rolling window advances", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    for (let i = 0; i < 25; i++)
      for (const type of ["keydown", "keyup"])
        window.dispatchEvent(
          new KeyboardEvent(type, { code: "KeyA", bubbles: true }),
        );
  });
  const chips = page.locator(".recent-keys span");
  await expect(chips).toHaveCount(25);
  const rows = await chips.evaluateAll((els) =>
    els.map((el) => ({
      press: Number(el.getAttribute("data-press")),
      color: getComputedStyle(el).backgroundColor,
    })),
  );
  expect(rows[0].press).toBe(1);
  expect(rows.at(-1)!.press).toBe(25);
  for (let i = 1; i < rows.length; i++) {
    expect(rows[i].press).toBe(rows[i - 1].press + 1);
    expect(rows[i].color).not.toBe(rows[i - 1].color);
  }
});

test("a suspect recovers to good after the clean threshold", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Good test count").selectOption("10");
  await page.getByRole("button", { name: "Tester", exact: true }).click();
  await page.evaluate(() => {
    const original = performance.now;
    let at = 0;
    performance.now = () => at;
    try {
      for (const [type, time] of [
        ["keydown", 0],
        ["keyup", 10],
        ["keydown", 15],
        ["keyup", 25],
      ] as const) {
        at = time;
        window.dispatchEvent(
          new KeyboardEvent(type, { code: "KeyA", bubbles: true }),
        );
      }
    } finally {
      performance.now = original;
    }
  });
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "chatter",
  );
  await page.evaluate(() => {
    const original = performance.now;
    let at = 1000;
    performance.now = () => at;
    try {
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { code: "KeyA", bubbles: true }),
        );
        at += 50;
        window.dispatchEvent(
          new KeyboardEvent("keyup", { code: "KeyA", bubbles: true }),
        );
        at += 100;
      }
    } finally {
      performance.now = original;
    }
  });
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "good",
  );
  await expect(page.locator(".test-summary")).toContainText(
    "0 suspected chatter",
  );
});

test("reference colors follow key identities on the full-size layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await chooseTheme(page, "midnight-rainbow");
  await page.getByRole("button", { name: "Tester", exact: true }).click();
  const numZero = page.locator('.keycap[data-theme-code="98"]');
  await expect(numZero.locator(".key-label")).toHaveCSS(
    "color",
    "rgb(228, 135, 49)",
  );
  const zero = page.locator('.keycap[data-theme-code="39"]');
  await expect(zero.locator(".key-label")).toHaveCSS(
    "color",
    "rgb(52, 118, 207)",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await chooseTheme(page, "gateway");
  await page.getByRole("button", { name: "Tester", exact: true }).click();
  await expect(
    page.locator('.keycap[data-theme-code="40"] svg rect'),
  ).toHaveCSS("fill", "rgb(54, 143, 197)");
  await expect(
    page.locator('.keycap[data-theme-code="88"] svg rect'),
  ).toHaveCSS("fill", "rgb(244, 126, 37)");
});

test("disconnected defaults to immediate full-size testing without clutter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Tester keyboard layout")).toHaveValue("100%");
  await expect(page.locator(".keycap")).toHaveCount(104);
  for (const name of ["Keymap", "Macros"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Actuation", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("h1,header")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Start test|Export|Import definition/ }),
  ).toHaveCount(0);
  await page.keyboard.down("a");
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "held",
  );
  await page.keyboard.up("a");
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "observed",
  );
});
test("tester supports notched ISO Enter, Tsangan, good and chatter states", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Tester enter layout").selectOption("1");
  await expect(page.locator(".keycap")).toHaveCount(105);
  await expect(page.getByTestId("key-3,12").locator("svg path")).toHaveCount(1);
  await page.getByLabel("Tester bottom row").selectOption("1");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Good test count").selectOption("10");
  await page.getByRole("button", { name: "Tester", exact: true }).click();
  await page.locator(".board-panel").click({ position: { x: 10, y: 10 } });
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("a");
    await page.waitForTimeout(60);
  }
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "good",
  );
  await page.evaluate(() => {
    for (const type of ["keydown", "keyup", "keydown", "keyup"])
      window.dispatchEvent(
        new KeyboardEvent(type, { code: "KeyS", key: "s", bubbles: true }),
      );
  });
  await expect(page.getByTestId("key-3,2")).toHaveAttribute(
    "data-state",
    "chatter",
  );
  await expect(page.locator(".chatter-results")).toContainText("S");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("key-3,1")).toHaveAttribute(
    "data-state",
    "untested",
  );
});
test("recognizes SP-111 offline and switches three connected boards", async ({
  page,
}) => {
  await hardware(page, 3);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Connected keyboard").locator("option"),
  ).toHaveCount(4);
  await page
    .getByLabel("Connected keyboard")
    .selectOption({ label: "Second keyboard" });
  await expect(page.locator(".keycap")).toHaveCount(2);
  await page
    .getByLabel("Connected keyboard")
    .selectOption({ label: "Third keyboard" });
  await expect(page.locator(".keycap")).toHaveCount(2);
});
test("remaps keys, deselects keys, expands Special and uses square options", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await page.locator(".keycap").first().click();
  await page
    .locator(".keycode-grid")
    .getByRole("button", { name: "B", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply (1)", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved to keyboard");
  await page.locator(".keycap").first().click();
  await expect(page.locator(".keycap.selected")).toHaveCount(0);
  await page
    .locator(".categories")
    .getByRole("button", { name: "Special", exact: true })
    .click();
  expect(await page.locator(".palette-key").count()).toBeGreaterThan(70);
  const r = await page.locator(".palette-key").first().boundingBox();
  expect(r!.width).toBe(r!.height);
  await page.keyboard.press("Escape");
  await expect(page.locator(".keycap.pressed")).toHaveCount(0);
});
test("macro recording supports no delay and fixed delay, saves to hardware and reloads", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Macros", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Macro 1", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Macro timing").selectOption("none");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Macro sequence")).toHaveValue(
    "{+KC_LCTL}{+KC_A}{-KC_A}{-KC_LCTL}",
  );
  await page.getByLabel("Macro timing").selectOption("fixed");
  await page.getByLabel("Fixed macro delay").fill("25");
  const expected = "{+KC_LCTL}{25}{+KC_A}{25}{-KC_A}{25}{-KC_LCTL}";
  await expect(page.getByLabel("Macro sequence")).toHaveValue(expected);
  await page
    .getByRole("button", { name: "Save to keyboard", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved to keyboard");
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect(page.getByLabel("Macro sequence")).toHaveValue(expected);
  await expect(page.getByText(/slots|bytes total|slot M0/)).toHaveCount(0);
});
test("definition help toggles closed and themes / light mode persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const help = page.getByRole("button", {
    name: "Definition information",
    exact: true,
  });
  await help.click();
  await expect(page.locator(".help-popover")).toBeVisible();
  await help.click();
  await expect(page.locator(".help-popover")).toHaveCount(0);
  await chooseTheme(page, "greg");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "greg");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
});
test("custom definitions are retained on reconnect", async ({ page }) => {
  await hardware(page, 1, true);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Definition not found");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "custom.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        name: "Custom board",
        vendorId: 0xfafa,
        productId: 0x1bad,
        matrix: { rows: 1, cols: 2 },
        layouts: { keymap: [["0,0", "0,1"]] },
      }),
    ),
  });
  await expect(
    page.getByRole("button", { name: "Keymap", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
});
test("offline compact tester preview", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5173")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await page.locator(".keycap").first().waitFor();
  await page.screenshot({
    path: "artifacts/keystone-tester-v2.png",
    fullPage: true,
  });
  expect(external).toEqual([]);
});
test("connected editor and macro previews", async ({ page }) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/keystone-keymap-v2.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await page.getByRole("button", { name: "Macro 1", exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/keystone-macros-v2.png",
    fullPage: true,
  });
});
test("switching boards on the macro page loads that board’s memory automatically", async ({
  page,
}) => {
  await hardware(page, 3);
  await page.goto("/");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Macros", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  await expect(page.locator(".macro-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page
    .getByLabel("Connected keyboard")
    .selectOption({ label: "Second keyboard" });
  await expect(page.locator("main")).toHaveAttribute(
    "data-keyboard",
    "Second keyboard",
  );
  await expect(page.locator(".macro-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Macro sequence")).toHaveValue("B");
  await page
    .getByLabel("Connected keyboard")
    .selectOption({ label: "Third keyboard" });
  await expect(page.locator(".macro-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Macro sequence")).toHaveValue("C");
});

test("three-layer actions stay on one row and helper text clears on leave and category changes", async ({
  page,
}) => {
  await hardware(page, 1, false, true);
  await page.goto("/");
  await page.getByTestId("key-0,0").click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  for (const row of await page.locator(".layer-action-row").all()) {
    const boxes = await row
      .locator("button")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(new Set(boxes.map((x) => Math.round(x))).size).toBe(1);
  }
  await page.getByRole("button", { name: "MO(2)", exact: true }).hover();
  await expect(page.locator(".key-help")).not.toBeEmpty();
  await page.locator(".board-panel").hover({ position: { x: 5, y: 5 } });
  await expect(page.locator(".key-help")).toBeEmpty();
  await page.getByRole("button", { name: "MO(2)", exact: true }).hover();
  await page.getByRole("button", { name: "Special", exact: true }).click();
  await expect(page.locator(".key-help")).toBeEmpty();
  await expect(
    page.getByRole("button", { name: "▽", exact: true }),
  ).toBeVisible();
});

test("Vial unlock state is verified and encoder turns use encoder commands", async ({
  page,
}) => {
  await hardware(page, 1, false, true);
  await page.goto("/");
  await expect(page.locator(".keycap")).toHaveCount(8);
  await expect(page.locator(".keycap.knob")).toHaveCount(1);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unlocked", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".keycap.unlock")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Knob 1 clockwise", exact: true })
    .click();
  await page.getByRole("button", { name: "Z", exact: true }).click();
  await page.getByRole("button", { name: /^Apply/ }).click();
  await expect(
    page.getByRole("button", { name: "Knob 1 clockwise", exact: true }),
  ).toContainText("Z");
  const writes = await page.evaluate(
    async () =>
      ((await navigator.hid.getDevices())[0] as unknown as { writes: number[] })
        .writes,
  );
  expect(writes).toContain(254);
  expect(writes).not.toContain(5);
});

test("visual macro actions edit chords, delays and order without altering raw firmware actions", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Macros", exact: true })
    .click();
  const code = page.getByLabel("Macro sequence", { exact: true });
  await expect(code).toBeEditable();
  await code.fill("{+KC_LCTL}{KC_BSPC}{-KC_LCTL}{100}{RAW:1,5,4,2}");
  await expect(page.locator(".macro-token")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Action 2: tap Bksp", exact: true })
    .click();
  await page.getByLabel("Search macro keys").fill("KC_C");
  await page
    .locator(".macro-key-palette")
    .getByRole("button", { name: "C", exact: true })
    .click();
  await expect(code).toHaveValue(
    "{+KC_LCTL}{KC_C}{-KC_LCTL}{100}{RAW:1,5,4,2}",
  );
  await page
    .getByRole("button", { name: "Action 4: delay 100", exact: true })
    .click();
  await page.getByLabel("Action delay").fill("250");
  await page.getByLabel("Move action left").click();
  await expect(code).toHaveValue(
    "{+KC_LCTL}{KC_C}{250}{-KC_LCTL}{RAW:1,5,4,2}",
  );
  await page.getByLabel("Delete action").click();
  await expect(code).toHaveValue("{+KC_LCTL}{KC_C}{-KC_LCTL}{RAW:1,5,4,2}");
});

test("tab shortcuts are configurable, persistent, conflict checked, and ignored during typing", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".busy-indicator")).toHaveCount(0);
  await page.keyboard.press("Control+Digit2");
  await expect(
    page.getByLabel("Macro sequence", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".macro-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByLabel("Macro sequence", { exact: true }).focus();
  await page.keyboard.press("Control+Digit3");
  await expect(
    page.getByLabel("Macro sequence", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Macro sequence", { exact: true }).blur();
  await page.keyboard.press("Control+Comma");
  await page.getByLabel("tester shortcut").click();
  await page.keyboard.press("Control+KeyT");
  await expect(page.getByLabel("tester shortcut")).toHaveText("Ctrl+T");
  await page.keyboard.press("Control+KeyT");
  await expect(page.locator(".test-summary")).toBeVisible();
  await page.keyboard.press("Control+Comma");
  await page.getByLabel("macros shortcut").click();
  await page.keyboard.press("Control+KeyT");
  await expect(page.getByRole("alert")).toContainText("already assigned");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".busy-indicator")).toHaveCount(0);
  await page.keyboard.press("Control+KeyT");
  await expect(page.locator(".test-summary")).toBeVisible();
});

test("light Classic swatches match keycaps and the keyboard case becomes light", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  const swatches = page.locator(".theme-picker > button .theme-swatches i");
  expect(
    await swatches.first().evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(243, 241, 235)");
  const heights = await page
    .locator(".setting-row")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(new Set(heights).size).toBe(1);
  await page.getByRole("button", { name: "Tester", exact: true }).click();
  expect(
    await page
      .locator(".keyboard-case")
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(231, 232, 229)");
  await page.keyboard.down("a");
  await expect(page.locator(".keycap.pressed")).toHaveCount(1);
  expect(
    await page
      .locator(".keycap.pressed rect")
      .evaluate((e) => getComputedStyle(e).fill),
  ).toBe("rgb(115, 119, 115)");
});

test("recent keys use fixed centered tiles across the full available row", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    for (let i = 0; i < 90; i++)
      for (const type of ["keydown", "keyup"])
        window.dispatchEvent(
          new KeyboardEvent(type, {
            code: i % 2 ? "Space" : "KeyA",
            bubbles: true,
          }),
        );
  });
  const row = page.locator(".recent-keys");
  await expect(row.locator("span")).toHaveCount(90);
  const metrics = await row.evaluate((e) => ({
    width: e.clientWidth,
    scroll: e.scrollWidth,
    left: e.scrollLeft,
    tiles: [...e.children].map((c) => ({
      w: c.getBoundingClientRect().width,
      align: getComputedStyle(c).alignItems,
      justify: getComputedStyle(c).justifyContent,
    })),
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.width);
  expect(metrics.left).toBeGreaterThan(0);
  expect(new Set(metrics.tiles.map((t) => t.w)).size).toBe(1);
  expect(
    metrics.tiles.every((t) => t.align === "center" && t.justify === "center"),
  ).toBe(true);
});

test("consumer media events highlight assigned keys in Keymap and Tester", async ({
  page,
}) => {
  await hardware(page);
  await page.goto("/");
  await page.getByTestId("key-0,0").click();
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "MediaPlayPause", bubbles: true }),
    ),
  );
  await expect(page.getByTestId("key-0,0")).toHaveClass(/pressed/);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keyup", { code: "MediaPlayPause", bubbles: true }),
    ),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tester", exact: true })
    .click();
  await page.evaluate(() => {
    for (const type of ["keydown", "keyup"])
      window.dispatchEvent(
        new KeyboardEvent(type, { code: "MediaPlayPause", bubbles: true }),
      );
  });
  await expect(page.getByTestId("key-0,0")).toHaveAttribute(
    "data-state",
    "observed",
  );
  await expect(page.locator(".recent-keys")).toContainText("Play");
});

async function sharedUsbBoard(page: Page, stableIdentity = true) {
  await hardware(page);
  await page.addInitScript(
    ({ stableIdentity }) => {
      navigator.hid.getDevices().then((devices) => {
        const d = devices[0];
        Object.assign(d, {
          vendorId: 0xfeed,
          productId: 0x6060,
          productName: "keyboard",
        });
        window.keystone = {
          desktop: true,
          decompress: async () => "",
          keyboardIdentity: async () =>
            stableIdentity ? "verified-device-serial-hash" : null,
        };
      });
    },
    { stableIdentity },
  );
}

test("shared USB IDs require a PCB choice before keymap reads and remember a unique device", async ({
  page,
}) => {
  await sharedUsbBoard(page);
  await page.goto("/");
  const choice = page.getByLabel("Keyboard model / PCB");
  await expect(choice).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Keymap", exact: true }),
  ).toBeDisabled();
  const reads = await page.evaluate(
    async () =>
      (
        (await navigator.hid.getDevices())[0] as unknown as {
          matrixReads: number;
        }
      ).matrixReads,
  );
  expect(reads).toBe(0);
  await choice.selectOption({
    label: "Createkeebs Glacier80 (Hotswap / Solder)",
  });
  await expect(page.locator("main")).toHaveAttribute(
    "data-keyboard",
    "Createkeebs Glacier80 (Hotswap / Solder)",
  );
  await expect(page.locator(".keycap")).toHaveCount(88);
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".keycap")).toHaveCount(88);
  await expect(choice).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const definition = page.getByLabel("Keyboard definition");
  const selected = await definition.inputValue();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Keymap", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(definition).toHaveValue(selected);
});

test("a generic device without a unique serial never remembers a shared VID/PID as a model", async ({
  page,
}) => {
  await sharedUsbBoard(page, false);
  await page.goto("/");
  const choice = page.getByLabel("Keyboard model / PCB");
  await choice.selectOption({
    label: "Createkeebs Glacier80 (Hotswap / Solder)",
  });
  await expect(page.locator(".keycap")).toHaveCount(88);
  const stored = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      k.startsWith("keystone.definition."),
    ),
  );
  expect(stored).toEqual([]);
  await page.reload();
  await expect(choice).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Keymap", exact: true }),
  ).toBeDisabled();
});
