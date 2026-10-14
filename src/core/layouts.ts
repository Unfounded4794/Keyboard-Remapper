import type { Definition, PhysicalKey } from "../types";
import { byCode } from "./keycodes";
export type TesterSize = "100%" | "TKL" | "75%" | "65%" | "60%";
export function testerDefinition(size: TesterSize = "100%"): Definition {
  const keys: PhysicalKey[] = [];
  const add = (
    row: number,
    col: number,
    code: string,
    x: number,
    y: number,
    w = 1,
    h = 1,
    option?: [number, number],
    shape?: Partial<PhysicalKey>,
  ) =>
    keys.push({
      id: `${row},${col}`,
      row,
      col,
      x,
      y,
      w,
      h,
      defaultCode: byCode.get(code)?.value ?? 0,
      option,
      ...shape,
    });
  const full = size === "100%",
    fn = size === "100%" || size === "TKL" || size === "75%",
    nav = full || size === "TKL";
  const yOffset = fn ? 1.5 : 0;
  if (fn) {
    add(0, 0, "Escape", 0, 0);
    for (let i = 1; i <= 12; i++)
      add(0, i, `F${i}`, i + 1 + Math.floor((i - 1) / 4) * 0.5, 0);
    if (nav)
      ["PrintScreen", "ScrollLock", "Pause"].forEach((c, i) =>
        add(0, 16 + i, c, 15.25 + i, 0),
      );
  }
  function row(r: number, codes: (string | [string, number])[], offset = 0) {
    let x = offset;
    codes.forEach((entry, col) => {
      const [c, w] = typeof entry === "string" ? [entry, 1] : entry;
      add(r, col, c, x, r - 1 + yOffset, w);
      x += w;
    });
  }
  row(1, [
    "Backquote",
    ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
    "Minus",
    "Equal",
    ["Backspace", 2],
  ]);
  if (!fn) keys[0].defaultCode = 41;
  row(2, [
    ["Tab", 1.5],
    ..."QWERTYUIOP".split("").map((c) => `Key${c}`),
    "BracketLeft",
    "BracketRight",
    ["Backslash", 1.5],
  ]);
  row(3, [
    ["CapsLock", 1.75],
    ..."ASDFGHJKL".split("").map((c) => `Key${c}`),
    "Semicolon",
    "Quote",
    ["Enter", 2.25],
  ]);
  row(4, [
    ["ShiftLeft", 2.25],
    ..."ZXCVBNM".split("").map((c) => `Key${c}`),
    "Comma",
    "Period",
    "Slash",
    ["ShiftRight", 2.75],
  ]);
  row(5, [
    ["ControlLeft", 1.25],
    ["MetaLeft", 1.25],
    ["AltLeft", 1.25],
    ["Space", 6.25],
    ["AltRight", 1.25],
    ["MetaRight", 1.25],
    ["ContextMenu", 1.25],
    ["ControlRight", 1.25],
  ]);
  keys
    .filter(
      (k) =>
        (k.row === 2 && k.col === 13) ||
        (k.row === 3 && k.col === 12) ||
        (k.row === 4 && k.col === 0),
    )
    .forEach((k) => (k.option = [0, 0]));
  add(3, 13, "IntlBackslash", 12.75, 2 + yOffset, 1, 1, [0, 1]);
  keys.at(-1)!.defaultCode = 50;
  add(3, 12, "Enter", 13.75, 1 + yOffset, 1.25, 2, [0, 1], {
    x2: -0.25,
    y2: 0,
    w2: 1.5,
    h2: 1,
  });
  add(4, 0, "ShiftLeft", 0, 3 + yOffset, 1.25, 1, [0, 1]);
  add(4, 14, "IntlBackslash", 1.25, 3 + yOffset, 1, 1, [0, 1]);
  keys.filter((k) => k.row === 5).forEach((k) => (k.option = [1, 0]));
  let bottomX = 0;
  [
    ["ControlLeft", 1.5],
    ["MetaLeft", 1],
    ["AltLeft", 1.5],
    ["Space", 7],
    ["AltRight", 1.5],
    ["MetaRight", 1],
    ["ControlRight", 1.5],
  ].forEach(([c, w], col) => {
    add(5, col, String(c), bottomX, 4 + yOffset, Number(w), 1, [1, 1]);
    bottomX += Number(w);
  });
  if (nav) {
    ["Insert", "Home", "PageUp"].forEach((c, i) =>
      add(1, 16 + i, c, 15.25 + i, yOffset),
    );
    ["Delete", "End", "PageDown"].forEach((c, i) =>
      add(2, 16 + i, c, 15.25 + i, 1 + yOffset),
    );
    add(4, 17, "ArrowUp", 16.25, 3 + yOffset);
    ["ArrowLeft", "ArrowDown", "ArrowRight"].forEach((c, i) =>
      add(5, 16 + i, c, 15.25 + i, 4 + yOffset),
    );
  } else if (size !== "60%") {
    ["Delete", "Home", "PageUp", "PageDown"].forEach((c, i) =>
      add(i + 1, 16, c, 15.25, i + yOffset),
    );
    add(4, 17, "ArrowUp", 14, 3 + yOffset);
    ["ArrowLeft", "ArrowDown", "ArrowRight"].forEach((c, i) =>
      add(5, 16 + i, c, 13 + i, 4 + yOffset),
    );
    for (const k of keys) {
      if (k.row === 4 && k.col === 11) k.w = 1.75;
      if (k.row === 5 && k.col >= 4 && k.col <= 7) k.option = [2, 1];
    }
    add(5, 8, "AltRight", 10, 4 + yOffset, 1, 1, [1, 0]);
    add(5, 9, "MetaRight", 11, 4 + yOffset, 1, 1, [1, 0]);
    add(5, 10, "ControlRight", 12, 4 + yOffset, 1, 1, [1, 0]);
    add(5, 8, "AltRight", 11, 4 + yOffset, 1, 1, [1, 1]);
    add(5, 9, "ControlRight", 12, 4 + yOffset, 1, 1, [1, 1]);
  }
  if (full) {
    ["NumLock", "NumpadDivide", "NumpadMultiply", "NumpadSubtract"].forEach(
      (c, i) => add(1, 20 + i, c, 18.75 + i, yOffset),
    );
    ["Numpad7", "Numpad8", "Numpad9"].forEach((c, i) =>
      add(2, 20 + i, c, 18.75 + i, 1 + yOffset),
    );
    add(2, 23, "NumpadAdd", 21.75, 1 + yOffset, 1, 2);
    ["Numpad4", "Numpad5", "Numpad6"].forEach((c, i) =>
      add(3, 20 + i, c, 18.75 + i, 2 + yOffset),
    );
    ["Numpad1", "Numpad2", "Numpad3"].forEach((c, i) =>
      add(4, 20 + i, c, 18.75 + i, 3 + yOffset),
    );
    add(4, 23, "NumpadEnter", 21.75, 3 + yOffset, 1, 2);
    add(5, 20, "Numpad0", 18.75, 4 + yOffset, 2);
    add(5, 22, "NumpadDecimal", 20.75, 4 + yOffset);
  }
  return {
    name: `${size} keyboard`,
    matrix: { rows: 6, cols: 24 },
    keys,
    labels: [
      ["Enter", "ANSI", "ISO"],
      ["Bottom row", "Standard", "Tsangan"],
      "Compact bottom row",
    ],
  };
}
