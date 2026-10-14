import { referenceProfiles } from "./theme-profiles";
export { referenceKeyColors as keyColors } from "./theme-profiles";
export function effectiveTheme(id: string, mode: "light" | "dark") {
  const theme = themes.find((t) => t.id === id) ?? themes[0];
  return id === "classic" && mode === "light"
    ? {
        ...theme,
        key: "#f3f1eb",
        text: "#25262b",
        mod: "#d8d9d5",
        modText: "#25262b",
        accentKey: "#d8d9d5",
        accentKeyText: "#25262b",
      }
    : theme;
}
export const themes = [
  {
    id: "classic",
    name: "Classic",
    key: "#303238",
    text: "#f1f1ed",
    mod: "#45474d",
    modText: "#fff",
    accent: "#a9c7ff",
    accentText: "#18243c",
  },
  {
    id: "greg",
    name: "GMK Greg",
    key: "#f2cf31",
    text: "#443817",
    mod: "#f0eee5",
    modText: "#383733",
    accent: "#f2cf31",
    accentText: "#30290b",
  },
  {
    id: "olivia",
    name: "GMK Olivia",
    key: "#eee7df",
    text: "#313036",
    mod: "#3c393e",
    modText: "#edc5bb",
    accent: "#e9b6ac",
    accentText: "#352323",
  },
  {
    id: "botanical",
    name: "GMK Botanical",
    key: "#e7e9dc",
    text: "#3d5149",
    mod: "#688a79",
    modText: "#f0f1e7",
    accent: "#94b9a0",
    accentText: "#203b2d",
  },
  {
    id: "dracula",
    name: "GMK Dracula",
    key: "#363641",
    text: "#e6e0ed",
    mod: "#25252d",
    modText: "#c7bed1",
    accent: "#bd93f9",
    accentText: "#2d1c46",
  },
  {
    id: "carbon",
    name: "GMK Carbon",
    key: "#dfd7c3",
    text: "#3b3a36",
    mod: "#494744",
    modText: "#dfd7c3",
    accent: "#e89443",
    accentText: "#352313",
  },
  {
    id: "9009",
    name: "GMK 9009",
    key: "#e8e3d4",
    text: "#44453e",
    mod: "#bdbbaa",
    modText: "#333a32",
    accent: "#a6b29b",
    accentText: "#233124",
  },
  {
    id: "modern-dolch",
    name: "GMK Modern Dolch",
    key: "#60656b",
    text: "#f0f2ed",
    mod: "#393f45",
    modText: "#e5e8e2",
    accent: "#88bcb7",
    accentText: "#203b39",
  },
  {
    id: "terror-below",
    name: "GMK Terror Below",
    key: "#254c45",
    text: "#99d4b6",
    mod: "#1e3b36",
    modText: "#99d4b6",
    accent: "#86c9a5",
    accentText: "#12332c",
  },
  ...referenceProfiles.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.alpha.cap,
    text: p.alpha.text,
    mod: p.modifier.cap,
    modText: p.modifier.text,
    accent: p.uiAccent,
    accentText: /^#(?:[789abcdef])/i.test(p.uiAccent) ? "#20252b" : "#fafafa",
    accentKey: p.accent.cap,
    accentKeyText: p.accent.text,
  })),
].map((t) => ({
  ...t,
  accentKey:
    "accentKey" in t
      ? t.accentKey
      : t.id === "greg"
        ? "#171717"
        : t.id === "classic"
          ? t.mod
          : t.accent,
  accentKeyText:
    "accentKeyText" in t
      ? t.accentKeyText
      : t.id === "greg"
        ? "#f0eee5"
        : t.id === "classic"
          ? t.modText
          : t.accentText,
}));
