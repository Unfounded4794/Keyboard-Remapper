import { parseDefinition } from "./definitions";
import type { Definition } from "../types";
interface Entry {
  schema: number;
  path: string;
  definition: Record<string, unknown>;
}
let catalog: Promise<{ entries: Entry[]; count: number }> | undefined;
export function loadCatalog(): Promise<{ entries: Entry[]; count: number }> {
  return (catalog ??= fetch("./data/via-definitions.json").then((r) => {
    if (!r.ok) throw new Error("Keyboard database unavailable.");
    return r.json();
  }));
}
export async function findDefinitions(
  vendorId: number,
  productId: number,
  version: number,
): Promise<Definition[]> {
  let raw: unknown[];
  if (window.keystone?.definitions)
    raw = await window.keystone.definitions(vendorId, productId, version);
  else {
    const db = await loadCatalog();
    raw = db.entries
      .filter(
        (e) =>
          Number(e.definition.vendorId) === vendorId &&
          Number(e.definition.productId) === productId,
      )
      .sort((a, b) =>
        version >= 11 ? b.schema - a.schema : a.schema - b.schema,
      )
      .map((e) => e.definition);
  }
  const vendor = await fetch("./data/vendor-definitions.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  const definitions: Definition[] = [];
  let custom: unknown[] = [];
  try {
    custom = JSON.parse(localStorage.getItem("keystone.definitions") ?? "[]");
  } catch {}
  for (const d of [...custom, ...vendor, ...raw]) {
    try {
      const def = parseDefinition(d);
      if (
        def.vendorId === vendorId &&
        def.productId === productId &&
        !definitions.some(
          (s) =>
            s.name === def.name &&
            JSON.stringify(s.keys) === JSON.stringify(def.keys),
        )
      )
        definitions.push(def);
    } catch {}
  }
  return definitions;
}
