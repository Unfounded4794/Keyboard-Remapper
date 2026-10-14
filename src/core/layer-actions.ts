export const layerActions = [
  { id: "MO", label: "Hold", description: "Activate this layer while held." },
  {
    id: "TG",
    label: "Toggle",
    description: "Turn this layer on or off with each press.",
  },
  {
    id: "TO",
    label: "Switch",
    description: "Switch to this layer and turn off other non-default layers.",
  },
  {
    id: "DF",
    label: "Default",
    description: "Set the default layer until the keyboard restarts.",
  },
  {
    id: "OSL",
    label: "One shot",
    description: "Activate this layer for the next keypress.",
  },
  {
    id: "TT",
    label: "Tap toggle",
    description:
      "Hold to activate; tap repeatedly to toggle. Tap count depends on firmware.",
  },
  {
    id: "PDF",
    label: "Save default",
    description:
      "Save this as the default layer across keyboard restarts. Requires firmware support.",
  },
] as const;
export type LayerAction = (typeof layerActions)[number]["id"];
const current: Record<LayerAction, number> = {
  TO: 0x5200,
  MO: 0x5220,
  DF: 0x5240,
  TG: 0x5260,
  OSL: 0x5280,
  TT: 0x52c0,
  PDF: 0x52e0,
};
const legacy: Partial<Record<LayerAction, number>> = {
  TO: 0x5010,
  MO: 0x5100,
  DF: 0x5200,
  TG: 0x5300,
  OSL: 0x5400,
  TT: 0x5800,
};
export function actionCode(
  action: LayerAction,
  layer: number,
  version: number,
): number | undefined {
  const base = (version >= 11 ? current : legacy)[action];
  return base === undefined || layer < 0 || layer > (version >= 11 ? 31 : 15)
    ? undefined
    : base + layer;
}
export function layerActionLabel(
  code: number,
  version: number,
): string | undefined {
  const table = version >= 11 ? current : legacy;
  for (const a of layerActions) {
    const base = table[a.id];
    if (
      base !== undefined &&
      code >= base &&
      code < base + (version >= 11 ? 32 : 16)
    )
      return `${a.id}(${code - base})`;
  }
  if (code >= 0x4000 && code <= 0x4fff) return `LT(${(code >> 8) & 15})`;
  const lmBase = version >= 11 ? 0x5000 : 0x5900,
    bits = version >= 11 ? 5 : 4;
  if (code >= lmBase && code < lmBase + (16 << bits))
    return `LM(${(code - lmBase) >> bits})`;
}
export function layerModifierCode(
  layer: number,
  modifier: number,
  version: number,
): number | undefined {
  if (
    !Number.isInteger(layer) ||
    layer < 0 ||
    layer > 15 ||
    !Number.isInteger(modifier) ||
    modifier < 1 ||
    modifier > (version >= 11 ? 31 : 15)
  )
    return undefined;
  return (
    (version >= 11 ? 0x5000 : 0x5900) |
    (layer << (version >= 11 ? 5 : 4)) |
    modifier
  );
}
