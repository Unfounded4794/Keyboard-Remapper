import { it, expect } from "vitest";
import fs from "node:fs";
import { parseDefinition } from "../../src/core/definitions";
import { macroTokens, macroText } from "../../src/core/macro-visual";
import { compileExpression } from "../../src/core/macro-editor";
import { effectiveTheme } from "../../src/core/themes";
import { shortcutFromEvent, shortcutLabel } from "../../src/core/shortcuts";
import { hostCodeFor } from "../../src/core/languages";
import { KeyboardTester } from "../../src/core/tester";
it("separates Vial encoder legends from duplicate switch coordinates", () => {
  const d = parseDefinition(
    {
      name: "Pikatea",
      vendorId: "0x5049",
      productId: "0x0002",
      matrix: { rows: 1, cols: 8 },
      layouts: {
        keymap: [
          [...Array.from({ length: 7 }, (_, i) => `0,${i}`), "{x:1}", "0,7"],
          ["0,0\n\n\n\n\n\n\n\n\ne", "0,1\n\n\n\n\n\n\n\n\ne"],
        ],
      },
    },
    "vial",
  );
  expect(d.keys.filter((k) => !k.encoder)).toHaveLength(8);
  expect(d.keys.filter((k) => k.encoder).map((k) => k.id)).toEqual([
    "encoder:0:0",
    "encoder:0:1",
  ]);
  expect(d.keys.find((k) => k.id === "0,7")).toMatchObject({ x: 8, knob: 0 });
});
it("parses modern VIA push-and-turn definitions and legacy encoder push labels", () => {
  const d = parseDefinition({
    name: "VIA",
    matrix: { rows: 2, cols: 15 },
    layouts: { keymap: [["1,14\n\n\n\n\n\n\n\n\ne0"]] },
  });
  expect(d.keys).toHaveLength(3);
  expect(d.keys[0].knob).toBe(0);
  const legacy = parseDefinition({
    name: "Legacy",
    matrix: { rows: 2, cols: 15 },
    layouts: { keymap: [["1,14\n\n\n\n\n\n\n\n\ne"]] },
  });
  expect(legacy.keys).toHaveLength(1);
  expect(legacy.keys[0].id).toBe("1,14");
});
it("bundles the official Thera variants with their original virtual turn coordinates", () => {
  const definitions = JSON.parse(
    fs.readFileSync("public/data/vendor-definitions.json", "utf8"),
  )
    .map((d: unknown) => parseDefinition(d))
    .filter((d: { name: string }) =>
      d.name.startsWith("Createkeebs Thera75 V2"),
    );
  expect(definitions).toHaveLength(2);
  for (const d of definitions) {
    expect(d.vendorId).toBe(0xfeed);
    expect(d.productId).toBe(0x6060);
    expect(d.keys.find((k) => k.encoder?.direction === 0)).toMatchObject({
      row: 5,
      col: 13,
      encoder: { virtual: true },
    });
    expect(d.keys.find((k) => k.knob === 0)?.id).toBe("0,14");
  }
});
it("visual macro tokens preserve recording code, escaping, delays and unknown firmware actions exactly", () => {
  const source = "a\\{b\\\\c{+KC_LCTL}{KC_BSPC}{-KC_LCTL}{100}{RAW:1,5,4,2}";
  const tokens = macroTokens(source);
  expect(tokens.map((t) => t.raw).join("")).toBe(source);
  expect(tokens.map((t) => t.kind)).toEqual([
    "text",
    "down",
    "tap",
    "up",
    "delay",
    "raw",
  ]);
  expect(tokens[0].text).toBe("a{b\\c");
  expect(macroText(tokens[0].text!)).toBe(tokens[0].raw);
  expect(compileExpression(tokens.map((t) => t.raw).join(""), "vial")).toEqual(
    compileExpression(source, "vial"),
  );
});
it("visual chord edits keep unrelated raw macro actions unchanged", () => {
  const tokens = macroTokens("hello{KC_LCTL,KC_C}{200}{RAW:1,5,4,2}");
  tokens[1].raw = "{KC_LCTL,KC_V}";
  expect(tokens.map((t) => t.raw).join("")).toBe(
    "hello{KC_LCTL,KC_V}{200}{RAW:1,5,4,2}",
  );
});
it("uses one effective Classic palette for keycaps and light mode previews", () => {
  expect(effectiveTheme("classic", "light").key).toBe("#f3f1eb");
  expect(effectiveTheme("classic", "dark").key).toBe("#303238");
  expect(effectiveTheme("gateway", "light").key).toBe(
    effectiveTheme("gateway", "dark").key,
  );
});
it("matches configurable shortcuts and displays native command labels", () => {
  expect(
    shortcutFromEvent({
      code: "Digit1",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    }),
  ).toBe("Mod+Digit1");
  expect(
    shortcutFromEvent({
      code: "KeyT",
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
      altKey: true,
    }),
  ).toBe("Mod+Alt+Shift+KeyT");
  expect(shortcutLabel("Mod+KeyT", true)).toBe("⌘+T");
  expect(
    shortcutFromEvent({
      code: "KeyT",
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
    }),
  ).toBeUndefined();
});
it("recognizes consumer media events on remapped switches", () => {
  expect(hostCodeFor(0xae)).toBe("MediaPlayPause");
  expect(hostCodeFor(0xab)).toBe("MediaTrackNext");
  expect(hostCodeFor(0xa9)).toBe("AudioVolumeUp");
});
it("native media observations populate recent keys without inventing timing or good cycles", () => {
  const tester = new KeyboardTester();
  for (let i = 0; i < 350; i++) tester.observePulse("MediaTrackNext", i * 20);
  expect(tester.state("MediaTrackNext")).toBe("observed");
  expect(tester.events.at(-1)).toMatchObject({ type: "pulse", press: 350 });
  expect(tester.cycles.size).toBe(0);
  expect(tester.chatter.size).toBe(0);
  expect(tester.held.size).toBe(0);
});
