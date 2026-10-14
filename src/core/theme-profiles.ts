// Key identities are USB keyboard usages, independent of matrix coordinates,
// the board's left/right placement, selected layer, and remapping drafts.
export interface CapColors {
  cap: string;
  text: string;
}
export interface ThemeProfile {
  id: string;
  name: string;
  source: string;
  alpha: CapColors;
  modifier: CapColors;
  accent: CapColors;
  uiAccent: string;
  keys: Record<number, CapColors>;
}
const color = (cap: string, text: string): CapColors => ({ cap, text });
const profiles: ThemeProfile[] = [];
function create(
  id: string,
  name: string,
  source: string,
  alpha: CapColors,
  modifier: CapColors,
  accent: CapColors,
  uiAccent = accent.cap,
) {
  const p = { id, name, source, alpha, modifier, accent, uiAccent, keys: {} };
  profiles.push(p);
  return p as ThemeProfile;
}
function put(p: ThemeProfile, codes: number[], colors: CapColors) {
  for (const code of codes) p.keys[code] = colors;
}
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);
const letters = (s: string) => [...s].map((c) => c.charCodeAt(0) - 61);
const fn1 = [58, 59, 60, 61],
  fn2 = [62, 63, 64, 65],
  fn3 = [66, 67, 68, 69];
const arrows = [79, 80, 81, 82],
  enters = [40, 88],
  accents = [41, ...enters];

