import type {
  Adapter,
  Definition,
  DeviceInfo,
  Layers,
  PhysicalKey,
} from "../types";
import factoryReference from "../core/mone-factory.json";
import {
  moneAction,
  moneCode,
  moneDefinition,
  moneMacroExpression,
  moneMacroRecord,
  parseMoneMacros,
  replaceMoneMacro,
  MONE_FN,
  MONE_OPAQUE,
} from "../core/mone";

export function isMoneDevice(d: HIDDevice) {
  return (
    d.vendorId === 0x05ac &&
    d.productId === 0x024f &&
    d.productName === "M-ONE" &&
    d.collections.some(
      (c) =>
        c.usagePage === 0xff1c &&
        c.usage === 0x92 &&
        [c.inputReports, c.outputReports].every((rs) =>
          rs?.some(
            (r) =>
              r.reportId === 4 &&
              r.items?.reduce(
                (n, i) => n + (i.reportCount ?? 0) * (i.reportSize ?? 0),
                0,
              ) === 504,
          ),
        ),
    )
  );
}
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
export class MoneAdapter implements Adapter {
  definition = moneDefinition(new Uint8Array(factoryReference));
  info: DeviceInfo = {
    name: "Besides Studio M-ONE",
    protocol: "M-ONE",
    version: 2,
    layerCount: 1,
    macroCount: 16,
    macroSize: 3072,
    keycodesVersion: 13,
  };
  private waiter?: {
    packet: Uint8Array;
    resolve: (b: Uint8Array) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  private failed = false;
  private mapping?: Uint8Array;
  private staged = new Map<number, Uint8Array>();
  private factory = new Uint8Array(factoryReference);
  constructor(public device: HIDDevice) {
    if (!isMoneDevice(device))
      throw Error("Not a supported M-ONE vendor interface.");
    device.addEventListener("inputreport", this.onReport);
  }
  private onReport = (e: HIDInputReportEvent) => {
    if (e.reportId !== 4 || !this.waiter) return;
    const w = this.waiter;
    this.waiter = undefined;
    clearTimeout(w.timer);
    const b = new Uint8Array(
        e.data.buffer,
        e.data.byteOffset,
        e.data.byteLength,
      ).slice(),
      p = w.packet;
    const writing = [1, 2, 9, 0x15].includes(p[2]);
    if (
      b.length !== 63 ||
      [0, 1, 2, 4, 5].some((i) => b[i] !== p[i]) ||
      (writing ? b[3] > p[3] : b[3] !== p[3]) ||
      b[6] !== 0
    ) {
      this.failed = true;
      w.reject(
        Error("Unexpected M-ONE response. Reconnect before continuing."),
      );
      return;
    }
    w.resolve(b.slice(7, 7 + b[3]));
  };
  private async query(
    cmd: number,
    offset = 0,
    size = 0,
    data?: Uint8Array,
  ): Promise<Uint8Array> {
    if (this.failed || !this.device.opened || this.waiter)
      throw Error(
        "M-ONE is busy or disconnected. Reconnect before continuing.",
      );
    const p = new Uint8Array(63);
    p[2] = cmd;
    p[3] = size;
    p[4] = offset & 255;
    p[5] = offset >> 8;
    if (data) p.set(data, 7);
    const sum = p.slice(2).reduce((n, v) => n + v, 0);
    p[0] = sum & 255;
    p[1] = sum >> 8;
    const response = new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = undefined;
        this.failed = true;
        reject(
          Error(
            "M-ONE did not respond. Close other configurators and reconnect.",
          ),
        );
      }, 3000);
      this.waiter = { packet: p, resolve, reject, timer };
    });
    // Attach rejection before sendReport; a stalled transfer is covered by the same deadline.
    const sent = this.device
      .sendReport(4, p as Uint8Array<ArrayBuffer>)
      .catch((e) => {
        this.failed = true;
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = undefined;
          clearTimeout(w.timer);
          w.reject(e);
        }
        throw e;
      });
    const [r] = await Promise.all([response, sent]);
    return r;
  }
  private async read(cmd: number, size: number) {
    const result = new Uint8Array(size);
    for (let off = 0; off < size; off += 56)
      result.set(await this.query(cmd, off, Math.min(56, size - off)), off);
    return result;
  }
  private async write(cmd: number, offset: number, data: Uint8Array) {
    for (let off = 0; off < data.length; off += 56) {
      const part = data.slice(off, off + 56);
      await this.query(cmd, offset + off, part.length, part);
    }
  }
  async initialize() {
    const caps = await this.read(3, 64);
    if (!same(caps.slice(0, 7), new Uint8Array([170, 85, 0, 0, 13, 170, 24])))
      throw Error("This M-ONE firmware needs a verified protocol profile.");
    const factory = await this.read(7, 510);
    if (!same(factory, this.factory))
      throw Error(
        "Unrecognized M-ONE factory keymap. Configuration writes are disabled.",
      );
    const macros = parseMoneMacros(await this.read(0x14, 3072));
    this.info.macroCount = Math.max(16, macros.records.length);
  }
  async readLayers(_def: Definition): Promise<Layers> {
    this.mapping = await this.read(8, 510);
    this.staged.clear();
    return [
      Object.fromEntries(
        this.definition.keys.map((k) => [
          k.id,
          moneCode(this.mapping!.slice(k.col * 3, k.col * 3 + 3), k.col),
        ]),
      ),
    ];
  }
  async writeKey(layer: number, key: PhysicalKey, code: number) {
    if (
      layer !== 0 ||
      !this.definition.keys.some((k) => k.id === key.id && k.col === key.col) ||
      !this.mapping
    )
      throw Error("Invalid M-ONE physical key.");
    if (code === MONE_OPAQUE + key.col) {
      this.staged.set(
        key.col,
        this.mapping.slice(key.col * 3, key.col * 3 + 3),
      );
      return;
    }
    this.staged.set(key.col, moneAction(code, this.info.macroCount));
  }
  async commit(backup: (data: unknown) => void = () => {}) {
    if (!this.mapping || !this.staged.size) return;
    const live = await this.read(8, 510),
      config = await this.read(5, 192);
    if (!same(live, this.mapping))
      throw Error(
        "M-ONE configuration changed outside Keystone. Reconnect before applying.",
      );
    const desired = live.slice();
    this.staged.forEach((v, i) => desired.set(v, i * 3));
    backup({ mapping: [...live], config: [...config] });
    try {
      await this.query(1);
      for (const [slot, action] of this.staged)
        await this.write(9, slot * 3, action);
      await this.query(2);
      await new Promise((r) => setTimeout(r, 250));
      if (!same(await this.read(8, 510), desired))
        throw Error(
          "M-ONE keymap verification failed. A recovery copy was saved.",
        );
      if (!same(await this.read(5, 192), config))
        throw Error(
          "M-ONE configuration changed during saving. Reconnect to refresh.",
        );
      this.mapping = desired;
    } catch (e) {
      this.failed = true;
      throw e;
    } finally {
      this.staged.clear();
    }
  }
  discard() {
    this.staged.clear();
  }
  async macroPrograms() {
    const block = parseMoneMacros(await this.read(0x14, 3072));
    return Array.from({ length: this.info.macroCount }, (_, i) =>
      moneMacroExpression(block.records[i]),
    );
  }
  async writeMacro(
    index: number,
    text: string,
    backup: (data: unknown) => void,
  ) {
    if (index < 0 || index >= this.info.macroCount)
      throw Error("Invalid M-ONE macro number.");
    const record = moneMacroRecord(text),
      before = await this.read(0x14, 3072),
      block = parseMoneMacros(before);
    const desired = replaceMoneMacro(block, index, record),
      config = await this.read(5, 192),
      mapping = await this.read(8, 510);
    backup({ macros: [...before], config: [...config], mapping: [...mapping] });
    try {
      await this.query(1);
      await this.write(
        0x15,
        0,
        desired.slice(0, desired[2] | (desired[3] << 8)),
      );
      await this.query(2);
      await new Promise((r) => setTimeout(r, 250));
      if (
        !same(await this.read(0x14, 3072), desired) ||
        !same(await this.read(8, 510), mapping) ||
        !same(await this.read(5, 192), config)
      )
        throw Error(
          "M-ONE macro verification failed. A recovery copy was saved.",
        );
    } catch (e) {
      this.failed = true;
      throw e;
    }
  }
  label(code: number): string | undefined {
    if (code === MONE_FN) return "Fn";
    if (code >= MONE_OPAQUE && code < MONE_OPAQUE + 170) {
      const a = this.mapping?.slice(
        (code - MONE_OPAQUE) * 3,
        (code - MONE_OPAQUE) * 3 + 3,
      );
      if (a?.[0] === 0x20 && a[1] && a[2]) return "Chord";
      return "Native action";
    }
  }
  async close() {
    this.failed = true;
    this.device.removeEventListener("inputreport", this.onReport);
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(Error("M-ONE disconnected."));
      this.waiter = undefined;
    }
    if (this.device.opened) await this.device.close();
  }
}
export async function connectMone(device: HIDDevice) {
  if (!isMoneDevice(device)) throw Error("Not a supported M-ONE interface.");
  if (!device.opened) await device.open();
  const a = new MoneAdapter(device);
  try {
    await a.initialize();
    return a;
  } catch (e) {
    await a.close();
    throw e;
  }
}
