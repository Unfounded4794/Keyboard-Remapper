import type { PhysicalKey } from "../types";
export function keyGeometry(k: PhysicalKey) {
  const secondary = ["x2", "y2", "w2", "h2"].some(
    (p) => k[p as keyof PhysicalKey] !== undefined,
  );
  const rects = [
    [0, 0, k.w, k.h],
    ...(secondary ? [[k.x2 ?? 0, k.y2 ?? 0, k.w2 ?? k.w, k.h2 ?? k.h]] : []),
  ];
  const xs = [...new Set(rects.flatMap(([x, , w]) => [x, x + w]))].sort(
      (a, b) => a - b,
    ),
    ys = [...new Set(rects.flatMap(([, y, , h]) => [y, y + h]))].sort(
      (a, b) => a - b,
    );
  const occupied = (i: number, j: number) =>
    i >= 0 &&
    j >= 0 &&
    i < xs.length - 1 &&
    j < ys.length - 1 &&
    rects.some(
      ([x, y, w, h]) =>
        (xs[i] + xs[i + 1]) / 2 >= x &&
        (xs[i] + xs[i + 1]) / 2 <= x + w &&
        (ys[j] + ys[j + 1]) / 2 >= y &&
        (ys[j] + ys[j + 1]) / 2 <= y + h,
    );
  const edges = new Map<string, number[]>(),
    point = (x: number, y: number) => `${x},${y}`;
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++)
      if (occupied(i, j)) {
        const x = xs[i],
          X = xs[i + 1],
          y = ys[j],
          Y = ys[j + 1];
        if (!occupied(i, j - 1)) edges.set(point(x, y), [X, y]);
        if (!occupied(i + 1, j)) edges.set(point(X, y), [X, Y]);
        if (!occupied(i, j + 1)) edges.set(point(X, Y), [x, Y]);
        if (!occupied(i - 1, j)) edges.set(point(x, Y), [x, y]);
      }
  const paths: string[] = [];
  while (edges.size) {
    const start = edges.keys().next().value!;
    let current = start,
      d = "M" + start.replace(",", " ");
    for (let n = 0; n < 100; n++) {
      const next = edges.get(current);
      if (!next) break;
      edges.delete(current);
      current = point(next[0], next[1]);
      if (current === start) {
        d += " Z";
        break;
      }
      d += ` L${next[0]} ${next[1]}`;
    }
    paths.push(d);
  }
  return {
    x: xs[0],
    y: ys[0],
    width: xs.at(-1)! - xs[0],
    height: ys.at(-1)! - ys[0],
    path: paths.join(" "),
    secondary,
  };
}
