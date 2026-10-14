import { byValue, keycodes, type Keycode } from "./keycodes";
import { macroTokens } from "./macro-visual";
import type { Definition, PhysicalKey } from "../types";

// Protocol facts independently implemented from EVision V2 documentation:
// lephilousophe/icl01-tools and OpenRGB. These are NOT QMK firmware commands.
export const MONE_FN = 0x7a00;
export const MONE_OPAQUE = 0x7b00;
export const MONE_MACRO = 0x7700;
const consumers = new Map<number, number>([
  [0xa8, 0xe2],
  [0xa9, 0xe9],
  [0xaa, 0xea],
  [0xab, 0xb5],
  [0xac, 0xb6],
  [0xad, 0xb7],
  [0xae, 0xcd],
]);
export function moneCode(a: Uint8Array, slot: number): number {
  if (a.every((v) => v === 0)) return 0;
  if (a[0] === 0x20 && a[1] === 0) return a[2];
  if (a[0] === 0x20 && a[2] === 0 && a[1] && !(a[1] & (a[1] - 1)))
    return 224 + Math.log2(a[1]);
  if (a[0] === 0x30) {
    const c = [...consumers].find(([, u]) => u === (a[1] | (a[2] << 8)));
    if (c) return c[0];
  }
  if (a[0] === 0xa0 && a[1] === 1 && a[2] === 0) return MONE_FN;
  if (a[0] === 0x70 && a[2] === 0) return MONE_MACRO + a[1];
  return MONE_OPAQUE + slot;
}
export function moneAction(code: number, macros: number): Uint8Array {
  if (!Number.isInteger(code)) throw Error("Invalid M-ONE keycode.");
  if (code === 0) return new Uint8Array([0x20, 0, 0]);
  if (Number.isInteger(code) && code >= 4 && code <= 0xa4)
    return new Uint8Array([0x20, 0, code]);
  if (code >= 224 && code <= 231)
    return new Uint8Array([0x20, 1 << (code - 224), 0]);
  if (consumers.has(code)) {
    const u = consumers.get(code)!;
    return new Uint8Array([0x30, u & 255, u >> 8]);
  }
  if (code === MONE_FN) return new Uint8Array([0xa0, 1, 0]);
  if (code >= MONE_MACRO && code < MONE_MACRO + macros)
    return new Uint8Array([0x70, code - MONE_MACRO, 0]);
  throw Error("This action is not supported by the M-ONE firmware.");
}
export function monePalette(): Keycode[] {
  return [
    ...keycodes.filter(
      (k) =>
        k.value === 0 ||
        (k.value >= 4 && k.value <= 0xa4) ||
        (k.value >= 224 && k.value <= 231) ||
        consumers.has(k.value),
    ),
    { value: MONE_FN, label: "Fn", name: "MONE_FN", category: "Layers" },
  ];
}
export function moneDefinition(factory: Uint8Array): Definition {
  const keys: PhysicalKey[] = [];
  const add = (slot: number, x: number, y: number, w = 1) =>
    keys.push({
      id: `mone:${slot}`,
      row: 0,
      col: slot,
      x,
      y,
      w,
      h: 1,
      defaultCode: moneCode(factory.slice(slot * 3, slot * 3 + 3), slot),
      themeCode: moneCode(factory.slice(slot * 3, slot * 3 + 3), slot),
    });
  add(0, 0, 0);
  // Spacing verified against the original M-ONE keyboarddevice.xml.
  for (let i = 1; i <= 12; i++)
    add(i, i + 0.25 + Math.floor((i - 1) / 4) * 0.25, 0);
  add(13, 14, 0);
  add(14, 15, 0);
  const row = (slots: number[], y: number, widths: Record<number, number>) => {
    let x = 0;
    for (const s of slots) {
      const w = widths[s] ?? 1;
      add(s, x, y, w);
      x += w;
    }
  };
  row(
    Array.from({ length: 15 }, (_, i) => 15 + i),
    1.25,
    { 28: 2 },
  );
  row(
    Array.from({ length: 15 }, (_, i) => 30 + i),
    2.25,
    { 30: 1.5, 43: 1.5 },
  );
  row(
    Array.from({ length: 15 }, (_, i) => 45 + i).filter((i) => i !== 57),
    3.25,
    { 45: 1.75, 58: 2.25 },
  );
  row(
    Array.from({ length: 15 }, (_, i) => 60 + i).filter((i) => i !== 61),
    4.25,
    { 60: 2.25, 72: 1.75 },
  );
  row([75, 76, 77, 81, 85, 86], 5.25, {
    75: 1.25,
    76: 1.25,
    77: 1.25,
    81: 6.25,
    85: 1.25,
    86: 1.25,
  });
  [87, 88, 89].forEach((slot, i) => add(slot, 13 + i, 5.25));
  return {
    name: "Besides Studio M-ONE",
    vendorId: 0x05ac,
    productId: 0x024f,
    matrix: { rows: 1, cols: 170 },
    labels: [],
    keys,
  };
}

