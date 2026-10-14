import type { Definition } from "../types";
export function definitionId(d: Definition) {
  const text = JSON.stringify([
    d.name,
    d.matrix,
    d.labels,
    d.keys.map(({ themeCode, ...key }) => key),
  ]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
const normalized = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");
export function resolveDefinition(
  definitions: Definition[],
  productName: string,
  remembered?: string,
): Definition | undefined {
  if (remembered) {
    const saved = definitions.find((d) => definitionId(d) === remembered);
    if (saved) return saved;
  }
  if (definitions.length === 1) return definitions[0];
  const name = normalized(productName);
  if (
    !name ||
    [
      "keyboard",
      "usbkeyboard",
      "viakeyboard",
      "qmkkeyboard",
      "hidkeyboard",
    ].includes(name)
  )
    return;
  const exact = definitions.filter((d) => normalized(d.name) === name);
  if (exact.length === 1) return exact[0];
  const related = definitions.filter(
    (d) =>
      normalized(d.name).includes(name) || name.includes(normalized(d.name)),
  );
  if (related.length === 1) return related[0];
  // A VID/PID, generic product name, or first matching file is not a board identity.
}
