import { byCode, byValue, keycodes, type Keycode } from "./keycodes";
import { testerDefinition } from "./layouts";
import { visibleKeys } from "./definitions";
import { macroTokens } from "./macro-visual";
import type { Definition } from "../types";

// NIZ internal codes are not USB usages. These values are shared with the
// manufacturer's EC software; framing research: cbingb666/niz-web (MIT).
const hostNames = [
  "",
  "Escape",
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  "Backquote",
  ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
  "Minus",
  "Equal",
  "Backspace",
  "Tab",
  ..."QWERTYUIOP".split("").map((c) => `Key${c}`),
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "CapsLock",
  ..."ASDFGHJKL".split("").map((c) => `Key${c}`),
  "Semicolon",
  "Quote",
  "Enter",
  "ShiftLeft",
  ..."ZXCVBNM".split("").map((c) => `Key${c}`),
  "Comma",
  "Period",
  "Slash",
  "ShiftRight",
  "ControlLeft",
  "MetaLeft",
  "AltLeft",
  "Space",
  "AltRight",
  "MetaRight",
  "ContextMenu",
  "ControlRight",
  "WakeUp",
  "Sleep",
  "Power",
  "PrintScreen",
  "ScrollLock",
  "Pause",
  "Insert",
  "Home",
  "PageUp",
  "Delete",
  "End",
  "PageDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "NumLock",
  "NumpadDivide",
  "NumpadMultiply",
  "Numpad7",
  "Numpad8",
  "Numpad9",
  "Numpad4",
  "Numpad5",
  "Numpad6",
  "Numpad1",
  "Numpad2",
  "Numpad3",
  "Numpad0",
  "NumpadDecimal",
  "NumpadSubtract",
  "NumpadAdd",
  "NumpadEnter",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "MediaStop",
  "MediaPlayPause",
  "AudioVolumeMute",
  "AudioVolumeUp",
  "AudioVolumeDown",
];
export const NIZ_MACRO_BASE = 0x7700;
export const NIZ_NATIVE_BASE = 0x7800;
const nativeLabels: Record<number, string> = {
  75: "Wake",
  76: "Sleep",
  77: "Power",
  115: "Media player",
  116: "Mail",
  117: "Calculator",
  118: "My computer",
  119: "Search",
  120: "Browser home",
  121: "Browser back",
  122: "Browser forward",
  123: "Browser stop",
  124: "Browser refresh",
  125: "Favorites",
  126: "Mouse left",
  127: "Mouse right",
  128: "Mouse up",
  129: "Mouse down",
  130: "Mouse button 1",
  131: "Mouse button 2",
  132: "Mouse button 3",
  133: "Wheel up",
  134: "Wheel down",
  135: "Lighting toggle",
  136: "Lighting macro",
  137: "Lighting demo",
  138: "Stars effect",
  139: "Ripple effect",
  140: "Stop demo",
  141: "Breathing effect",
  142: "Breathing order −",
  143: "Breathing order +",
  144: "Brightness −",
  145: "Brightness +",
  146: "Dusk / Aurora",
  147: "Color breathing",
  148: "Background color",
  149: "Actuation travel",
  150: "Keyboard lock",
  151: "Shift / Up swap",
  152: "Caps / Ctrl swap",
  153: "Win lock",
  154: "Mouse lock",
  155: "Win / Mac swap",
  156: "Right Fn",
  157: "Mouse distance",
  158: "Mouse interval",
  159: "M mode",
  160: "Lighting preset 1",
  161: "Lighting preset 2",
  162: "Lighting preset 3",
  163: "Lighting preset 4",
  164: "Lighting preset 5",
  165: "Lighting preset 6",
  166: "Left Fn",
  167: "Wired / wireless",
  168: "Bluetooth 1",
  169: "Bluetooth 2",
  170: "Bluetooth 3",
  171: "Game mode",
  172: "ECO mode",
  173: "Initial mouse delay",
  174: "Key repeat rate",
  175: "Key response delay",
  176: "USB report rate",
  177: "Key scan period",
  199: "Mouse double-click",
};
export function nizToCode(n: number): number {
  if (!n) return 0;
  return byCode.get(hostNames[n])?.value ?? NIZ_NATIVE_BASE + n;
}
export function codeToNiz(code: number): number {
  if (
    code >= NIZ_NATIVE_BASE &&
    code <= NIZ_NATIVE_BASE + 255 &&
    code !== NIZ_NATIVE_BASE + 200
  )
    return code - NIZ_NATIVE_BASE;
  const n = hostNames.findIndex((_, i) => i > 0 && nizToCode(i) === code);
  if (n < 0) throw Error("This action is not supported by the NIZ firmware.");
  return n;
}
export function nizLabel(code: number): string | undefined {
  if (code >= NIZ_MACRO_BASE && code < NIZ_MACRO_BASE + 216) return "Macro";
  if (code >= NIZ_NATIVE_BASE && code <= NIZ_NATIVE_BASE + 255)
    return (
      nativeLabels[code - NIZ_NATIVE_BASE] ?? `NIZ ${code - NIZ_NATIVE_BASE}`
    );
}
export function nizPalette(): Keycode[] {
  const mapped = new Set(hostNames.map((_, i) => nizToCode(i)));
  return [
    ...keycodes.filter((k) => mapped.has(k.value) || k.value === 0),
    ...Object.entries(nativeLabels)
      .filter(([n]) => !byCode.has(hostNames[+n]))
      .map(([n, label]) => ({
        value: NIZ_NATIVE_BASE + +n,
        label,
        name: `NIZ_${n}`,
        category: [156, 166].includes(+n)
          ? "Layers"
          : (+n >= 135 && +n <= 148) || (+n >= 160 && +n <= 165)
            ? "Lighting"
            : "Special",
      })),
  ];
}
export function nizDefinition(): Definition {
  const full = testerDefinition("100%");
  const codesToIds = new Map<number, number>();
  for (let i = 1; i <= 74; i++) codesToIds.set(nizToCode(i), i);
  const tail = [
    78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 105, 94, 95,
    96, 106, 97, 98, 99, 100, 101, 102, 103, 104, 107,
  ];
  tail.forEach((n, i) =>
    codesToIds.set(nizToCode(n), i < 13 ? 75 + i : 79 + i),
  );
  const keys = visibleKeys(full, [0, 0, 0]).map((k) => {
    const id = codesToIds.get(k.defaultCode!);
    if (!id) throw Error("Missing NIZ physical key identity");
    return {
      ...k,
      id: `niz:${id}`,
      row: 0,
      col: id - 1,
      option: undefined,
      themeCode: k.defaultCode,
    };
  });
  [112, 114, 113, 159].forEach((native, i) =>
    keys.push({
      id: `niz:${88 + i}`,
      row: 0,
      col: 87 + i,
      x: 18.75 + i,
      y: 0,
      w: 1,
      h: 1,
      defaultCode: nizToCode(native),
      themeCode: nizToCode(native),
      option: undefined,
    }),
  );
  return {
    name: "NIZ x108",
    vendorId: 0x0483,
    productId: 0x5230,
    matrix: { rows: 1, cols: 108 },
    labels: [],
    keys,
  };
}
export type NizRecords = Uint8Array[][];
export function parseNizRecords(reports: Uint8Array[]): NizRecords {
  if (!reports.length || reports.length > 8192)
    throw Error("Invalid NIZ configuration size.");
  const layers = Math.max(...reports.map((r) => r[2]));
  if (layers !== 2)
    throw Error(
      "This x108 firmware does not expose the verified two-layer format.",
    );
  const records: NizRecords = Array.from({ length: 216 }, () => []);
  for (let i = 0; i < reports.length;) {
    const r = reports[i];
    if (
      r.length !== 64 ||
      r[0] !== 0 ||
      r[1] !== 0xf0 ||
      r[2] < 1 ||
      r[2] > 2 ||
      r[3] < 1 ||
      r[3] > 108 ||
      r[4] > 4
    )
      throw Error("Invalid NIZ key record.");
    const index = (r[2] - 1) * 108 + r[3] - 1;
    const size = r[9] * 256 + r[10],
      count = r[4] < 2 ? 1 : Math.ceil(size / 53);
    if (
      records[index].length ||
      count < 1 ||
      count > 155 ||
      i + count > reports.length
    )
      throw Error("Incomplete or duplicate NIZ key record.");
    if (r[4] < 2 && r[r[4] === 0 ? 5 : 7] > (r[4] === 0 ? 58 : 56))
      throw Error("Invalid NIZ chord length.");
    const group = reports.slice(i, i + count);
    if (
      r[4] >= 2 &&
      (r[6] > 1 ||
        group.some(
          (b) => b.length !== 64 || !b.slice(0, 11).every((v, j) => v === r[j]),
        ))
    )
      throw Error("Invalid NIZ macro continuation.");
    records[index] = group.map((b) => b.slice());
    i += count;
  }
  if (records.some((g) => !g.length))
    throw Error("NIZ configuration is missing keys. Reconnect before editing.");
  return records;
}
export function nizRecordCode(group: Uint8Array[], index: number): number {
  const r = group[0];
  if (r[4] === 0 && r[5] === 0) return 0;
  if (r[4] === 0 && r[5] === 1) return nizToCode(r[6]);
  return NIZ_MACRO_BASE + index;
}
export function nizKeyRecord(index: number, code: number): Uint8Array[] {
  const r = new Uint8Array(64);
  r.set([
    0,
    0xf0,
    Math.floor(index / 108) + 1,
    (index % 108) + 1,
    0,
    code === 0 ? 0 : 1,
    code === 0 ? 0 : codeToNiz(code),
  ]);
  return [r];
}
function keyName(n: number) {
  const c = nizToCode(n);
  return byValue.get(c)?.name ?? `0x${c.toString(16)}`;
}
export function nizMacroExpression(group: Uint8Array[]): string {
  const r = group[0];
  if (r[4] === 0)
    return Array.from(r.slice(6, 6 + r[5]), keyName).length > 1
      ? `{${Array.from(r.slice(6, 6 + r[5]), keyName).join(",")}}`
      : "";
  // Non-default playback modes remain opaque and byte-preserved unless replaced.
  if (r[4] !== 2 || r[5] !== 1)
    return `{RAW:NIZ_${group.map((b) => Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("")).join("")}}`;
  const payload = group
    .flatMap((b) => [...b.slice(11)])
    .slice(0, r[9] * 256 + r[10]);
  const held = new Set<number>();
  let text = "";
  for (let i = 0; i < payload.length;) {
    const n = payload[i++],
      up = held.has(n);
    text += `{${up ? "-" : "+"}${keyName(n)}}`;
    up ? held.delete(n) : held.add(n);
    if (i < payload.length) {
      let delay = r[7] * 256 + r[8];
      if (r[6]) {
        if (payload[i++] !== 200 || i + 2 > payload.length)
          throw Error("Invalid NIZ macro delay.");
        delay = payload[i++] * 256 + payload[i++];
      }
      if (delay) text += `{${delay}}`;
    }
  }
  if (held.size)
    return `{RAW:NIZ_${group.map((b) => Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("")).join("")}}`;
  return text;
}
export function nizMacroRecord(
  index: number,
  expression: string,
): Uint8Array[] {
  if (!expression) return nizKeyRecord(index, 0);
  const events: { n: number; delay: number }[] = [],
    held = new Set<number>();
  const event = (code: number, up: boolean) => {
    const n = codeToNiz(code);
    if (held.has(n) !== up)
      throw Error("Macro contains an unmatched key press or release.");
    up ? held.delete(n) : held.add(n);
    events.push({ n, delay: 0 });
  };
  const lookup = (name: string) =>
    byValue.get(Number(name))?.value ??
    keycodes.find((k) => k.name === name)?.value ??
    (/^0x[\da-f]+$/i.test(name) ? parseInt(name, 16) : NaN);
  for (const t of macroTokens(expression)) {
    if (t.kind === "delay") {
      const n = Number(t.text);
      if (!Number.isInteger(n) || n < 0 || n > 65535)
        throw Error("NIZ delays must be between 0 and 65535 ms.");
      if (!events.length && n)
        throw Error("NIZ cannot store a delay before the first action.");
      if (events.length) {
        events.at(-1)!.delay += n;
        if (events.at(-1)!.delay > 65535)
          throw Error("NIZ delay exceeds 65535 ms.");
      }
      continue;
    }
    if (t.kind === "raw" || t.kind === "text")
      throw Error(
        "Use key actions for NIZ macros. Existing raw actions are preserved until replaced.",
      );
    const codes = t.keys!.map(lookup);
    if (t.kind === "tap") {
      codes.forEach((c) => event(c, false));
      [...codes].reverse().forEach((c) => event(c, true));
    } else codes.forEach((c) => event(c, t.kind === "up"));
  }
  if (held.size) throw Error("Release all macro keys before saving.");
  if (!events.length) return nizKeyRecord(index, 0);
  if (events.at(-1)!.delay)
    throw Error("NIZ cannot store a delay after the final release.");
  // In NIZ's custom-delay playback loop, a zero delay does not yield or
  // flush the USB report. A whole press/release sequence can disappear.
  // Fixed mode yields after each action; custom mode must have positive
  // gaps. Match the firmware's wired fixed-mode minimum of 3 ms.
  const gaps = events.slice(0, -1).map((e) => Math.max(3, e.delay));
  const fixed = gaps.every((ms) => ms === gaps[0]);
  const interval = fixed ? (gaps[0] ?? 3) : 0;
  const payload = events.flatMap((e, i) =>
    !fixed && i + 1 < events.length
      ? [e.n, 200, gaps[i] >> 8, gaps[i] & 255]
      : [e.n],
  );
  if (payload.length > 8192) throw Error("NIZ macro is too long.");
  const header = new Uint8Array(64);
  header.set([
    0,
    0xf0,
    Math.floor(index / 108) + 1,
    (index % 108) + 1,
    2,
    1,
    fixed ? 0 : 1,
    interval >> 8,
    interval & 255,
    payload.length >> 8,
    payload.length & 255,
  ]);
  const reports = [];
  for (let offset = 0; offset < payload.length; offset += 53) {
    const r = header.slice();
    r.set(payload.slice(offset, offset + 53), 11);
    reports.push(r);
  }
  return reports;
}