export interface MoneMacroBlock {
  raw: Uint8Array;
  records: Uint8Array[];
}
export function parseMoneMacros(raw: Uint8Array): MoneMacroBlock {
  const u16 = (i: number) => raw[i] | (raw[i + 1] << 8);
  if (raw.length !== 3072) throw Error("Invalid M-ONE macro memory size.");
  if (raw[0] === 0 && raw[1] === 0) return { raw: raw.slice(), records: [] };
  const size = u16(2),
    count = u16(4);
  if (
    u16(0) !== 0x55aa ||
    count > 256 ||
    size < 16 + count * 2 ||
    size > raw.length
  )
    throw Error("Invalid M-ONE macro header.");
  const records: Uint8Array[] = [],
    spans: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const start = u16(16 + i * 2);
    if (start < 16 + count * 2 || start + 4 > size)
      throw Error("Invalid M-ONE macro offset.");
    const end = start + 4 + u16(start) * 4;
    if (end > size || spans.some(([a, b]) => start < b && end > a))
      throw Error("Invalid M-ONE macro record.");
    spans.push([start, end]);
    records.push(raw.slice(start, end));
  }
  return { raw: raw.slice(), records };
}
export function moneMacroExpression(record: Uint8Array | undefined): string {
  if (!record || record.length === 4) return "";
  let result = "";
  for (let i = 4; i < record.length; i += 4) {
    const delay = record[i] | (record[i + 1] << 8),
      action = record[i + 2],
      param = record[i + 3];
    const type = action & 0x7f;
    const codes =
      type === 9
        ? Array.from({ length: 8 }, (_, j) => 224 + j).filter(
            (_, j) => param & (1 << j),
          )
        : type === 10
          ? [param]
          : [];
    if (!codes.length || codes.some((c) => !byValue.has(c)))
      return `{RAW:MONE_${[...record].map((v) => v.toString(16).padStart(2, "0")).join("")}}`;
    result += `{${action & 128 ? "+" : "-"}${codes.map((c) => byValue.get(c)!.name).join(",")}}`;
    // EVision stores the wait AFTER the event.
    if (delay && i + 4 < record.length) result += `{${delay}}`;
  }
  return result;
}
export function moneMacroRecord(text: string): Uint8Array {
  const events: number[][] = [],
    held = new Set<number>();
  const emit = (c: number, down: boolean) => {
    if (
      !Number.isInteger(c) ||
      !((c >= 4 && c <= 0xa4) || (c >= 224 && c <= 231))
    )
      throw Error("M-ONE macros support keyboard keys and modifiers.");
    if (down === held.has(c))
      throw Error("Macro contains an unmatched key press or release.");
    if (down) held.add(c);
    else held.delete(c);
    events.push([
      1,
      0,
      (down ? 128 : 0) + (c >= 224 ? 9 : 10),
      c >= 224 ? 1 << (c - 224) : c,
    ]);
  };
  for (const t of macroTokens(text)) {
    if (t.kind === "delay") {
      const ms = Number(t.text);
      if (!events.length || ms > 65535)
        throw Error(
          "M-ONE delays must follow a key action and be at most 65535 ms.",
        );
      const e = events.at(-1)!;
      e[0] = Math.max(1, ms) & 255;
      e[1] = Math.max(1, ms) >> 8;
      continue;
    }
    if (!t.keys)
      throw Error("Record keys or use graphical actions for M-ONE macros.");
    const codes = t.keys.map(
      (n) => keycodes.find((k) => k.name === n)?.value ?? NaN,
    );
    if (t.kind === "tap") {
      codes.forEach((c) => emit(c, true));
      [...codes].reverse().forEach((c) => emit(c, false));
    } else codes.forEach((c) => emit(c, t.kind === "down"));
  }
  if (held.size) throw Error("Release every macro key before saving.");
  if (events.length > 65535) throw Error("Macro is too long.");
  return new Uint8Array([
    events.length & 255,
    events.length >> 8,
    0,
    0,
    ...events.flat(),
  ]);
}
export function replaceMoneMacro(
  block: MoneMacroBlock,
  index: number,
  record: Uint8Array,
): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 255)
    throw Error("Invalid M-ONE macro number.");
  const records = block.records.map((r) => r.slice());
  while (records.length <= index) records.push(new Uint8Array(4));
  records[index] = record;
  const size =
    16 + records.length * 2 + records.reduce((n, r) => n + r.length, 0);
  if (size > block.raw.length) throw Error("M-ONE macro memory is full.");
  // Preserve header reserved bytes and unused tail; every other macro stays byte-identical.
  const result = block.raw.slice();
  const put = (i: number, v: number) => {
    result[i] = v & 255;
    result[i + 1] = v >> 8;
  };
  put(0, 0x55aa);
  put(2, size);
  put(4, records.length);
  let off = 16 + records.length * 2;
  records.forEach((r, i) => {
    put(16 + i * 2, off);
    result.set(r, off);
    off += r.length;
  });
  parseMoneMacros(result);
  return result;
}