// Each profile follows the main assembled/base-kit arrangement in the user's
// named reference. Optional accent kits shown below it are not mixed in.
{
  const p = create(
    "gateway",
    "GMK Gateway",
    "gateway.webp",
    color("#efefec", "#368cbd"),
    color("#368fc5", "#f4f5f1"),
    color("#f47e25", "#fff5e8"),
  );
  put(p, [41, 43, 57, 224, 225, 226, 227, 88, ...arrows], p.accent);
  put(p, [40], p.modifier);
  put(
    p,
    [53, ...range(30, 34), ...letters("QWERTASDFGZXCVB"), ...fn1],
    color(p.alpha.cap, "#e87935"),
  );
  put(p, fn2, p.modifier);
  put(p, fn3, p.alpha);
}
{
  const red = "#e53727",
    orange = "#e48731",
    yellow = "#e8e12d",
    green = "#45964b",
    blue = "#3476cf",
    purple = "#9257ba";
  const p = create(
    "midnight-rainbow",
    "GMK Midnight Rainbow",
    "midnight rainbow.webp",
    color("#151515", blue),
    color("#151515", purple),
    color("#151515", red),
    purple,
  );
  for (const [codes, text] of [
    [
      [41, 43, 57, 224, 225, 53, 30, 31, 32, 58, 59, 60, ...letters("QWA")],
      red,
    ],
    [
      [
        33,
        34,
        61,
        62,
        226,
        227,
        83,
        84,
        89,
        90,
        92,
        93,
        95,
        96,
        98,
        ...letters("ERSDZX"),
      ],
      orange,
    ],
    [[35, 36, 63, 64, 72, 75, 78, ...letters("TYFGCV")], yellow],
    [[37, 38, 65, 66, 71, 74, 77, ...arrows, ...letters("UIHJBN")], green],
    [[39, 45, 67, 68, 70, 73, 76, 54, ...letters("OPKLM")], blue],
    [
      [46, 47, 48, 49, 50, 51, 52, 55, 56, 69, 40, 229, 228, 230, 231, 101],
      purple,
    ],
    [[85, 86, 87, 88, 91, 94, 97, 99], red],
  ] as [number[], string][])
    put(p, codes, color(p.alpha.cap, text));
}
{
  const p = create(
    "awaken",
    "GMK Awaken",
    "awakens.jpg",
    color("#303a42", "#dfb14a"),
    color("#303a42", "#a9d9d5"),
    color("#303a42", "#cc4b60"),
    "#dfb14a",
  );
  put(p, [41, ...enters, ...arrows], p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "reforged",
    "GMK Reforged",
    "reforged.webp",
    color("#a64b21", "#e9d6b8"),
    color("#29383e", "#e9d6b8"),
    color("#e1d4bf", "#8d3b1b"),
  );
  put(p, accents, p.accent);
}
{
  const cyan = "#42b4b1",
    pink = "#d73070",
    purple = "#9563bd",
    orange = "#db7834",
    yellow = "#d9c34b";
  const p = create(
    "mictlan",
    "GMK Mictlan",
    "mictlan.webp",
    color("#202423", cyan),
    color("#202423", cyan),
    color("#e48338", "#252525"),
    orange,
  );
  for (const [codes, text] of [
    [
      [
        41,
        59,
        63,
        66,
        57,
        52,
        227,
        226,
        ...letters("WDOHJN"),
        34,
        37,
        45,
        47,
        49,
        50,
        54,
        98,
        92,
        93,
        85,
        88,
      ],
      cyan,
    ],
    [
      [58, 62, 67, 53, 33, 38, ...letters("QTUSLVX"), 225, 90, 94, 99, 73],
      purple,
    ],
    [
      [60, 69, 71, 31, 36, ...letters("RPG"), 48, 55, 101, 83, 91, 95, 76],
      pink,
    ],
    [[61, 65, 70, 30, 43, 46, ...letters("EYFKZ"), 56, 89, 97, 75], orange],
    [
      [
        64,
        68,
        72,
        32,
        35,
        39,
        42,
        ...letters("IAB"),
        51,
        229,
        228,
        230,
        84,
        87,
        96,
        77,
        78,
      ],
      yellow,
    ],
  ] as [number[], string][])
    put(p, codes, color(p.alpha.cap, text));
  put(p, [40], p.accent);
  put(p, [80], color("#dd2764", "#252525"));
  put(p, [81], color("#df7c2e", "#252525"));
  put(p, [79], color("#8e54c5", "#252525"));
  put(p, [82], color("#e7ca37", "#252525"));
}
{
  const p = create(
    "lazurite",
    "GMK Lazurite",
    "lazurite.png",
    color("#164e9b", "#d5dae2"),
    color("#cdd1d5", "#164e91"),
    color("#cdd1d5", "#164e91"),
    "#7faaf0",
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const navy = color("#15165c", "#e3e2dd"),
    blue = color("#294b9a", "#e3e2dd"),
    cyan = color("#548fad", "#e3e2dd"),
    aqua = color("#75b0b8", "#e3e2dd"),
    white = color("#dbdcdc", "#303f78");
  const p = create(
    "great-wave",
    "KAT Great Wave",
    "great wave.webp",
    white,
    white,
    navy,
    "#83b9d7",
  );
  put(
    p,
    [41, 43, 57, 225, 224, 53, 30, 31, 32, 58, 59, 60, ...letters("QWAS")],
    navy,
  );
  put(p, [33, 34, 61, 227, 226, ...letters("ERDZ")], blue);
  put(p, [35, 62, ...letters("TFX")], cyan);
  put(p, [36, 63, ...letters("YGC")], aqua);
}
{
  const p = create(
    "half-blade",
    "MW Half Blade",
    "half blade.webp",
    color("#29354f", "#c14b54"),
    color("#232933", "#c14b54"),
    color("#ad303d", "#f1d8cf"),
    "#d25b65",
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const brown = "#594b3c",
    white = "#eee5cf",
    green = "#87bfa0",
    blue = "#7fbcc4",
    orange = "#d2a25e",
    purple = "#b698bd",
    red = "#c5746d";
  const p = create(
    "donuts",
    "DMK Donuts",
    "donuts.jpg",
    color(brown, white),
    color("#eee5cf", "#514839"),
    color("#eee5cf", "#514839"),
    "#d5b78f",
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
  for (const [codes, text] of [
    [[31, 34, 37, ...letters("EYOFJAXB"), 58, 61, 69, 92, 96], green],
    [[32, 35, 38, ...letters("QRUPSGKCN"), 67, 90, 94, 95, 99], blue],
    [[59, 68, 93], orange],
    [[60, 66, 53, 89], purple],
    [[97], red],
  ] as [number[], string][])
    put(p, codes, color(brown, text));
  // Cream modifiers and arrows retain their brown legends; keypad 0 is cream-on-brown.
  put(p, [98], p.alpha);
}
{
  const p = create(
    "mizu",
    "GMK Mizu",
    "mizu.avif",
    color("#9dcede", "#102b40"),
    color("#173e63", "#f5f8f7"),
    color("#f5f6f4", "#102b40"),
    "#9dcede",
  );
  put(p, [...accents, ...arrows], p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "stone-age",
    "MW Stone Age",
    "stone age.webp",
    color("#dadcd6", "#6b8970"),
    color("#72957a", "#e4e5d8"),
    color("#c9be96", "#64755c"),
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "red-samurai",
    "GMK Red Samurai",
    "red samurai.jpg",
    color("#6b293b", "#c7ac62"),
    color("#2c2e30", "#c7ac62"),
    color("#bea45e", "#6b293b"),
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "hammerhead-dark",
    "GMK Hammerhead Dark",
    "hammerhead.png",
    color("#172232", "#58c7b8"),
    color("#334159", "#58c7b8"),
    color("#53cbb8", "#153a42"),
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "deku",
    "GMK Deku",
    "deku.jpg",
    color("#08777b", "#dce3d9"),
    color("#e1e1d3", "#27665d"),
    color("#ad2730", "#f4e7df"),
    "#e07573",
  );
  put(p, [...accents, ...arrows], p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "mecha-01",
    "GMK Mecha-01",
    "mecha 01.webp",
    color("#6339ae", "#70b84e"),
    color("#242526", "#70b84e"),
    color("#79bc16", "#314128"),
    "#9bd344",
  );
  put(p, [41, 44], p.accent);
  put(p, [...enters, ...arrows], color(p.modifier.cap, "#dab348"));
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "basin",
    "PBTfans Basin",
    "basin.webp",
    color("#304b61", "#26a694"),
    color("#253039", "#dce4e4"),
    color("#15b39d", "#e0ece6"),
  );
  put(p, accents, p.accent);
  put(p, range(58, 69), color("#3d7095", p.alpha.text));
  put(p, [53, ...range(30, 39), 45, 46], color("#365e7f", p.alpha.text));
  put(
    p,
    [...letters("QWERTYUIOP"), 47, 48, 49, 50],
    color("#304b61", p.alpha.text),
  );
  put(p, [...letters("ASDFGHJKL"), 51, 52], color("#2f3b49", p.alpha.text));
  put(
    p,
    [...letters("ZXCVBNM"), 54, 55, 56, 44],
    color("#2d3849", p.alpha.text),
  );
}
{
  const p = create(
    "black-panther",
    "MT3 Black Panther",
    "black panther.webp",
    color("#3d305f", "#c6c1ce"),
    color("#303235", "#c6c6cb"),
    color("#303235", "#c6c6cb"),
    "#b39bd4",
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "fuji",
    "GMK Fuji",
    "fuji.webp",
    color("#d7dee0", "#303749"),
    color("#777d96", "#303749"),
    color("#e4bacc", "#f7f3f0"),
  );
  put(p, accents, p.accent);
  put(p, fn2, p.modifier);
}
{
  const p = create(
    "wavez",
    "GMK Wavez",
    "wavez.webp",
    color("#174851", "#7be444"),
    color("#26373e", "#7be444"),
    color("#26373e", "#7be444"),
    "#7be444",
  );
  put(p, accents, p.accent);
}
{
  const p = create(
    "hero",
    "GMK Hero",
    "hero.avif",
    color("#3c5d47", "#c1a269"),
    color("#2c3032", "#c1a269"),
    color("#b68b51", "#303331"),
  );
  put(p, [...accents, ...arrows], p.accent);
  put(p, range(58, 69), p.modifier);
}
export const referenceProfiles: readonly ThemeProfile[] = profiles;
export function isAlphaUsage(code: number): boolean {
  return (
    (code >= 4 && code <= 39) ||
    code === 44 ||
    (code >= 45 && code <= 56) ||
    (code >= 58 && code <= 69) ||
    (code >= 89 && code <= 100)
  );
}
export function referenceKeyColors(
  id: string,
  code: number | undefined,
  fallback: "alpha" | "mod" | "accent" = "mod",
): CapColors | undefined {
  const p = profiles.find((p) => p.id === id);
  if (!p) return undefined;
  if (code !== undefined && p.keys[code]) return p.keys[code];
  if (code !== undefined && code >= 4 && code <= 255)
    return isAlphaUsage(code) ? p.alpha : p.modifier;
  return fallback === "alpha"
    ? p.alpha
    : fallback === "accent"
      ? p.accent
      : p.modifier;
}
