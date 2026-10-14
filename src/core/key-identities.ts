import type { Definition, Layers } from "../types";
// Preserve the cap's identity while its emitted binding is edited or saved.
// VIA definitions contain matrix addresses, so start with the device's base
// map. Recognize common edge keys when that base binding is already a macro.
export function captureKeyIdentities(
  d: Definition,
  layers: Layers,
  remembered: Record<string, number> = {},
): Definition {
  const first = layers[0] ?? {};
  const anchors = [
    [4, 57, "before"],
    [20, 43, "before"],
    [29, 225, "before"],
    [56, 229, "after"],
    [52, 40, "after"],
  ] as const;
  return {
    ...d,
    keys: d.keys.map((k) => {
      if (k.themeCode !== undefined) return k;
      let code = k.defaultCode ?? remembered[k.id];
      if (code === undefined) {
        const value = first[k.id];
        if (value >= 4 && value <= 255) code = value;
        else
          for (const [anchor, identity, side] of anchors) {
            const a = d.keys.find(
              (other) =>
                first[other.id] === anchor && Math.abs(other.y - k.y) < 0.2,
            );
            if (
              a &&
              Math.abs(side === "before" ? k.x + k.w - a.x : a.x + a.w - k.x) <
                0.25
            ) {
              code = identity;
              break;
            }
          }
      }
      return code === undefined ? k : { ...k, themeCode: code };
    }),
  };
}
