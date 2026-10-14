import { expect, it } from "vitest";
import { localizedLegend, hostCodeFor } from "../../src/core/languages";
import {
  actionCode,
  layerActionLabel,
  layerModifierCode,
} from "../../src/core/layer-actions";
import { analyzePolling, parseTimestamps } from "../../src/core/polling";
import { KeyboardTester } from "../../src/core/tester";
import { themes, keyColors } from "../../src/core/themes";
import { referenceProfiles } from "../../src/core/theme-profiles";
import { captureKeyIdentities } from "../../src/core/key-identities";
import { testerDefinition } from "../../src/core/layouts";
import { defaultLayers } from "../../src/core/definitions";
import fs from "node:fs";
import { describeKey } from "../../src/core/key-descriptions";
import { byValue } from "../../src/core/keycodes";
it("uses country legends while preserving host HID positions", () => {
  expect(localizedLegend(28, "hu")).toBe("Z");
  expect(localizedLegend(47, "hu")).toBe("Ő");
  expect(localizedLegend(20, "fr")).toBe("A");
  expect(localizedLegend(47, "de")).toBe("Ü");
  expect(localizedLegend(49, "en-GB")).toBe("#");
  expect(hostCodeFor(50)).toBe("Backslash");
  expect(hostCodeFor(0x0416)).toBe("KeyS");
  expect(hostCodeFor(0x412c)).toBe("Space");
});
it("uses current and legacy layer ranges and omits unsupported persistent default", () => {
  expect(actionCode("TO", 2, 9)).toBe(0x5012);
  expect(actionCode("TG", 2, 13)).toBe(0x5262);
  expect(actionCode("PDF", 2, 9)).toBeUndefined();
  expect(actionCode("OSL", 2, 13)).toBe(0x5282);
  expect(actionCode("TT", 2, 13)).toBe(0x52c2);
  expect(layerActionLabel(0x5241, 13)).toBe("DF(1)");
  expect(layerModifierCode(2, 17, 13)).toBe(0x5051);
  expect(layerModifierCode(2, 17, 9)).toBeUndefined();
  expect(layerModifierCode(2, 1, 9)).toBe(0x5921);
});
it("requires 300 clean cycles and lets suspects recover after a new clean run", () => {
  const t = new KeyboardTester();
  for (let i = 0; i < 299; i++) {
    t.ingest("KeyA", "down", i * 200);
    t.ingest("KeyA", "up", i * 200 + 100);
  }
  expect(t.state("KeyA")).toBe("observed");
  t.ingest("KeyA", "down", 59800);
  t.ingest("KeyA", "up", 59900);
  expect(t.state("KeyA")).toBe("good");
  t.ingest("KeyA", "down", 59905);
  expect(t.state("KeyA")).toBe("chatter");
  t.ingest("KeyA", "up", 59950);
  for (let i = 0; i < 299; i++) {
    t.ingest("KeyA", "down", 60100 + i * 200);
    t.ingest("KeyA", "up", 60200 + i * 200);
  }
  expect(t.state("KeyA")).toBe("chatter");
  t.ingest("KeyA", "down", 120000);
  t.ingest("KeyA", "up", 120050);
  expect(t.state("KeyA")).toBe("good");
  expect(t.chatter.get("KeyA")).toBe(1);
  t.ingest("KeyA", "down", 120055);
  expect(t.state("KeyA")).toBe("chatter");
});
it("analyzes actual timestamp cadence with units, gaps and Wireshark CSV", () => {
  const ts = Array.from({ length: 101 }, (_, i) => i / 1000);
  const parsed = parseTimestamps(
    JSON.stringify({ unit: "s", timestamps: ts }),
    "us",
  );
  const r = analyzePolling(parsed);
  expect(r.hz).toBeCloseTo(1000, 6);
  expect(r.durationMs).toBe(100);
  expect(r.p95Ms).toBeCloseTo(1, 6);
  expect(
    parseTimestamps(
      '"No.","frame.time_relative"\n"1","0.001"\n"2","0.002"',
      "ms",
    ),
  ).toEqual([1, 2]);
  const gapped = [...parsed];
  gapped[gapped.length - 1] += 10;
  expect(analyzePolling(gapped).maxMs).toBeCloseTo(11, 6);
  expect(() => analyzePolling(Array(30).fill(0))).toThrow("increase");
  expect(() => analyzePolling([1, 2])).toThrow("20");
  expect(() =>
    parseTimestamps('{"unit":"ns","timestamps":[1,2]}', "ms"),
  ).toThrow("unit");
  expect(() => parseTimestamps("0\nnope", "ms")).toThrow("number");
});
it("includes every requested theme and preserves multi-color legends", () => {
  for (const id of [
    "gateway",
    "midnight-rainbow",
    "awaken",
    "reforged",
    "mictlan",
    "lazurite",
    "great-wave",
    "half-blade",
    "donuts",
    "mizu",
    "stone-age",
    "terror-below",
    "carbon",
    "red-samurai",
    "hammerhead-dark",
    "deku",
    "mecha-01",
    "basin",
    "black-panther",
    "fuji",
    "wavez",
    "hero",
  ])
    expect(themes.some((t) => t.id === id)).toBe(true);
  expect(keyColors("midnight-rainbow", 98)?.text).toBe("#e48731");
  expect(keyColors("midnight-rainbow", 39)?.text).toBe("#3476cf");
  expect(keyColors("great-wave", 4)?.cap).not.toBe(
    keyColors("great-wave", 15)?.cap,
  );
  expect(keyColors("gateway", 40)?.cap).toBe("#368fc5");
  expect(keyColors("gateway", 88)?.cap).toBe("#f47e25");
  expect(keyColors("lazurite", 4)?.cap).toBe("#164e9b");
  expect(keyColors("lazurite", 40)?.cap).toBe("#cdd1d5");
  expect(keyColors("mictlan", 98)?.text).toBe("#42b4b1");
  for (const p of referenceProfiles) {
    expect(fs.existsSync(`reference images/${p.source}`)).toBe(true);
    for (const c of [p.alpha, p.modifier, p.accent, ...Object.values(p.keys)]) {
      expect(c.cap).toMatch(/^#[\da-f]{6}$/i);
      expect(c.text).toMatch(/^#[\da-f]{3,6}$/i);
    }
  }
  expect(describeKey(byValue.get(31747)!).description).toContain(
    "Reset persistent",
  );
});
it("preserves cap identities across remaps and recognizes an already-remapped Caps key", () => {
  const d = testerDefinition(),
    layers = defaultLayers(d, 1);
  const cap = d.keys.find((k) => k.defaultCode === 57)!;
  // Real VIA definitions don't carry defaultCode, unlike the manual tester.
  const raw = { ...d, keys: d.keys.map(({ defaultCode, ...k }) => k) };
  layers[0][cap.id] = 0x7700;
  const captured = captureKeyIdentities(raw, layers);
  expect(captured.keys.find((k) => k.id === cap.id)?.themeCode).toBe(57);
  const a = captured.keys.find((k) => k.themeCode === 4)!;
  layers[0][a.id] = 41;
  expect(
    captureKeyIdentities(captured, layers).keys.find((k) => k.id === a.id)
      ?.themeCode,
  ).toBe(4);
  expect(
    captureKeyIdentities(raw, layers, { [a.id]: 4 }).keys.find(
      (k) => k.id === a.id,
    )?.themeCode,
  ).toBe(4);
});
