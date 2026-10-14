import type { Project } from "../types";
export function sameAssignment(
  a: Project,
  b: Project,
  layer: number,
  id: string,
) {
  const av = a.layers[layer]?.[id],
    bv = b.layers[layer]?.[id];
  if (av !== bv) return false;
  if (a.firmware === "ZMK" && av !== undefined && av >= 0x8000)
    return (
      JSON.stringify(a.bindings?.[av]) === JSON.stringify(b.bindings?.[bv!])
    );
  return true;
}
