import { describe, it, expect } from "vitest";
import {
  nizDefinition,
  nizToCode,
  codeToNiz,
  nizKeyRecord,
  nizMacroRecord,
  nizMacroExpression,
  parseNizRecords,
  NIZ_MACRO_BASE,
} from "../../src/core/niz";
import { NizAdapter } from "../../src/protocols/niz";
import { wiredNizPlayback } from "../helpers/niz-playback";
const fixture = () => Array.from({ length: 216 }, (_, i) => nizKeyRecord(i, 4));
class FakeNiz extends EventTarget {
  opened = true;
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
  records = fixture();
  commands: number[] = [];
  writing: Uint8Array[] = [];
  ignoreWrites = false;
  version = "X108EC(S);V1.0.22;V1.0;";
  emit(bytes: Uint8Array) {
    const e = new Event("inputreport");
    Object.assign(e, { reportId: 0, data: new DataView(bytes.buffer) });
    this.dispatchEvent(e);
  }
  async sendReport(_id: number, b: Uint8Array) {
    this.commands.push(b[1]);
    if (b[1] === 0xf9) {
      const r = new Uint8Array(64);
      r[1] = 0xf9;
      r.set(new TextEncoder().encode(this.version), 2);
      this.emit(r);
    }
    if (b[1] === 0xf2) {
      for (const r of this.records.flat()) this.emit(r.slice());
      this.emit(new Uint8Array(64).fill(0xf6));
    }
    if (b[1] === 0xf1) this.writing = [];
    if (b[1] === 0xf0) this.writing.push(b.slice());
    if (b[1] === 0xf6 && !this.ignoreWrites)
      this.records = parseNizRecords(this.writing);
  }
  async close() {
    this.opened = false;
  }
}
const adapter = (d: FakeNiz) => new NizAdapter(d as unknown as HIDDevice);
describe("NIZ x108", () => {
  it("maps 108 distinct physical positions including separate Fn and numpad Enter", () => {
    const d = nizDefinition();
    expect(d.keys).toHaveLength(108);
    expect(new Set(d.keys.map((k) => k.col)).size).toBe(108);
    expect(d.keys.find((k) => k.id === "niz:108")?.defaultCode).toBe(88);
    expect(d.keys.find((k) => k.id === "niz:106")?.defaultCode).toBe(98);
    expect(d.keys.find((k) => k.id === "niz:107")?.defaultCode).toBe(99);
    expect(d.keys.find((k) => k.id === "niz:72")?.defaultCode).toBe(231);
    expect(
      d.keys.filter((k) => k.id.match(/^niz:(88|89|90|91)$/)),
    ).toHaveLength(4);
    expect(codeToNiz(4)).toBe(43);
    expect(nizToCode(43)).toBe(4);
    expect(nizToCode(111)).toBe(0xae);
  });
  it("rejects missing, duplicate and malformed records rather than filling defaults", () => {
    const all = fixture().flat();
    expect(() => parseNizRecords(all.slice(1))).toThrow(/missing/);
    expect(() => parseNizRecords([...all, all[0]])).toThrow(/duplicate/);
    const bad = all.map((r) => r.slice());
    bad[0][4] = 8;
    expect(() => parseNizRecords(bad)).toThrow(/Invalid/);
  });
  it("encodes chords as balanced toggles with per-event recorded delays across packet boundaries", () => {
    const text = "{+KC_LCTL}{12}{+KC_C}{30}{-KC_C}{5}{-KC_LCTL}";
    const reports = nizMacroRecord(41, text);
    expect([...reports[0].slice(0, 11)]).toEqual([
      0, 0xf0, 1, 42, 2, 1, 1, 0, 0, 0, 13,
    ]);
    expect([...reports[0].slice(11, 24)]).toEqual([
      67, 200, 0, 12, 58, 200, 0, 30, 58, 200, 0, 5, 67,
    ]);
    expect(nizMacroExpression(reports)).toBe(text);
    const large = "{KC_A}".repeat(30);
    expect(nizMacroRecord(120, large).length).toBeGreaterThan(1);
    const all = fixture();
    all[120] = nizMacroRecord(120, large);
    expect(parseNizRecords(all.flat())).toHaveLength(216);
  });
  it("rejects unsupported actions and unbalanced macros before any write", () => {
    expect(() => nizMacroRecord(0, "{+KC_A}")).toThrow(/Release/);
    expect(() => nizMacroRecord(0, "{KC_A}{12}")).toThrow(/final/);
    expect(() => nizMacroRecord(0, "{12}{KC_A}")).toThrow(/first/);
    expect(() => nizKeyRecord(0, 0x5221)).toThrow(/not supported/);
  });
  it("emits Ctrl+V on Fn Left Shift, including no-delay recording, rather than only storing correct bytes", () => {
    const old = new Uint8Array(64);
    old.set([
      0, 0xf0, 2, 55, 2, 1, 1, 0, 0, 0, 13, 67, 200, 0, 0, 59, 200, 0, 0, 59,
      200, 0, 0, 67,
    ]);
    expect(wiredNizPlayback([old]).some((f) => f.keys.length)).toBe(false);
    for (const expression of [
      "{KC_LCTL,KC_V}",
      "{+KC_LCTL}{+KC_V}{-KC_V}{-KC_LCTL}",
      "{+KC_LCTL}{50}{+KC_V}{50}{-KC_V}{50}{-KC_LCTL}",
    ]) {
      const encoded = nizMacroRecord(162, expression);
      expect([...encoded[0].slice(2, 4)]).toEqual([2, 55]);
      const frames = wiredNizPlayback(encoded);
      expect(frames.map((f) => f.keys)).toEqual([[67], [67, 59], [67], []]);
      expect(frames.at(-1)!.at).toBe(expression.includes("50") ? 150 : 9);
    }
  });
  it("flushes zero or sub-frame gaps in mixed recorded macros before their release", () => {
    const encoded = nizMacroRecord(
      54,
      "{+KC_LCTL}{+KC_V}{1}{-KC_V}{20}{-KC_LCTL}",
    );
    expect(encoded[0][6]).toBe(1);
    expect(wiredNizPlayback(encoded).map((f) => f.keys)).toEqual([
      [67],
      [67, 59],
      [67],
      [],
    ]);
    expect(nizMacroExpression(encoded)).toBe(
      "{+KC_LCTL}{3}{+KC_V}{3}{-KC_V}{20}{-KC_LCTL}",
    );
  });
  it("keeps non-default playback records opaque", () => {
    const r = nizMacroRecord(4, "{KC_A}");
    r[0][4] = 3;
    expect(nizMacroExpression(r)).toMatch(/^\{RAW:NIZ_/);
  });
  it("stages edits, backs up and preserves unrelated raw records in a verified full-profile write", async () => {
    const d = new FakeNiz(),
      a = adapter(d),
      def = a.definition;
    d.records[41] = nizMacroRecord(41, "{KC_A}".repeat(30));
    d.records[120] = nizMacroRecord(120, "{KC_B}");
    d.records[120][0][4] = 3;
    const preserved = d.records.map((g) => g.map((r) => r.slice()));
    await a.initialize();
    await a.readLayers(def);
    await a.writeKey(
      0,
      def.keys.find((k) => k.col === 0)!,
      5,
    );
    expect(d.commands).not.toContain(0xf1);
    let backup: number[][] = [];
    await a.commit((r) => {
      backup = r;
      expect(d.commands).not.toContain(0xf1);
    });
    expect(backup).toEqual(preserved.flat().map((r) => [...r]));
    expect(d.records.slice(1)).toEqual(preserved.slice(1));
    expect((await a.readLayers(def))[0]["niz:1"]).toBe(5);
    await a.close();
  });
  it("refuses stale baselines before beginning the write stream", async () => {
    const d = new FakeNiz(),
      a = adapter(d);
    await a.initialize();
    await a.readLayers(a.definition);
    await a.writeKey(0, a.definition.keys[0], 5);
    d.records[12] = nizKeyRecord(12, 6);
    await expect(a.commit()).rejects.toThrow(/outside Keystone/);
    expect(d.commands).not.toContain(0xf1);
    await a.close();
  });
  it("reports readback failure and rejects transferring another key's opaque action", async () => {
    const d = new FakeNiz(),
      a = adapter(d);
    await a.initialize();
    await a.readLayers(a.definition);
    await expect(
      a.writeKey(0, a.definition.keys[0], NIZ_MACRO_BASE + 5),
    ).rejects.toThrow(/physical key/);
    await a.writeKey(0, a.definition.keys[0], 5);
    d.ignoreWrites = true;
    await expect(a.commit()).rejects.toThrow(/verification failed/);
    await a.close();
  });
  it("fails closed on an unverified firmware revision", async () => {
    const d = new FakeNiz(),
      a = adapter(d);
    d.version = "X108EC(XRGB);V2.0;";
    await expect(a.initialize()).rejects.toThrow(/verified protocol/);
    expect(d.commands).toEqual([0xf9]);
    await a.close();
  });
});
