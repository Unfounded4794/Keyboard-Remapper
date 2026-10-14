import fs from "node:fs/promises";
const header = await fs.readFile("build/qmk-keycodes.h", "utf8"),
  legacy = await fs.readFile("build/vial-keycodes-v5.py", "utf8"),
  stable = await fs.readFile("build/vial-keycodes-v6.py", "utf8");
const values = new Map(),
  aliases = new Map();
for (const m of header.matchAll(/^\s*(\w+)\s*=\s*(0x[\da-fA-F]+|\w+)\s*,/gm)) {
  if (m[2].startsWith("0x")) values.set(m[1], parseInt(m[2], 16));
  else aliases.set(m[1], m[2]);
}
for (let i = 0; i < 5; i++)
  for (const [n, target] of aliases)
    if (values.has(target)) values.set(n, values.get(target));
const py = (text) =>
  new Map(
    [...text.matchAll(/"([\w()]+)"\s*:\s*(0x[\da-fA-F]+|\d+)/g)].map((m) => [
      m[1],
      Number(m[2]),
    ]),
  );
const old = py(legacy),
  mid = py(stable);
const rows = [];
const used = new Set();
for (const [name, value] of values) {
  if (used.has(value) || name.endsWith("_MAX")) continue;
  if (!(
    /^KC_F(?:1[3-9]|2[0-4])$/.test(name) ||
    /^KC_(EXECUTE|HELP|MENU|SELECT|STOP|AGAIN|UNDO|CUT|COPY|PASTE|FIND|LOCKING_|INTERNATIONAL_|LANGUAGE_|ALTERNATE_ERASE|SYSTEM_POWER|SYSTEM_SLEEP|SYSTEM_WAKE|CALCULATOR|MAIL|MY_COMPUTER|WWW_|BRIGHTNESS_|MISSION_CONTROL|LAUNCHPAD)/.test(
      name,
    ) ||
    /^QK_(MOUSE_|MAGIC_|AUDIO_|CLICKY_|MUSIC_|BACKLIGHT_|RGBLIGHT_|RGB_MATRIX_|BOOT|DEBUG|CLEAR_EEPROM)/.test(
      name,
    )
  ))
    continue;
  const names = [
    name,
    ...[...values].filter(([, v]) => v === value).map(([n]) => n),
  ];
  const lookup = (table) =>
    names.map((n) => table.get(n)).find((v) => v !== undefined) ??
    (value < 0xa5 ? value : undefined);
  const category = /^QK_(BACKLIGHT|RGB)/.test(name)
    ? "Lighting"
    : /^KC_(MISSION_CONTROL|LAUNCHPAD)/.test(name)
      ? "Platform"
      : "Special";
  let label = name
    .replace(/^(KC_|QK_)/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Mouse Cursor", "Mouse")
    .replace("Mouse Button", "Mouse Btn")
    .replace("Mouse Acceleration", "Mouse Accel")
    .replace("Magic ", "")
    .replace("System ", "")
    .replace("Rgb Matrix", "RGB")
    .replace("Rgblight", "RGB")
    .replace("International", "Intl")
    .replace("Language", "Lang");
  rows.push({
    value,
    name,
    label,
    category,
    legacy: lookup(old),
    stable: lookup(mid),
  });
  used.add(value);
}
await fs.writeFile(
  "src/core/special-keycodes.json",
  JSON.stringify(rows, null, 2),
);
console.log(`Added ${rows.length} special keycodes.`);
