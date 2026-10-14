export interface MacroToken {
  raw: string;
  kind: "text" | "tap" | "down" | "up" | "delay" | "raw";
  keys?: string[];
  text?: string;
}
// Preserve every source byte so visual edits never rewrite an unrelated action.
export function macroTokens(source: string): MacroToken[] {
  const tokens: MacroToken[] = [];
  let text = "",
    raw = "";
  const flush = () => {
    if (raw) tokens.push({ raw, kind: "text", text });
    raw = "";
    text = "";
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "\\" && i + 1 < source.length) {
      raw += c + source[i + 1];
      text += source[++i];
      continue;
    }
    const end = c === "{" ? source.indexOf("}", i + 1) : -1;
    if (end < 0) {
      raw += c;
      text += c;
      continue;
    }
    flush();
    const action = source.slice(i + 1, end).trim(),
      sign = action[0];
    const kind = /^\d+$/.test(action)
      ? "delay"
      : action.startsWith("RAW:")
        ? "raw"
        : sign === "+"
          ? "down"
          : sign === "-"
            ? "up"
            : "tap";
    tokens.push({
      raw: source.slice(i, end + 1),
      kind,
      text: kind === "delay" || kind === "raw" ? action : undefined,
      keys: ["tap", "down", "up"].includes(kind)
        ? action
            .replace(/^[+-]/, "")
            .split(",")
            .map((k) => k.trim())
        : undefined,
    });
    i = end;
  }
  flush();
  return tokens;
}
export function macroText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{");
}
