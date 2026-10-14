import type {
  Adapter,
  Definition,
  DeviceInfo,
  Layers,
  PhysicalKey,
} from "../types";
import {
  nizDefinition,
  parseNizRecords,
  nizRecordCode,
  nizKeyRecord,
  nizMacroExpression,
  nizMacroRecord,
  NIZ_MACRO_BASE,
  type NizRecords,
} from "../core/niz";
export function isNizDevice(d: HIDDevice) {
  return (
    d.vendorId === 0x0483 &&
    d.productId === 0x5230 &&
    d.collections.some((c) => c.usagePage === 0x8c && c.usage === 1)
  );
}
export class NizAdapter implements Adapter {
  definition = nizDefinition();
  info: DeviceInfo = {
    name: "NIZ x108",
    protocol: "NIZ",
    version: 1,
    layerCount: 2,
    macroCount: 216,
    macroSize: 0,
    keycodesVersion: 13,
  };
  firmwareVersion = "";
  private queue: Uint8Array[] = [];
  private waiter?: {
    resolve: (b: Uint8Array) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  private records?: NizRecords;
  private staged = new Map<number, Uint8Array[]>();
  private failed = false;
  constructor(public device: HIDDevice) {
    if (!isNizDevice(device)) throw Error("Not a supported NIZ interface.");
    const c = device.collections.find(
      (c) => c.usagePage === 0x8c && c.usage === 1,
    )!;
    for (const reports of [c.inputReports, c.outputReports])
      if (
        !reports?.some(
          (r) =>
            r.reportId === 0 &&
            r.items?.reduce(
              (n, i) => n + (i.reportSize ?? 0) * (i.reportCount ?? 0),
              0,
            ) === 512,
        )
      )
        throw Error("NIZ requires its 64-byte Program interface.");
    device.addEventListener("inputreport", this.onReport);
  }
  private onReport = (e: HIDInputReportEvent) => {
    if (e.reportId !== 0 || e.data.byteLength !== 64 || this.failed) return;
    const bytes = new Uint8Array(e.data.buffer, e.data.byteOffset, 64).slice();
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = undefined;
      clearTimeout(w.timer);
      w.resolve(bytes);
    } else if (this.queue.length < 8193) this.queue.push(bytes);
    else this.failed = true;
  };
  private next(): Promise<Uint8Array> {
    if (this.failed || !this.device.opened)
      return Promise.reject(
        Error("NIZ disconnected. Reconnect before continuing."),
      );
    if (this.queue.length) return Promise.resolve(this.queue.shift()!);
    if (this.waiter) return Promise.reject(Error("Overlapping NIZ commands."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = undefined;
        this.failed = true;
        reject(
          Error(
            "NIZ did not respond. Close other configurators and reconnect.",
          ),
        );
      }, 3000);
      this.waiter = { resolve, reject, timer };
    });
  }
  private async send(bytes: Uint8Array) {
    if (this.failed || !this.device.opened)
      throw Error("NIZ disconnected. Reconnect before continuing.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.device.sendReport(0, bytes as Uint8Array<ArrayBuffer>),
        new Promise<void>((_, reject) => {
          timer = setTimeout(() => {
            this.failed = true;
            reject(
              Error("NIZ USB transfer stalled. Reconnect before continuing."),
            );
          }, 5000);
        }),
      ]);
    } catch (e) {
      this.failed = true;
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  private command(op: number) {
    const b = new Uint8Array(64);
    b[1] = op;
    return this.send(b);
  }
  async initialize() {
    await this.command(0xf9);
    const r = await this.next();
    if (r[0] !== 0 || r[1] !== 0xf9)
      throw Error("Unexpected NIZ version reply.");
    this.firmwareVersion = new TextDecoder()
      .decode(r.slice(2))
      .replace(/\0.*$/s, "");
    if (!/^X108EC\(S\);V1\.0\.22;/i.test(this.firmwareVersion))
      throw Error(
        `NIZ firmware ${this.firmwareVersion} needs a verified protocol profile.`,
      );
  }
  private async readRecords() {
    if (this.queue.length)
      throw Error(
        "Unexpected NIZ data. Close other configurators and reconnect.",
      );
    await this.command(0xf2);
    const reports: Uint8Array[] = [],
      deadline = Date.now() + 30000;
    while (reports.length < 8192 && Date.now() < deadline) {
      const r = await this.next();
      if (r[0] === 0xf6) return parseNizRecords(reports);
      if (r[0] !== 0 || r[1] !== 0xf0)
        throw Error("Unexpected NIZ keymap response.");
      reports.push(r);
    }
    throw Error("Incomplete NIZ configuration.");
  }
  async readLayers(_def: Definition): Promise<Layers> {
    this.records = await this.readRecords();
    this.staged.clear();
    return Array.from({ length: 2 }, (_, l) =>
      Object.fromEntries(
        this.definition.keys.map((k) => [
          k.id,
          nizRecordCode(this.records![l * 108 + k.col], l * 108 + k.col),
        ]),
      ),
    );
  }
  async writeKey(layer: number, key: PhysicalKey, code: number) {
    if (
      !Number.isInteger(layer) ||
      layer < 0 ||
      layer > 1 ||
      !this.definition.keys.some((k) => k.id === key.id && k.col === key.col)
    )
      throw Error("Invalid NIZ key position.");
    const index = layer * 108 + key.col;
    if (!this.records)
      throw Error("Read the NIZ configuration before editing.");
    if (code >= NIZ_MACRO_BASE && code < NIZ_MACRO_BASE + 216) {
      if (code !== NIZ_MACRO_BASE + index)
        throw Error(
          "NIZ macros belong to a physical key and layer. Edit the target key in Macros.",
        );
      this.staged.set(
        index,
        this.records[index].map((r) => r.slice()),
      );
    } else this.staged.set(index, nizKeyRecord(index, code));
  }
  private same(a: NizRecords, b: NizRecords) {
    return (
      a.length === b.length &&
      a.every(
        (g, i) =>
          g.length === b[i].length &&
          g.every((r, j) => r.every((v, k) => v === b[i][j][k])),
      )
    );
  }
  async commit(backup: (reports: number[][]) => void = () => {}) {
    if (!this.records)
      throw Error("Read the NIZ configuration before editing.");
    if (!this.staged.size) return;
    try {
      const live = await this.readRecords();
      if (!this.same(live, this.records))
        throw Error(
          "NIZ configuration changed outside Keystone. Reconnect before applying.",
        );
      const desired = this.records.map((g, i) => this.staged.get(i) ?? g);
      parseNizRecords(desired.flat()); // Complete validation before starting a destructive stream.
      backup(this.records.flat().map((r) => [...r]));
      await this.command(0xf1);
      for (const r of desired.flat()) {
        await this.send(r);
        await new Promise((resolve) => setTimeout(resolve, 3));
      }
      const end = new Uint8Array(64).fill(0xf6);
      end[0] = 0;
      await this.send(end);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const actual = await this.readRecords();
      if (!this.same(actual, desired))
        throw Error(
          "NIZ configuration verification failed. A recovery copy was saved.",
        );
      this.records = actual;
    } finally {
      this.staged.clear();
    }
  }
  async macroPrograms() {
    if (!this.records) await this.readLayers(this.definition);
    return this.records!.map((g) => nizMacroExpression(g));
  }
  async writeMacro(
    index: number,
    text: string,
    backup: (reports: number[][]) => void,
  ) {
    if (!Number.isInteger(index) || index < 0 || index >= 216)
      throw Error("Invalid NIZ macro key.");
    this.staged.clear();
    this.staged.set(index, nizMacroRecord(index, text));
    await this.commit(backup);
  }
  discard() {
    this.staged.clear();
  }
  macroLabel(index: number) {
    const k = this.definition.keys.find((k) => k.col === index % 108)!;
    return `${index < 108 ? "Base" : "Fn"} · ${byPhysical(k.defaultCode!)}`;
  }
  async close() {
    this.failed = true;
    this.device.removeEventListener("inputreport", this.onReport);
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(Error("NIZ disconnected."));
      this.waiter = undefined;
    }
    if (this.device.opened) await this.device.close();
  }
}
import { labelFor } from "../core/keycodes";
import { nizLabel } from "../core/niz";
function byPhysical(code: number) {
  return nizLabel(code) ?? labelFor(code);
}
export async function connectNiz(device: HIDDevice) {
  if (!device.opened) await device.open();
  const a = new NizAdapter(device);
  try {
    await a.initialize();
    return a;
  } catch (e) {
    await a.close();
    throw e;
  }
}
