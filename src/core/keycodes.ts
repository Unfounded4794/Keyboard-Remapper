import specials from "./special-keycodes.json";
export interface Keycode {
  value: number;
  label: string;
  name: string;
  category: string;
  code?: string;
  legacy?: number;
  stable?: number;
}
export const keycodes: Keycode[] = [];
function add(
  value: number,
  label: string,
  name: string,
  category = "Basic",
  code?: string,
) {
  keycodes.push({ value, label, name, category, code });
}
add(0, "None", "KC_NO", "Special");
add(1, "▽", "KC_TRNS", "Special");
for (let i = 0; i < 26; i++)
  add(
    4 + i,
    String.fromCharCode(65 + i),
    `KC_${String.fromCharCode(65 + i)}`,
    "Basic",
    `Key${String.fromCharCode(65 + i)}`,
  );
for (let i = 0; i < 10; i++)
  add(
    30 + i,
    String((i + 1) % 10),
    `KC_${(i + 1) % 10}`,
    "Basic",
    `Digit${(i + 1) % 10}`,
  );
const basics = [
  ["Enter", "ENT", "Enter"],
  ["Esc", "ESC", "Escape"],
  ["Bksp", "BSPC", "Backspace"],
  ["Tab", "TAB", "Tab"],
  ["Space", "SPC", "Space"],
  ["−", "MINS", "Minus"],
  ["=", "EQL", "Equal"],
  ["[", "LBRC", "BracketLeft"],
  ["]", "RBRC", "BracketRight"],
  ["\\", "BSLS", "Backslash"],
  ["ISO #", "NUHS", ""],
  [";", "SCLN", "Semicolon"],
  ["'", "QUOT", "Quote"],
  ["`", "GRV", "Backquote"],
  [",", "COMM", "Comma"],
  [".", "DOT", "Period"],
  ["/", "SLSH", "Slash"],
  ["Caps", "CAPS", "CapsLock"],
];
basics.forEach(([label, name, code], i) =>
  add(40 + i, label, `KC_${name}`, "Basic", code),
);
for (let i = 1; i <= 12; i++)
  add(57 + i, `F${i}`, `KC_F${i}`, "Function", `F${i}`);
[
  ["PrtSc", "PSCR", "PrintScreen"],
  ["ScrLk", "SCRL", "ScrollLock"],
  ["Pause", "PAUS", "Pause"],
  ["Ins", "INS", "Insert"],
  ["Home", "HOME", "Home"],
  ["PgUp", "PGUP", "PageUp"],
  ["Del", "DEL", "Delete"],
  ["End", "END", "End"],
  ["PgDn", "PGDN", "PageDown"],
  ["→", "RGHT", "ArrowRight"],
  ["←", "LEFT", "ArrowLeft"],
  ["↓", "DOWN", "ArrowDown"],
  ["↑", "UP", "ArrowUp"],
].forEach(([l, n, c], i) => add(70 + i, l, `KC_${n}`, "Navigation", c));
[
  ["Num", "NUM", "NumLock"],
  ["Num /", "PSLS", "NumpadDivide"],
  ["Num *", "PAST", "NumpadMultiply"],
  ["Num −", "PMNS", "NumpadSubtract"],
  ["Num +", "PPLS", "NumpadAdd"],
  ["Num ↵", "PENT", "NumpadEnter"],
  ["Num 1", "P1", "Numpad1"],
  ["Num 2", "P2", "Numpad2"],
  ["Num 3", "P3", "Numpad3"],
  ["Num 4", "P4", "Numpad4"],
  ["Num 5", "P5", "Numpad5"],
  ["Num 6", "P6", "Numpad6"],
  ["Num 7", "P7", "Numpad7"],
  ["Num 8", "P8", "Numpad8"],
  ["Num 9", "P9", "Numpad9"],
  ["Num 0", "P0", "Numpad0"],
  ["Num .", "PDOT", "NumpadDecimal"],
  ["ISO \\", "NUBS", "IntlBackslash"],
  ["Menu", "APP", "ContextMenu"],
].forEach(([l, n, c], i) => add(83 + i, l, `KC_${n}`, "Numpad", c));
["LCtrl", "LShift", "LAlt", "LGui", "RCtrl", "RShift", "RAlt", "RGui"].forEach(
  (l, i) =>
    add(
      224 + i,
      l,
      `KC_${["LCTL", "LSFT", "LALT", "LGUI", "RCTL", "RSFT", "RALT", "RGUI"][i]}`,
      "Modifiers",
      [
        "ControlLeft",
        "ShiftLeft",
        "AltLeft",
        "MetaLeft",
        "ControlRight",
        "ShiftRight",
        "AltRight",
        "MetaRight",
      ][i],
    ),
);
[
  [0xa8, "Mute", "MUTE"],
  [0xa9, "Vol +", "VOLU"],
  [0xaa, "Vol −", "VOLD"],
  [0xab, "Next", "MNXT"],
  [0xac, "Prev", "MPRV"],
  [0xae, "Play", "MPLY"],
].forEach(([v, l, n]) =>
  add(
    Number(v),
    String(l),
    `KC_${n}`,
    "Media",
    (
      {
        MUTE: "AudioVolumeMute",
        VOLU: "AudioVolumeUp",
        VOLD: "AudioVolumeDown",
        MNXT: "MediaTrackNext",
        MPRV: "MediaTrackPrevious",
        MPLY: "MediaPlayPause",
      } as Record<string, string>
    )[String(n)],
  ),
);
for (const k of specials)
  if (!keycodes.some((existing) => existing.value === k.value))
    keycodes.push({
      ...k,
      code: /^KC_F\d+$/.test(k.name) ? k.name.slice(3) : undefined,
    });
for (const [label, value] of [
  ["Mac Copy", 0x0806],
  ["Mac Paste", 0x0819],
  ["Mac Undo", 0x081d],
  ["Mac Spotlight", 0x082c],
  ["Linux Terminal", 0x0517],
  ["Linux Lock", 0x080f],
  ["Windows Explorer", 0x0808],
  ["Windows Desktop", 0x0807],
  ["Windows Lock", 0x080f],
] as const)
  keycodes.push({
    label,
    value,
    name: label,
    category: "Platform",
    legacy: value,
    stable: value,
  });
export function keycodesFor(
  table: "current" | "stable" | "legacy" = "current",
) {
  return keycodes
    .map((k) => ({
      ...k,
      value:
        table === "current"
          ? k.value
          : (k[table] ??
            (k.value < 0xa5 ||
            k.category === "Modifiers" ||
            k.category === "Media"
              ? k.value
              : -1)),
    }))
    .filter((k) => k.value >= 0);
}
export const byValue = new Map(keycodes.map((k) => [k.value, k]));
export const byCode = new Map(
  keycodes.filter((k) => k.code).map((k) => [k.code!, k]),
);
export function hex(n: number) {
  return `0x${n.toString(16).toUpperCase().padStart(4, "0")}`;
}
export function labelFor(n: number) {
  return byValue.get(n)?.label ?? hex(n);
}
export function macroKeycode(slot: number, version: number) {
  return (version >= 11 ? 0x7700 : 0x5f12) + slot;
}
export function layerKeycode(layer: number, version: number) {
  return (version >= 11 ? 0x5220 : 0x5100) + layer;
}
