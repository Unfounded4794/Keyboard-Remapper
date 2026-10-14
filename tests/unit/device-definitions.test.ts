import fs from "node:fs";
import { it, expect } from "vitest";
import { parseDefinition } from "../../src/core/definitions";
import {
  definitionId,
  resolveDefinition,
} from "../../src/core/device-definitions";
const raw = JSON.parse(
  fs.readFileSync("public/data/vendor-definitions.json", "utf8"),
);
const definitions = raw.map((d: unknown) => parseDefinition(d));
it("validates every supplemental vendor PCB and normalizes USB identifiers", () => {
  expect(definitions.length).toBeGreaterThan(100);
  for (const d of definitions) {
    expect(typeof d.vendorId).toBe("number");
    expect(typeof d.productId).toBe("number");
  }
  for (const brand of [
    "Createkeebs",
    "Luminkey",
    "Meletrix",
    "Owlab",
    "Qwertykeys",
    "Neo",
    "Wind",
    "NIZ",
    "Wuque",
  ])
    expect(
      definitions.some((d: { name: string }) => d.name.startsWith(brand)),
    ).toBe(true);
});
it("includes the actual FEED:6060 Glacier80 and keeps its matrix separate from Thera", () => {
  const shared = definitions.filter(
    (d: { vendorId: number; productId: number }) =>
      d.vendorId === 0xfeed && d.productId === 0x6060,
  );
  const glacier = shared.find((d: { name: string }) =>
    d.name.includes("Glacier80"),
  )!;
  expect(glacier.matrix).toEqual({ rows: 6, cols: 17 });
  expect(
    shared.find((d: { name: string }) => d.name.includes("Thera75 V2")).matrix,
  ).toEqual({ rows: 6, cols: 15 });
  expect(resolveDefinition(shared, "keyboard")).toBeUndefined();
  expect(resolveDefinition(shared, "USB Keyboard")).toBeUndefined();
  expect(resolveDefinition(shared, "keyboard", definitionId(glacier))).toBe(
    glacier,
  );
});
it("uses exact product names or a single definition and never reuses stale remembered selections", () => {
  const glacier = definitions.find((d: { name: string }) =>
    d.name.includes("Glacier80"),
  )!;
  const thera = definitions.find((d: { name: string }) =>
    d.name.includes("Thera75 V2 (Hotswap)"),
  )!;
  expect(resolveDefinition([glacier, thera], "Glacier80")).toBe(glacier);
  expect(
    resolveDefinition([glacier, thera], "keyboard", "obsolete"),
  ).toBeUndefined();
  expect(resolveDefinition([glacier], "keyboard")).toBe(glacier);
  expect(resolveDefinition([], "keyboard")).toBeUndefined();
});
it("keeps definition selection stable when theme identities are captured", () => {
  const d = definitions[0];
  expect(
    definitionId({
      ...d,
      keys: d.keys.map((k: object) => ({ ...k, themeCode: 44 })),
    }),
  ).toBe(definitionId(d));
  const other = { ...d, labels: [...d.labels, "Additional layout"] };
  expect(definitionId(other)).not.toBe(definitionId(d));
});
