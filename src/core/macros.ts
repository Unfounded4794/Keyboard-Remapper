import type { Macro } from "../types";
export type MacroFormat = "legacy" | "via" | "vial";
export function encodeMacro(macro: Macro, format: MacroFormat): number[] {
  const bytes: number[] = [];
  let previous = 0;
  const held = new Set<number>();
  for (const e of macro.events) {
    if (
      !Number.isInteger(e.keycode) ||
      e.keycode < 4 ||
      e.keycode > 255 ||
      !Number.isFinite(e.at) ||
      e.at < previous
    )
      throw new Error("Macro contains an unsupported key or invalid timing.");
    let delay = Math.round(e.at - previous);
    if (format === "vial")
      while (delay > 0) {
        const ms = Math.min(delay, 65024);
        bytes.push(1, 4, (ms % 255) + 1, Math.floor(ms / 255) + 1);
        delay -= ms;
      }
    if (format === "via")
      while (delay > 0) {
        const ms = Math.min(delay, 9999);
        bytes.push(
          1,
          4,
          ...String(ms)
            .split("")
            .map((c) => c.charCodeAt(0)),
          124,
        );
        delay -= ms;
      }
    const op = e.type === "down" ? 2 : 3;
    if (format !== "legacy") bytes.push(1, op, e.keycode);
    else bytes.push(op, e.keycode);
    if (e.type === "down") held.add(e.keycode);
    else held.delete(e.keycode);
    previous = e.at;
  }
  for (const code of held)
    bytes.push(...(format !== "legacy" ? [1, 3, code] : [3, code]));
  bytes.push(0);
  return bytes;
}
// Preserve every other macro slot byte-for-byte when replacing one slot.
export function replaceMacroSlot(
  buffer: Uint8Array,
  count: number,
  slot: number,
  encoded: number[],
) {
  if (slot < 0 || slot >= count)
    throw new Error(`Macro slot must be between 0 and ${count - 1}.`);
  const slots: number[][] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const end = buffer.indexOf(0, offset);
    if (end < 0)
      throw new Error(
        "Keyboard macro memory is malformed. Back it up in the original configurator.",
      );
    slots.push(Array.from(buffer.slice(offset, end + 1)));
    offset = end + 1;
  }
  slots[slot] = encoded;
  const bytes = slots.flat();
  if (bytes.length > buffer.length)
    throw new Error(
      `Macros need ${bytes.length} bytes; keyboard has ${buffer.length}.`,
    );
  const result = new Uint8Array(buffer.length);
  result.set(bytes);
  return result;
}
