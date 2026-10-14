import { byValue, keycodes, hex } from "./keycodes";
import type { MacroEvent } from "../types";
import { encodeMacro, type MacroFormat } from "./macros";
export type Timing = "recorded" | "none" | "fixed";
function name(code: number) {
  return byValue.get(code)?.name ?? hex(code);
}
export function recordedExpression(
  events: MacroEvent[],
  timing: Timing,
  delay: number,
) {
  let result = "";
  let previous = events[0]?.at ?? 0;
  events.forEach((e, i) => {
    const ms =
      timing === "none"
        ? 0
        : timing === "fixed" && i
          ? Math.max(0, Math.round(delay))
          : i
            ? Math.round(e.at - previous)
            : 0;
    if (ms) result += `{${ms}}`;
    result += `{${e.type === "down" ? "+" : "-"}${name(e.keycode)}}`;
    previous = e.at;
  });
  return result;
}
export function decodeExpression(bytes: number[], format: MacroFormat) {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i];
    if (!b) break;
    const action =
      format === "legacy"
        ? b >= 1 && b <= 3
          ? b
          : 0
        : b === 1
          ? bytes[++i]
          : 0;
    if (action >= 1 && action <= 3) {
      const code = bytes[++i];
      result += `{${action === 2 ? "+" : action === 3 ? "-" : ""}${name(code)}}`;
    } else if (action === 4) {
      if (format === "vial") {
        const ms = bytes[++i] - 1 + (bytes[++i] - 1) * 255;
        result += `{${ms}}`;
      } else {
        let digits = "";
        while (++i < bytes.length && bytes[i] !== 124)
          digits += String.fromCharCode(bytes[i]);
        result += `{${digits}}`;
      }
    } else if (format === "vial" && action >= 5 && action <= 7) {
      const low = bytes[++i],
        high = bytes[++i];
      result += `{RAW:1,${action},${low},${high}}`;
    } else if (action) {
      result += `{RAW:${format === "legacy" ? "" : "1,"}${action}}`;
    } else {
      const ch = String.fromCharCode(b);
      result += ch === "{" || ch === "\\" ? `\\${ch}` : ch;
    }
  }
  return result;
}
export function compileExpression(
  expression: string,
  format: MacroFormat,
): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    if (char === "\\" && i + 1 < expression.length) {
      const code = expression.charCodeAt(++i);
      if (code < 32 || code > 126) throw new Error("Macro text must be ASCII.");
      bytes.push(code);
      continue;
    }
    if (char !== "{") {
      const code = char === "\n" ? 10 : expression.charCodeAt(i);
      if (code !== 10 && (code < 32 || code > 126))
        throw new Error("Macro text must be ASCII.");
      bytes.push(code);
      continue;
    }
    const end = expression.indexOf("}", i + 1);
    if (end < 0) throw new Error("Close the macro action with }.");
    const action = expression.slice(i + 1, end).trim();
    i = end;
    if (/^RAW:/.test(action)) {
      const raw = action.slice(4).split(",").map(Number);
      if (raw.some((n) => !Number.isInteger(n) || n < 1 || n > 255))
        throw new Error("Invalid raw macro action.");
      bytes.push(...raw);
      continue;
    }
    if (/^\d+$/.test(action)) {
      const ms = Number(action);
      if (ms > 600000) throw new Error("Delay must be at most 600000 ms.");
      if (format === "legacy" && ms)
        throw new Error("This firmware cannot save delays. Choose no delay.");
      const encoded = encodeMacro(
        {
          id: "delay",
          name: "",
          events: [
            { type: "down", code: "KeyA", keycode: 4, at: ms },
            { type: "up", code: "KeyA", keycode: 4, at: ms },
          ],
        },
        format,
      );
      bytes.push(...encoded.slice(0, -(format === "legacy" ? 5 : 7)));
      continue;
    }
    const sign = action[0],
      names = action
        .replace(/^[+-]/, "")
        .split(",")
        .map((s) => s.trim());
    const codes = names.map(
      (n) =>
        keycodes.find((k) => k.name === n)?.value ??
        (/^0x[\da-f]{1,4}$/i.test(n) ? parseInt(n, 16) : NaN),
    );
    if (codes.some((c) => !Number.isInteger(c) || c < 4 || c > 255))
      throw new Error(`Unsupported macro key: ${names.join(", ")}`);
    const push = (op: number, code: number) =>
      bytes.push(...(format === "legacy" ? [op, code] : [1, op, code]));
    if (sign === "+" || sign === "-")
      codes.forEach((c) => push(sign === "+" ? 2 : 3, c));
    else if (codes.length === 1) push(1, codes[0]);
    else {
      codes.forEach((c) => push(2, c));
      [...codes].reverse().forEach((c) => push(3, c));
    }
  }
  bytes.push(0);
  return bytes;
}
export function splitMacroMemory(memory: Uint8Array, count: number) {
  let offset = 0;
  return Array.from({ length: count }, () => {
    const end = memory.indexOf(0, offset);
    if (end < 0) throw new Error("Keyboard macro memory is invalid.");
    const bytes = [...memory.slice(offset, end + 1)];
    offset = end + 1;
    return bytes;
  });
}
