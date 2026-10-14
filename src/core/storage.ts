import { demoDefinition, defaultLayers, parseProject } from "./definitions";
import type { Project } from "../types";
export interface Profile {
  id: string;
  name: string;
  savedAt: string;
  project: Project;
}
export function freshProject(): Project {
  const definition = demoDefinition();
  return {
    version: 1,
    definition,
    layers: defaultLayers(definition),
    options: [0, 0],
    macros: [],
    analog: {},
    firmware: "QMK",
  };
}
export function loadProject(): Project {
  try {
    const raw = localStorage.getItem("keystone.workspace");
    return raw ? parseProject(JSON.parse(raw)) : freshProject();
  } catch {
    return freshProject();
  }
}
export function saveWorkspace(p: Project) {
  localStorage.setItem("keystone.workspace", JSON.stringify(p));
}
export function loadProfiles(): Profile[] {
  try {
    const profiles = JSON.parse(
      localStorage.getItem("keystone.profiles") ?? "[]",
    );
    return Array.isArray(profiles)
      ? profiles.map((p) => ({ ...p, project: parseProject(p.project) }))
      : [];
  } catch {
    return [];
  }
}
export function download(
  name: string,
  value: unknown,
  type = "application/json",
) {
  const content =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
