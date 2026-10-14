import { describe, it, expect } from "vitest";
import factory from "../../src/core/mone-factory.json";
import { createFakeMone } from "../helpers/mone-device";
import { MoneAdapter, isMoneDevice } from "../../src/protocols/mone";
import {
  moneAction,
  moneCode,
  moneDefinition,
  moneMacroExpression,
  moneMacroRecord,
  parseMoneMacros,
  replaceMoneMacro,
  MONE_MACRO,
} from "../../src/core/mone";
const hid = (d: ReturnType<typeof createFakeMone>) => d as unknown as HIDDevice;
describe("Besides Studio M-ONE", () => {
  it("requires exact product, vendor interface and both 63-byte reports, not the shared Apple ID alone", () => {
    const d = createFakeMone(factory);
    expect(isMoneDevice(hid(d))).toBe(true);
    d.productName = "Apple Keyboard";
    expect(isMoneDevice(hid(d))).toBe(false);
    d.productName = "M-ONE";
    d.collections[0].outputReports[0].items[0].reportCount = 64;
    expect(isMoneDevice(hid(d))).toBe(false);
  });
  it("rejects a different protocol family or factory map before writes", async () => {
    for (const kind of ["caps", "factory", "checksum"]) {
      const d = createFakeMone(factory);
      if (kind === "caps") d.capabilities[0] = 85;
      if (kind === "factory") d.factory[2] = 4;
      if (kind === "checksum") d.badChecksum = true;
      const a = new MoneAdapter(hid(d));
      await expect(a.initialize()).rejects.toThrow();
      expect(d.writes).toHaveLength(0);
      expect(d.commands).not.toContain(1);
      await a.close();
    }
  });
  it("shows only physical ANSI keys and leaves motor, ISO/JIS and unused positions outside the editor", () => {
    const d = moneDefinition(new Uint8Array(factory));
    expect(new Set(d.keys.map((k) => k.col)).size).toBe(d.keys.length);
    expect(
      d.keys.some((k) => [57, 61, 78, 79, 80, 82, 83, 84].includes(k.col)),
    ).toBe(false);
    expect(d.keys.find((k) => k.col === 28)?.w).toBe(2);
    expect(d.keys.find((k) => k.col === 81)?.w).toBe(6.25);
    const keys = d.keys;
    expect(keys.every((k) => k.x + k.w <= 16.001)).toBe(true);
  });
  it("writes only the selected three-byte action and verifies the entire map", async () => {
    const d = createFakeMone(factory),
      a = new MoneAdapter(hid(d));
    await a.initialize();
    await a.readLayers(a.definition);
    const before = d.current.slice();
    await a.writeKey(
      0,
      a.definition.keys.find((k) => k.col === 31)!,
      5,
    );
    expect(d.writes).toHaveLength(0);
    const backup: unknown[] = [];
    await a.commit((v) => backup.push(v));
    expect(d.writes).toEqual([{ cmd: 9, offset: 93, data: [32, 0, 5] }]);
    before.set([32, 0, 5], 93);
    expect(d.current).toEqual(before);
    expect(backup).toHaveLength(1);
    expect(d.configuring).toBe(false);
    await a.close();
  });
  it("rejects stale keymaps and firmware that acknowledges without storing a change", async () => {
    for (const stale of [true, false]) {
      const d = createFakeMone(factory),
        a = new MoneAdapter(hid(d));
      await a.initialize();
      await a.readLayers(a.definition);
      await a.writeKey(0, a.definition.keys[0], 4);
      if (stale) d.current[2] = 5;
      else d.ignoreWrites = true;
      await expect(a.commit()).rejects.toThrow(
        stale ? /changed outside/ : /verification failed/,
      );
      if (stale) expect(d.writes).toHaveLength(0);
      await a.close();
    }
  });
  it("roundtrips keyboard, modifier, consumer and macro assignments without QMK commands", () => {
    for (const code of [0, 4, 44, 224, 227, 231, 0xa8, 0xae, MONE_MACRO + 2])
      expect(moneCode(moneAction(code, 16), 0)).toBe(code);
    expect(() => moneAction(0x5221, 16)).toThrow(/not supported/);
    expect(() => moneAction(224.5, 16)).toThrow(/Invalid/);
  });
  it("encodes recorded Ctrl+V as native key/modifier down/up events and rejects unbalanced or unsupported actions", () => {
    const r = moneMacroRecord("{+KC_LCTL}{12}{+KC_V}{30}{-KC_V}{5}{-KC_LCTL}");
    expect([...r]).toEqual([
      4, 0, 0, 0, 12, 0, 137, 1, 30, 0, 138, 25, 5, 0, 10, 25, 1, 0, 9, 1,
    ]);
    expect(moneMacroExpression(r)).toBe(
      "{+KC_LCTL}{12}{+KC_V}{30}{-KC_V}{5}{-KC_LCTL}",
    );
    expect(() => moneMacroRecord("{+KC_A}")).toThrow(/Release/);
    expect(() => moneMacroRecord("hello")).toThrow(/Record/);
  });
  it("preserves other macros, reserved header bytes and tail across growing replacements and rejects overlapping records", () => {
    const raw = new Uint8Array(3072);
    raw[8] = 32;
    raw[3000] = 91;
    const one = replaceMoneMacro(
      parseMoneMacros(raw),
      0,
      moneMacroRecord("{KC_A}"),
    );
    const two = replaceMoneMacro(
      parseMoneMacros(one),
      2,
      moneMacroRecord("{KC_B}".repeat(20)),
    );
    expect(parseMoneMacros(two).records[0]).toEqual(
      parseMoneMacros(one).records[0],
    );
    expect(two[8]).toBe(32);
    expect(two[3000]).toBe(91);
    two[18] = two[16];
    two[19] = two[17];
    expect(() => parseMoneMacros(two)).toThrow(/record/);
  });
  it("saves macros spanning multiple USB reports, verifies memory and keeps keymap and configuration intact", async () => {
    const d = createFakeMone(factory),
      a = new MoneAdapter(hid(d));
    await a.initialize();
    await a.readLayers(a.definition);
    const before = d.current.slice();
    await a.writeMacro(2, "{KC_LCTL,KC_V}".repeat(10), () => {});
    expect(d.writes.filter((w) => w.cmd === 0x15).length).toBeGreaterThan(1);
    expect(d.current).toEqual(before);
    expect((await a.macroPrograms())[2]).toContain("{+KC_V}");
    expect(d.commands.some((c) => [4, 6, 0x0d, 0x1e].includes(c))).toBe(false);
    await a.close();
  });
});
