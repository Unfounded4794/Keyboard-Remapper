import fs from "node:fs";
import { it, expect } from "vitest";
import { parseDefinition, visibleKeys } from "../../src/core/definitions";
import { testerDefinition } from "../../src/core/layouts";
import { keyGeometry } from "../../src/core/geometry";
import {
  compileExpression,
  decodeExpression,
  recordedExpression,
} from "../../src/core/macro-editor";
import { KeyboardTester } from "../../src/core/tester";
const catalog = JSON.parse(
  fs.readFileSync("public/data/via-definitions.json", "utf8"),
);
it("includes an offline SP-111 definition and thousands of other boards", () => {
  expect(catalog.count).toBeGreaterThan(3500);
  const d = catalog.entries.find((e: any) => /sp111\.json$/.test(e.path));
  expect(parseDefinition(d.definition).name).toMatch(/SP-111/i);
});
it("validates the bundled board geometry", () => {
  const failures: string[] = [];
  for (const e of catalog.entries)
    try {
      parseDefinition(e.definition);
    } catch (error) {
      failures.push(`${e.path}: ${error}`);
    }
  expect(failures).toEqual([]);
});
it("has 104 ANSI keys and a proper notched ISO Enter", () => {
  const d = testerDefinition();
  expect(visibleKeys(d, [0, 0, 0])).toHaveLength(104);
  expect(visibleKeys(d, [1, 0, 0])).toHaveLength(105);
  const enter = visibleKeys(d, [1, 0, 0]).find((k) => k.defaultCode === 40)!;
  expect(enter).toMatchObject({ w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 });
  const g = keyGeometry(enter);
  expect(g.width).toBe(1.5);
  expect(g.height).toBe(2);
  expect(g.path.split("L").length).toBeGreaterThan(4);
});
it("round trips existing macro text and supports fixed / zero-delay recording", () => {
  for (const format of ["via", "vial", "legacy"] as const) {
    const text = "hello{KC_A}{+KC_LCTL}{-KC_LCTL}";
    expect(
      compileExpression(
        decodeExpression(compileExpression(text, format), format),
        format,
      ),
    ).toEqual(compileExpression(text, format));
  }
  const events = [
    { type: "down" as const, code: "KeyA", keycode: 4, at: 100 },
    { type: "up" as const, code: "KeyA", keycode: 4, at: 250 },
  ];
  expect(recordedExpression(events, "none", 50)).toBe("{+KC_A}{-KC_A}");
  expect(recordedExpression(events, "fixed", 50)).toBe("{+KC_A}{50}{-KC_A}");
  expect(compileExpression("{100}{KC_A}", "via")).toEqual([
    1, 4, 49, 48, 48, 124, 1, 1, 4, 0,
  ]);
});
it("marks completed repeated tests good and preserves chatter evidence", () => {
  const t = new KeyboardTester();
  for (let i = 0; i < 5; i++) {
    t.ingest("KeyA", "down", i * 100);
    t.ingest("KeyA", "up", i * 100 + 50);
  }
  expect(t.state("KeyA", 5)).toBe("good");
  t.ingest("KeyA", "down", 455);
  expect(t.state("KeyA", 5)).toBe("chatter");
});
