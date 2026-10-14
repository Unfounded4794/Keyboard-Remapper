export interface PhysicalKey {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  rx?: number;
  ry?: number;
  option?: [number, number];
  defaultCode?: number;
  themeCode?: number;
  x2?: number;
  y2?: number;
  w2?: number;
  h2?: number;
  color?: "alpha" | "mod" | "accent";
  encoder?: { index: number; direction: 0 | 1; virtual?: boolean };
  knob?: number;
}
export interface AnalogControl {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  default: number;
  channel: number;
  valueId: number;
  scale: number;
  bytes: 1 | 2;
}
export interface Definition {
  name: string;
  vendorId?: number;
  productId?: number;
  matrix: { rows: number; cols: number };
  keys: PhysicalKey[];
  labels: (string | string[])[];
  sensor?: "HE" | "TMR";
  analog?: { protocol: "via-custom"; controls: AnalogControl[]; save: boolean };
}
export type Layers = Record<string, number>[];
export interface MacroEvent {
  type: "down" | "up";
  code: string;
  keycode: number;
  at: number;
}
export interface Macro {
  id: string;
  name: string;
  events: MacroEvent[];
}
export interface Project {
  version: 1;
  definition: Definition;
  layers: Layers;
  options: number[];
  macros: Macro[];
  analog: Record<string, number>;
  firmware?: "QMK" | "ZMK" | "NIZ" | "M-ONE";
  bindings?: Record<
    string,
    { behaviorId: number; param1: number; param2: number; displayName: string }
  >;
}
export interface DeviceInfo {
  name: string;
  protocol: "VIA" | "Vial" | "ZMK" | "NIZ" | "M-ONE";
  version: number;
  layerCount: number;
  macroCount: number;
  macroSize: number;
  keycodesVersion: number;
  keycodeTable?: "current" | "stable" | "legacy";
}
export interface Adapter {
  info: DeviceInfo;
  definition?: Definition;
  readLayers(def: Definition): Promise<Layers>;
  writeKey(layer: number, key: PhysicalKey, code: number): Promise<void>;
  close(): Promise<void>;
}
declare global {
  interface Window {
    keystone?: {
      desktop: boolean;
      beginIdentityScan?(): Promise<void>;
      keyboardIdentity?(
        vendorId: number,
        productId: number,
        name: string,
      ): Promise<string | null>;
      decompress(bytes: number[]): Promise<string>;
      onMediaKey?(callback: (code: string) => void): () => void;
      definitions?(
        vendorId: number,
        productId: number,
        version: number,
      ): Promise<unknown[]>;
    };
  }
}
