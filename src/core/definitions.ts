import type { Definition, Layers, PhysicalKey, Project } from "../types";
import { byCode } from "./keycodes";
const integer = (n: unknown, min: number, max: number): n is number =>
  Number.isInteger(n) && Number(n) >= min && Number(n) <= max;
export function validateDefinition(value: unknown): Definition {
  const d = value as Definition;
  if (
    !d ||
    typeof d.name !== "string" ||
    d.name.length > 160 ||
    !d.matrix ||
    !integer(d.matrix.rows, 1, 255) ||
    !integer(d.matrix.cols, 1, 255) ||
    !Array.isArray(d.keys) ||
    !d.keys.length ||
    d.keys.length > 1024
  )
    throw new Error(
      "Invalid keyboard definition: name, matrix and physical keys are required.",
    );
  for (const k of d.keys) {
    if (
      (k.encoder
        ? !integer(k.encoder.index, 0, 31) ||
          ![0, 1].includes(k.encoder.direction) ||
          k.id !== `encoder:${k.encoder.index}:${k.encoder.direction}`
        : !integer(k.row, 0, d.matrix.rows - 1) ||
          !integer(k.col, 0, d.matrix.cols - 1) ||
          k.id !== `${k.row},${k.col}`) ||
      (k.encoder?.virtual &&
        (!integer(k.row, 0, d.matrix.rows - 1) ||
          !integer(k.col, 0, d.matrix.cols - 1))) ||
      (k.knob !== undefined && !integer(k.knob, 0, 31)) ||
      ![k.x, k.y, k.w, k.h].every(Number.isFinite) ||
      Math.abs(k.x) > 200 ||
      Math.abs(k.y) > 200 ||
      k.w <= 0 ||
      k.h <= 0 ||
      k.w > 16 ||
      k.h > 16 ||
      (k.rotation !== undefined && !Number.isFinite(k.rotation)) ||
      (k.option &&
        (!Array.isArray(k.option) ||
          !integer(k.option[0], 0, 31) ||
          !integer(k.option[1], 0, 255)))
    )
      throw new Error("Invalid physical key or matrix coordinate.");
  }
  if (
    (d.vendorId !== undefined && !integer(d.vendorId, 0, 65535)) ||
    (d.productId !== undefined && !integer(d.productId, 0, 65535))
  )
    throw new Error("Invalid USB identifiers.");
  if (
    !Array.isArray(d.labels) ||
    d.labels.length > 32 ||
    d.labels.some(
      (l) =>
        typeof l !== "string" &&
        (!Array.isArray(l) ||
          l.length < 2 ||
          l.some((v) => typeof v !== "string")),
    )
  )
    throw new Error("Invalid layout options.");
  if (optionWidths(d).reduce((sum, bits) => sum + bits, 0) > 32)
    throw new Error("Layout options exceed the firmware’s 32-bit field.");
  for (const k of d.keys)
    if (k.option) {
      const label = d.labels[k.option[0]];
      if (label === undefined)
        throw new Error("Key references an undefined layout option.");
    }
  if (d.analog) {
    if (
      !["HE", "TMR"].includes(d.sensor!) ||
      d.analog.protocol !== "via-custom" ||
      !Array.isArray(d.analog.controls) ||
      d.analog.controls.length > 32
    )
      throw new Error("Unsupported analog profile.");
    const ids = new Set<string>();
    for (const c of d.analog.controls) {
      if (
        typeof c.id !== "string" ||
        ids.has(c.id) ||
        typeof c.label !== "string" ||
        typeof c.unit !== "string" ||
        ![c.min, c.max, c.step, c.default, c.scale].every(Number.isFinite) ||
        c.max <= c.min ||
        c.step <= 0 ||
        c.scale <= 0 ||
        c.default < c.min ||
        c.default > c.max ||
        c.min < 0 ||
        c.max * c.scale > (c.bytes === 1 ? 255 : 65535) ||
        !integer(c.channel, 0, 255) ||
        !integer(c.valueId, 0, 255) ||
        ![1, 2].includes(c.bytes)
      )
        throw new Error("Invalid analog control range or command.");
      ids.add(c.id);
    }
  }
  return d;
}
export function parseDefinition(
  input: unknown,
  source: "via" | "vial" = "via",
): Definition {
  const d = input as Record<string, any>;
  if (d?.keys) return validateDefinition({ ...d, labels: d.labels ?? [] });
  if (!d?.layouts?.keymap || !Array.isArray(d.layouts.keymap))
    throw new Error(
      "Choose a VIA/Vial definition JSON, or a Keystone definition.",
    );
  const keys: PhysicalKey[] = [];
  const keyColors = new Map<PhysicalKey, string>();
  let color = "#cccccc";
  let y = 0,
    rx = 0,
    ry = 0,
    r = 0;
  for (const row of d.layouts.keymap) {
    if (!Array.isArray(row)) continue;
    let x = rx,
      w = 1,
      h = 1,
      decal = false;
    let secondary: Partial<PhysicalKey> = {};
    for (let item of row) {
      // Older embedded Vial definitions sometimes serialize KLE property objects as strings.
      if (typeof item === "string" && /^\{\s*[a-z][\w]*\s*:/.test(item)) {
        try {
          item = JSON.parse(
            item.replace(/([{,]\s*)([a-z]\w*)\s*:/g, '$1"$2":'),
          );
        } catch {
          /* Keep unknown legends. */
        }
      }
      if (typeof item === "object" && item !== null) {
        if (typeof item.c === "string") color = item.c;
        if (item.r !== undefined) r = Number(item.r);
        if (item.rx !== undefined) {
          rx = Number(item.rx);
          x = rx;
          y = ry;
        }
        if (item.ry !== undefined) {
          ry = Number(item.ry);
          y = ry;
          x = rx;
        }
        x += Number(item.x ?? 0);
        y += Number(item.y ?? 0);
        w = Number(item.w ?? 1);
        h = Number(item.h ?? 1);
        decal = !!item.d;
        for (const prop of ["x2", "y2", "w2", "h2"] as const)
          if (item[prop] !== undefined) secondary[prop] = Number(item[prop]);
      } else if (typeof item === "string") {
        const legends = item.split("\n");
        const match = /^(\d+)\s*,\s*(\d+)$/.exec(legends[0].trim());
        const option = /^(\d+)\s*,\s*(\d+)$/.exec(legends[3]?.trim() ?? "");
        const encoder =
          source === "vial" && legends[9]?.trim() === "e" && match
            ? { index: +match[1], direction: +match[2] as 0 | 1 }
            : undefined;
        if (match && !decal)
          keys.push({
            id: encoder
              ? `encoder:${encoder.index}:${encoder.direction}`
              : `${+match[1]},${+match[2]}`,
            encoder,
            knob:
              source === "via" && legends[9]?.trim() === "e" ? 0 : undefined,
            row: +match[1],
            col: +match[2],
            x,
            y,
            w,
            h,
            ...secondary,
            rotation: r,
            rx,
            ry,
            option:
              option &&
              !(
                d.layouts.labels?.[+option[1]] === undefined && +option[2] === 0
              )
                ? [+option[1], +option[2]]
                : undefined,
          });
        x += w;
        if (match && !decal) keyColors.set(keys.at(-1)!, color);
        const viaEncoder = /^e(\d+)$/.exec(legends[9]?.trim() ?? "");
        if (viaEncoder && !decal) {
          const index = +viaEncoder[1];
          if (match) keys.at(-1)!.knob = index;
          for (const direction of [0, 1] as const) {
            const key: PhysicalKey = {
              id: `encoder:${index}:${direction}`,
              row: index,
              col: direction,
              x: x - w,
              y,
              w: 1,
              h: 1,
              encoder: { index, direction },
              option: option ? [+option[1], +option[2]] : undefined,
            };
            keys.push(key);
            keyColors.set(key, color);
          }
        }
        w = 1;
        h = 1;
        decal = false;
        secondary = {};
      }
    }
    y += 1;
  }
  const counts = new Map<string, number>();
  for (const k of keys)
    if (!k.option || k.option[1] === 0) {
      const c = keyColors.get(k)!;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  const colors = [...counts].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  for (const k of keys) {
    const index = colors.indexOf(keyColors.get(k)!);
    k.color = index === 1 ? "mod" : index === 2 ? "accent" : "alpha";
  }
  // KLE places alternate layouts outside the base keyboard. Align each variant's
  // upper-left pivot (including secondary rectangles) with choice zero.
  const groups = new Map<number, Map<number, PhysicalKey[]>>();
  for (const k of keys)
    if (k.option) {
      const [group, choice] = k.option;
      if (!groups.has(group)) groups.set(group, new Map());
      const choices = groups.get(group)!;
      choices.set(choice, [...(choices.get(choice) ?? []), k]);
    }
  const pivot = (items: PhysicalKey[]) => {
    const k = [...items].sort((a, b) => a.y - b.y || a.x - b.x)[0];
    const secondary = (k.y2 ?? 0) < 0 || ((k.y2 ?? 0) === 0 && (k.x2 ?? 0) < 0);
    return {
      x: k.x + (secondary ? (k.x2 ?? 0) : 0),
      y: k.y + (secondary ? (k.y2 ?? 0) : 0),
    };
  };
  for (const choices of groups.values()) {
    const zero = choices.get(0);
    if (!zero?.length) continue;
    const origin = pivot(zero);
    for (const [choice, items] of choices)
      if (choice !== 0) {
        const from = pivot(items),
          dx = origin.x - from.x,
          dy = origin.y - from.y;
        for (const k of items) {
          k.x += dx;
          k.y += dy;
          if (k.rotation) {
            k.rx = (k.rx ?? 0) + dx;
            k.ry = (k.ry ?? 0) + dy;
          }
        }
      }
  }
  const usb = (v: unknown) =>
    v === undefined
      ? undefined
      : typeof v === "string" && !v.startsWith("0x")
        ? parseInt(v, 16)
        : Number(v);
  // The GB3's embedded definition places the two turn actions on a helper row.
  // Its actual encoder push switch is the final switch, 0,7.
  if (usb(d.vendorId) === 0x5049 && usb(d.productId) === 2) {
    const push = keys.find((k) => k.id === "0,7");
    if (push && keys.some((k) => k.encoder?.index === 0)) push.knob = 0;
  }
  if (Array.isArray(d.keystone?.encoders)) {
    for (const e of d.keystone.encoders) {
      if (!integer(e.index, 0, 31)) throw new Error("Invalid encoder index.");
      const press = keys.find((k) => k.id === e.press);
      if (press) press.knob = e.index;
      for (const direction of [0, 1] as const) {
        const key = keys.find(
          (k) => k.id === (direction ? e.clockwise : e.counterclockwise),
        );
        if (key) {
          key.encoder = { index: e.index, direction, virtual: true };
          key.id = `encoder:${e.index}:${direction}`;
        }
      }
    }
  }
  return validateDefinition({
    name:
      typeof d.name === "object" && Array.isArray(d.name?.options)
        ? d.name.options.join(" / ")
        : (d.name ?? "Imported keyboard"),
    vendorId: usb(d.vendorId),
    productId: usb(d.productId),
    matrix: d.matrix,
    keys,
    labels: d.layouts.labels ?? [],
    sensor: d.keystone?.sensor,
    analog: d.keystone?.analog,
  });
}
export function visibleKeys(d: Definition, options: number[]) {
  return d.keys.filter(
    (k) => !k.option || k.option[1] === (options[k.option[0]] ?? 0),
  );
}
export function optionWidths(d: Definition) {
  return d.labels.map((l) =>
    typeof l === "string" ? 1 : Math.ceil(Math.log2(l.length - 1)),
  );
}
export function packOptions(d: Definition, options: number[]) {
  const widths = optionWidths(d);
  if (widths.reduce((a, b) => a + b, 0) > 32)
    throw new Error("Layout options exceed 32 bits.");
  let result = 0;
  for (let i = 0; i < widths.length; i++)
    result = result * 2 ** widths[i] + (options[i] ?? 0);
  return result >>> 0;
}
export function unpackOptions(d: Definition, value: number) {
  const widths = optionWidths(d),
    result: number[] = [];
  for (let i = widths.length - 1; i >= 0; i--) {
    result[i] = value % 2 ** widths[i];
    value = Math.floor(value / 2 ** widths[i]);
  }
  return result;
}
export function defaultLayers(d: Definition, count = 4): Layers {
  const defaults: Record<string, number> = {};
  for (const k of d.keys)
    if (defaults[k.id] === undefined) defaults[k.id] = k.defaultCode ?? 0;
  return Array.from({ length: count }, (_, layer) =>
    Object.fromEntries(
      Object.entries(defaults).map(([id, code]) => [id, layer ? 1 : code]),
    ),
  );
}
export function demoDefinition(): Definition {
  const keys: PhysicalKey[] = [];
  function row(y: number, codes: (string | [string, number])[], offset = 0) {
    let x = offset;
    codes.forEach((entry, col) => {
      const [code, w] = typeof entry === "string" ? [entry, 1] : entry;
      keys.push({
        id: `${y},${col}`,
        row: y,
        col,
        x,
        y,
        w,
        h: 1,
        defaultCode: byCode.get(code)?.value ?? 0,
      });
      x += w;
    });
  }
  row(0, [
    "Escape",
    ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
    "Minus",
    "Equal",
    ["Backspace", 2],
    "Insert",
  ]);
  row(1, [
    ["Tab", 1.5],
    ..."QWERTYUIOP".split("").map((c) => `Key${c}`),
    "BracketLeft",
    "BracketRight",
    ["Backslash", 1.5],
    "Delete",
  ]);
  row(2, [
    ["CapsLock", 1.75],
    ..."ASDFGHJKL".split("").map((c) => `Key${c}`),
    "Semicolon",
    "Quote",
    ["Enter", 2.25],
    "PageUp",
  ]);
  row(3, [
    ["ShiftLeft", 2.25],
    ..."ZXCVBNM".split("").map((c) => `Key${c}`),
    "Comma",
    "Period",
    "Slash",
    ["ShiftRight", 1.75],
    "ArrowUp",
    "PageDown",
  ]);
  row(4, [
    ["ControlLeft", 1.25],
    ["MetaLeft", 1.25],
    ["AltLeft", 1.25],
    ["Space", 6.25],
    "AltRight",
    "ContextMenu",
    "ControlRight",
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
  ]);
  // Alternate physical keys retain stable electrical matrix coordinates.
  for (const k of keys.filter(
    (k) =>
      (k.row === 1 && k.col === 13) ||
      (k.row === 2 && k.col === 12) ||
      (k.row === 3 && k.col === 0),
  ))
    k.option = [0, 0];
  keys.push(
    {
      id: "1,13",
      row: 1,
      col: 13,
      x: 12.75,
      y: 2,
      w: 1,
      h: 1,
      defaultCode: 50,
      option: [0, 1],
    },
    {
      id: "2,12",
      row: 2,
      col: 12,
      x: 13.75,
      y: 1,
      w: 1.25,
      h: 2,
      defaultCode: 40,
      option: [0, 1],
    },
    {
      id: "3,0",
      row: 3,
      col: 0,
      x: 0,
      y: 3,
      w: 1.25,
      h: 1,
      defaultCode: 225,
      option: [0, 1],
    },
    {
      id: "5,0",
      row: 5,
      col: 0,
      x: 1.25,
      y: 3,
      w: 1,
      h: 1,
      defaultCode: 100,
      option: [0, 1],
    },
  );
  for (const k of keys.filter((k) => k.row === 4 && k.col <= 3))
    k.option = [1, 0];
  keys.push(
    ...[1.5, 1, 1.5, 6].map((w, col) => ({
      id: `4,${col}`,
      row: 4,
      col,
      x: [0, 1.5, 2.5, 4][col],
      y: 4,
      w,
      h: 1,
      defaultCode: [224, 227, 226, 44][col],
      option: [1, 1] as [number, number],
    })),
  );
  return {
    name: "Studio 65",
    matrix: { rows: 6, cols: 16 },
    keys,
    labels: [
      ["Enter", "ANSI", "ISO"],
      ["Bottom row", "Standard · 6.25u", "Tsangan · 6u"],
    ],
  };
}
export function parseProject(input: unknown): Project {
  const p = input as Project;
  if (p?.version !== 1) throw new Error("Unsupported project version.");
  validateDefinition(p.definition);
  const ids = new Set(p.definition.keys.map((k) => k.id));
  if (
    !Array.isArray(p.layers) ||
    !p.layers.length ||
    p.layers.length > 32 ||
    p.layers.some(
      (l) =>
        !l ||
        [...ids].some((id) => l[id] === undefined) ||
        Object.entries(l).some(
          ([id, c]) => !ids.has(id) || !integer(c, 0, 65535),
        ),
    )
  )
    throw new Error("Invalid project keymap.");
  if (
    !Array.isArray(p.options) ||
    p.options.some((n) => !integer(n, 0, 255)) ||
    !Array.isArray(p.macros) ||
    p.macros.length > 256
  )
    throw new Error("Invalid project options or macros.");
  if (
    p.options.length !== p.definition.labels.length ||
    p.options.some(
      (n, i) =>
        n >=
        (typeof p.definition.labels[i] === "string"
          ? 2
          : p.definition.labels[i].length - 1),
    )
  )
    throw new Error("Invalid project layout selection.");
  for (const m of p.macros)
    if (
      typeof m.id !== "string" ||
      typeof m.name !== "string" ||
      !Array.isArray(m.events) ||
      m.events.length > 20000 ||
      m.events.some(
        (e, i) =>
          !["down", "up"].includes(e.type) ||
          typeof e.code !== "string" ||
          !integer(e.keycode, 1, 255) ||
          !Number.isFinite(e.at) ||
          e.at < 0 ||
          (i > 0 && e.at < m.events[i - 1].at),
      )
    )
      throw new Error("Invalid recorded macro.");
  if (
    !p.analog ||
    typeof p.analog !== "object" ||
    Object.values(p.analog).some((v) => !Number.isFinite(v))
  )
    throw new Error("Invalid analog settings.");
  if (
    p.firmware !== undefined &&
    !["QMK", "ZMK", "NIZ", "M-ONE"].includes(p.firmware)
  )
    throw new Error("Invalid firmware type.");
  if (p.bindings)
    for (const [id, b] of Object.entries(p.bindings)) {
      if (
        !integer(+id, 0x8000, 0xfffe) ||
        !integer(b.behaviorId, 0, 0xffffffff) ||
        !integer(b.param1, 0, 0xffffffff) ||
        !integer(b.param2, 0, 0xffffffff) ||
        typeof b.displayName !== "string"
      )
        throw new Error("Invalid ZMK behavior binding.");
    }
  if (
    p.firmware === "ZMK" &&
    p.layers.some((l) =>
      Object.values(l).some((c) => c >= 0x8000 && !p.bindings?.[c]),
    )
  )
    throw new Error("Project is missing a ZMK behavior definition.");
  return p;
}
