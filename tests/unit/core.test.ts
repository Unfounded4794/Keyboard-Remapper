import { describe, it, expect } from "vitest";
import {
  demoDefinition,
  defaultLayers,
  packOptions,
  parseDefinition,
  parseProject,
  unpackOptions,
  visibleKeys,
} from "../../src/core/definitions";
import { encodeMacro, replaceMacroSlot } from "../../src/core/macros";
import { KeyboardTester } from "../../src/core/tester";
import { macroKeycode, layerKeycode } from "../../src/core/keycodes";
import { sameAssignment } from "../../src/core/projects";
import type { Macro, Project } from "../../src/types";
const macro: Macro = {
  id: "test",
  name: "Ctrl+A",
  events: [
    { type: "down", code: "ControlLeft", keycode: 224, at: 0 },
    { type: "down", code: "KeyA", keycode: 4, at: 255 },
    { type: "up", code: "KeyA", keycode: 4, at: 355 },
    { type: "up", code: "ControlLeft", keycode: 224, at: 400 },
  ],
};
describe("keyboard definitions", () => {
  it("reads KLE coordinates, dimensions, variants and rotation without losing matrix identity", () => {
    const d = parseDefinition({
      name: "Custom split",
      vendorId: "0xCAFE",
      productId: "0x1234",
      matrix: { rows: 3, cols: 4 },
      layouts: {
        labels: [["Enter", "ANSI", "ISO"]],
        keymap: [
          [{ w: 2 }, "0,0", { x: 0.25 }, "0,1\n\n\n0,0"],
          [{ r: 15, rx: 4, ry: 2, h: 2 }, "1,0\n\n\n0,1", "e0,0"],
        ],
      },
    });
    expect(d.vendorId).toBe(0xcafe);
    expect(d.keys).toHaveLength(3);
    expect(d.keys[0].w).toBe(2);
    expect(d.keys[1].x).toBe(2.25);
    expect(d.keys[2]).toMatchObject({
      rotation: 15,
      rx: 2.25,
      ry: 0,
      h: 2,
      x: 2.25,
      y: 0,
    });
    expect(visibleKeys(d, [1]).map((k) => k.id)).toEqual(["0,0", "1,0"]);
  });
  it("round trips option bits and retains independent ANSI and ISO switch positions", () => {
    const d = demoDefinition();
    expect(unpackOptions(d, packOptions(d, [1, 1]))).toEqual([1, 1]);
    expect(visibleKeys(d, [1, 0]).length).toBe(
      visibleKeys(d, [0, 0]).length + 1,
    );
    expect(visibleKeys(d, [0, 0]).some((k) => k.id === "5,0")).toBe(false);
  });
  it("rejects out-of-matrix keys and unsafe analog ranges", () => {
    const d = demoDefinition();
    expect(() =>
      parseDefinition({ ...d, keys: [{ ...d.keys[0], row: 255 }] }),
    ).toThrow();
    expect(() =>
      parseDefinition({
        ...d,
        sensor: "HE",
        analog: {
          protocol: "via-custom",
          controls: [
            {
              id: "bad",
              label: "Bad",
              min: 0,
              max: 4,
              step: 0.1,
              default: 2,
              scale: 100,
              bytes: 1,
              channel: 0,
              valueId: 1,
              unit: "mm",
            },
          ],
        },
      }),
    ).toThrow();
  });
  it("rejects a corrupted project rather than loading invalid hardware writes", () => {
    const d = demoDefinition(),
      p: Project = {
        version: 1,
        definition: d,
        layers: defaultLayers(d),
        options: [0, 0],
        macros: [],
        analog: {},
      };
    expect(parseProject(p)).toBe(p);
    expect(() => parseProject({ ...p, layers: [{ "0,0": -1 }] })).toThrow();
    expect(() =>
      parseProject({
        ...p,
        bindings: {
          32768: { behaviorId: 1, param1: -1, param2: 0, displayName: "bad" },
        },
      }),
    ).toThrow();
  });
});
describe("macro wire formats", () => {
  it("uses decimal ASCII delays with a pipe terminator for VIA 11+", () => {
    expect(encodeMacro(macro, "via")).toEqual([
      1, 2, 224, 1, 4, 50, 53, 53, 124, 1, 2, 4, 1, 4, 49, 48, 48, 124, 1, 3, 4,
      1, 4, 52, 53, 124, 1, 3, 224, 0,
    ]);
  });
  it("uses nonzero base-255 delays for Vial advanced macros", () => {
    expect(encodeMacro(macro, "vial").slice(0, 10)).toEqual([
      1, 2, 224, 1, 4, 1, 2, 1, 2, 4,
    ]);
    expect(encodeMacro(macro, "vial").slice(0, -1)).not.toContain(0);
  });
  it("keeps legacy VIA actions without unsupported delay tokens", () => {
    expect(encodeMacro(macro, "legacy")).toEqual([
      2, 224, 2, 4, 3, 4, 3, 224, 0,
    ]);
  });
  it("releases held keys when a recording ends early", () => {
    expect(
      encodeMacro({ ...macro, events: macro.events.slice(0, 1) }, "via"),
    ).toEqual([1, 2, 224, 1, 3, 224, 0]);
  });
  it("preserves adjacent macro slots and rejects overflow", () => {
    const original = Uint8Array.from([65, 0, 66, 67, 0, 68, 0, 0, 0, 0]);
    expect([...replaceMacroSlot(original, 3, 1, [1, 2, 4, 0])]).toEqual([
      65, 0, 1, 2, 4, 0, 68, 0, 0, 0,
    ]);
    expect([...original]).toEqual([65, 0, 66, 67, 0, 68, 0, 0, 0, 0]);
    expect(() => replaceMacroSlot(original, 3, 1, Array(20).fill(1))).toThrow(
      /bytes/,
    );
    expect(() => replaceMacroSlot(original, 3, 3, [0])).toThrow(/slot/);
  });
});
describe("tester evidence", () => {
  it("excludes OS repeats and duplicate down events from rollover and chatter", () => {
    const t = new KeyboardTester(20);
    t.ingest("KeyA", "down", 0);
    t.ingest("KeyA", "down", 1, true);
    t.ingest("KeyA", "down", 2);
    t.ingest("KeyB", "down", 3);
    t.ingest("KeyA", "up", 10);
    t.ingest("KeyA", "down", 25);
    expect(t.total).toBe(3);
    expect(t.peak).toBe(2);
    expect(t.chatter.get("KeyA")).toBe(1);
  });
  it("clears held keys and release times on focus loss", () => {
    const t = new KeyboardTester();
    t.ingest("KeyA", "down", 0);
    t.ingest("KeyA", "up", 5);
    t.blur();
    t.ingest("KeyA", "down", 10);
    expect(t.chatter.size).toBe(0);
    expect(t.report().source).toContain("not raw USB");
  });
});
it("uses firmware-appropriate macro and momentary-layer ranges", () => {
  expect(macroKeycode(2, 9)).toBe(0x5f14);
  expect(macroKeycode(2, 13)).toBe(0x7702);
  expect(layerKeycode(2, 9)).toBe(0x5102);
  expect(layerKeycode(2, 13)).toBe(0x5222);
});
it("compares ZMK bindings by meaning even when their internal token IDs match", () => {
  const definition = demoDefinition(),
    p: Project = {
      version: 1,
      firmware: "ZMK",
      definition,
      layers: [{ "0,0": 32768 }],
      options: [],
      macros: [],
      analog: {},
      bindings: {
        32768: { behaviorId: 1, param1: 1, param2: 0, displayName: "Layer" },
      },
    };
  expect(
    sameAssignment(
      p,
      {
        ...p,
        bindings: {
          32768: { behaviorId: 1, param1: 2, param2: 0, displayName: "Layer" },
        },
      },
      0,
      "0,0",
    ),
  ).toBe(false);
});
