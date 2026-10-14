export const defaultShortcuts = {
  keymap: "Mod+Digit1",
  macros: "Mod+Digit2",
  tester: "Mod+Digit3",
  settings: "Mod+Comma",
};
export type ShortcutPage = keyof typeof defaultShortcuts;
export function shortcutFromEvent(
  e: Pick<
    KeyboardEvent,
    "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
): string | undefined {
  if (
    /^(Control|Meta|Alt|Shift)/.test(e.code) ||
    !e.code ||
    (!e.ctrlKey && !e.metaKey && !e.altKey)
  )
    return;
  return [
    ...(e.ctrlKey || e.metaKey ? ["Mod"] : []),
    ...(e.altKey ? ["Alt"] : []),
    ...(e.shiftKey ? ["Shift"] : []),
    e.code,
  ].join("+");
}
export function shortcutLabel(value: string, mac = false) {
  return value
    .replace("Mod", mac ? "⌘" : "Ctrl")
    .replace(/Digit|Key/g, "")
    .replace("Comma", ",")
    .replace("Period", ".");
}
