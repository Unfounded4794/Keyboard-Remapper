import type {
  Adapter,
  AnalogControl,
  Definition,
  DeviceInfo,
  Layers,
  PhysicalKey,
} from "../types";
import { parseDefinition } from "../core/definitions";
import { encodeMacro, replaceMacroSlot } from "../core/macros";
import type { Macro } from "../types";
import type { MacroFormat } from "../core/macros";
export class ViaAdapter implements Adapter {
  info: DeviceInfo = {
    name: "Keyboard",
    protocol: "VIA",
    version: 0,
    layerCount: 0,
    macroCount: 0,
    macroSize: 0,
    keycodesVersion: 0,
  };
  definition?: Definition;
  private tail: Promise<unknown> = Promise.resolve();
  private pending?: {
    resolve: (v: Uint8Array) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    raw: boolean;
    request: number[];
  };
  private closed = false;
  private reportId = 0;
  private inputId = 0;
  private vialVersion = 0;
  constructor(public device: HIDDevice) {
    const collection = device.collections.find(
      (c) => c.usagePage === 0xff60 && c.usage === 0x61,
    );
    const output = collection?.outputReports?.find(
      (r) =>
        r.items?.reduce(
          (n, i) => n + (i.reportSize ?? 0) * (i.reportCount ?? 0),
          0,
        ) === 256,
    );
    const input = collection?.inputReports?.find(
      (r) =>
        r.items?.reduce(
          (n, i) => n + (i.reportSize ?? 0) * (i.reportCount ?? 0),
          0,
        ) === 256,
    );
    if (!output || !input)
      throw new Error(
        "Keyboard does not expose the 32-byte VIA raw HID interface.",
      );
    this.reportId = output.reportId ?? 0;
    this.inputId = input.reportId ?? 0;
    device.addEventListener("inputreport", this.onReport);
  }
  private onReport = (e: HIDInputReportEvent) => {
    if (
      e.reportId !== this.inputId ||
      e.data.byteLength !== 32 ||
      !this.pending
    )
      return;
    if (!this.pending.raw && e.data.getUint8(0) === 0x16) return; // Unsolicited VIA UI-sync notification.
    if (!this.pending.raw && e.data.getUint8(0) !== 0xff) {
      const request = this.pending.request,
        command = request[0];
      if (e.data.getUint8(0) !== command) return;
      const echoed = [4, 5, 0x0e, 0x0f, 0x12, 0x13, 0x14, 0x15].includes(
        command,
      )
        ? 3
        : [7, 8].includes(command)
          ? 2
          : [2, 3, 9].includes(command)
            ? 1
            : 0;
      for (let i = 1; i <= echoed; i++)
        if (e.data.getUint8(i) !== request[i]) return;
    }
    const p = this.pending;
    this.pending = undefined;
    clearTimeout(p.timer);
    p.resolve(
      new Uint8Array(
        e.data.buffer,
        e.data.byteOffset,
        e.data.byteLength,
      ).slice(),
    );
  };
  command(bytes: number[], raw = false): Promise<Uint8Array> {
    const run = async () => {
      if (this.closed || !this.device.opened)
        throw new Error("Keyboard disconnected. Reconnect before continuing.");
      if (bytes.length > 32) throw new Error("HID command too large.");
      const data = new Uint8Array(32);
      data.set(bytes);
      const response = await new Promise<Uint8Array>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = undefined;
          this.closed = true;
          reject(
            new Error(
              "Keyboard did not respond. Close other configurators and reconnect.",
            ),
          );
        }, 1800);
        this.pending = { resolve, reject, timer, raw, request: bytes };
        this.device.sendReport(this.reportId, data).catch((error) => {
          if (this.pending) {
            clearTimeout(timer);
            this.pending = undefined;
            reject(error);
          }
        });
      });
      if (!raw && response[0] === 0xff)
        throw new Error(
          `Firmware does not support command 0x${bytes[0].toString(16)} (or the keyboard is locked).`,
        );
      if (!raw && response[0] !== bytes[0])
        throw new Error(
          "Unexpected keyboard response. Reconnect with other configurators closed.",
        );
      return response;
    };
    const next = this.tail.then(run, run);
    this.tail = next.catch(() => {});
    return next;
  }
  async initialize() {
    const protocol = await this.command([1]);
    const version = protocol[1] * 256 + protocol[2];
    if (version < 9 || version > 13)
      throw new Error(
        `VIA protocol ${version} is outside the tested range (9–13).`,
      );
    const vial = await this.command([0xfe, 0], true);
    const vialVersion = new DataView(vial.buffer).getUint32(0, true);
    const isVial = vialVersion >= 1 && vialVersion <= 6;
    this.vialVersion = isVial ? vialVersion : 0;
    const layers = await this.command([0x11]);
    const count = await this.command([0x0c]);
    const size = await this.command([0x0d]);
    if (!layers[1] || layers[1] > 32)
      throw new Error("Invalid layer count from firmware.");
    this.info = {
      name: this.device.productName || "VIA keyboard",
      protocol: isVial ? "Vial" : "VIA",
      version,
      layerCount: layers[1],
      macroCount: count[1],
      macroSize: size[1] * 256 + size[2],
      keycodesVersion: isVial ? (vialVersion === 6 ? 13 : 9) : version,
      keycodeTable: isVial
        ? vialVersion === 6
          ? "stable"
          : "legacy"
        : version >= 13
          ? "current"
          : version >= 11
            ? "stable"
            : "legacy",
    };
    if (isVial && window.keystone) {
      const sz = await this.command([0xfe, 1], true);
      const length = new DataView(sz.buffer).getUint32(0, true);
      if (length < 13 || length > 512 * 1024)
        throw new Error("Invalid Vial definition size.");
      const data = new Uint8Array(length);
      for (let page = 0; page * 32 < length; page++) {
        const part = await this.command([0xfe, 2, page & 255, page >> 8], true);
        data.set(part.slice(0, Math.min(32, length - page * 32)), page * 32);
      }
      this.definition = parseDefinition(
        JSON.parse(await window.keystone.decompress(Array.from(data))),
        "vial",
      );
      this.definition.vendorId = this.device.vendorId;
      this.definition.productId = this.device.productId;
      if (this.definition.name === "Imported keyboard")
        this.definition.name =
          this.device.productName ||
          `Vial ${this.device.vendorId.toString(16)}:${this.device.productId.toString(16)}`;
    }
  }
  matches(d: Definition) {
    return (
      d.vendorId === this.device.vendorId &&
      d.productId === this.device.productId
    );
  }
  async readLayers(def: Definition): Promise<Layers> {
    if (!this.matches(def))
      throw new Error(
        "Definition USB vendor/product IDs do not match this keyboard.",
      );
    const keys = [...new Map(def.keys.map((k) => [k.id, k])).values()];
    const layers: Layers = [];
    for (let l = 0; l < this.info.layerCount; l++) {
      const layer: Record<string, number> = {};
      for (const key of keys) {
        if (key.encoder && !key.encoder.virtual) {
          const { index, direction } = key.encoder;
          if (this.info.protocol === "Vial") {
            const r = await this.command([0xfe, 3, l, index], true);
            layer[key.id] = r[direction * 2] * 256 + r[direction * 2 + 1];
          } else {
            const r = await this.command([0x14, l, index, direction]);
            layer[key.id] = r[4] * 256 + r[5];
          }
          continue;
        }
        const r = await this.command([4, l, key.row, key.col]);
        layer[key.id] = r[4] * 256 + r[5];
      }
      layers.push(layer);
    }
    return layers;
  }
  async writeKey(layer: number, key: PhysicalKey, code: number) {
    if (
      layer < 0 ||
      layer >= this.info.layerCount ||
      !Number.isInteger(code) ||
      code < 0 ||
      code > 65535
    )
      throw new Error("Invalid key assignment.");
    if (key.encoder && !key.encoder.virtual) {
      const { index, direction } = key.encoder;
      if (this.info.protocol === "Vial") {
        await this.command(
          [0xfe, 4, layer, index, direction, code >> 8, code & 255],
          true,
        );
        const r = await this.command([0xfe, 3, layer, index], true);
        if (r[direction * 2] * 256 + r[direction * 2 + 1] !== code)
          throw new Error("Encoder assignment did not save.");
      } else {
        await this.command([
          0x15,
          layer,
          index,
          direction,
          code >> 8,
          code & 255,
        ]);
        const r = await this.command([0x14, layer, index, direction]);
        if (r[4] * 256 + r[5] !== code)
          throw new Error("Encoder assignment did not save.");
      }
      return;
    }
    await this.command([5, layer, key.row, key.col, code >> 8, code & 255]);
    const r = await this.command([4, layer, key.row, key.col]);
    if (r[4] * 256 + r[5] !== code)
      throw new Error(
        `Key ${key.id} did not save. Firmware may require unlocking.`,
      );
  }
  async readOptions() {
    const r = await this.command([2, 2]);
    return new DataView(r.buffer).getUint32(2, false);
  }
  async writeOptions(value: number) {
    await this.command([
      3,
      2,
      (value >>> 24) & 255,
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
    ]);
    if ((await this.readOptions()) !== value)
      throw new Error("Layout options did not save.");
  }
  async unlockStatus() {
    return this.command([0xfe, 5], true);
  }
  async unlock(onProgress: (remaining: number) => void) {
    await this.command([0xfe, 6], true);
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 125));
      const status = await this.command([0xfe, 7], true);
      onProgress(status[2]);
      if (status[0] === 1 && (await this.unlockStatus())[0] === 1) return;
    }
    throw new Error(
      "Unlock timed out. Hold the highlighted physical keys together and try again.",
    );
  }
  async matrix(def: Definition) {
    const bytesPerRow = Math.ceil(def.matrix.cols / 8),
      rowsPerPacket = Math.floor(28 / bytesPerRow),
      pressed = new Set<string>();
    if (!rowsPerPacket || def.matrix.cols > 32)
      throw new Error("Live matrix requires at most 32 columns.");
    if (this.info.version < 12) {
      if ((Math.floor(def.matrix.cols / 8) + 1) * def.matrix.rows > 28)
        throw new Error(
          "This firmware cannot expose the full switch matrix in one report.",
        );
      if (this.info.protocol === "Vial" && (await this.unlockStatus())[0] !== 1)
        throw new Error("Unlock Vial before enabling physical matrix preview.");
      const r = await this.command([2, 3]);
      for (let row = 0; row < def.matrix.rows; row++)
        for (let col = 0; col < def.matrix.cols; col++) {
          const index =
            2 + row * bytesPerRow + bytesPerRow - 1 - Math.floor(col / 8);
          if (r[index] & (1 << (col % 8))) pressed.add(`${row},${col}`);
        }
      return pressed;
    }
    for (let offset = 0; offset < def.matrix.rows; offset += rowsPerPacket) {
      const r = await this.command([2, 3, offset]);
      for (
        let row = offset;
        row < Math.min(offset + rowsPerPacket, def.matrix.rows);
        row++
      )
        for (let col = 0; col < def.matrix.cols; col++) {
          const index =
            3 +
            (row - offset) * bytesPerRow +
            (bytesPerRow - 1 - Math.floor(col / 8));
          if (r[index] & (1 << (col % 8))) pressed.add(`${row},${col}`);
        }
    }
    return pressed;
  }
  async readMacros() {
    const size = this.info.macroSize,
      buffer = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += 28) {
      const length = Math.min(28, size - offset);
      const r = await this.command([0x0e, offset >> 8, offset & 255, length]);
      buffer.set(r.slice(4, 4 + length), offset);
    }
    return buffer;
  }
  async uploadMacro(
    macro: Macro,
    slot: number,
    onBackup: (buffer: Uint8Array) => void,
  ) {
    return this.writeMacro(
      slot,
      encodeMacro(macro, this.macroFormat),
      onBackup,
    );
  }
  get macroFormat(): MacroFormat {
    return this.vialVersion >= 2
      ? "vial"
      : this.info.protocol === "VIA" && this.info.version >= 11
        ? "via"
        : "legacy";
  }
  async writeMacro(
    slot: number,
    encoded: number[],
    onBackup?: (buffer: Uint8Array) => void,
  ) {
    if (!this.info.macroSize || !this.info.macroCount)
      throw new Error("This keyboard does not support macros.");
    const original = await this.readMacros();
    onBackup?.(original);
    const next = replaceMacroSlot(
      original,
      this.info.macroCount,
      slot,
      encoded,
    );
    const last = next.length - 1;
    await this.command([0x0f, last >> 8, last & 255, 1, 255]);
    // Keep the final byte nonzero until every chunk has been sent.
    for (let offset = 0; offset < last; offset += 28) {
      const length = Math.min(28, last - offset);
      await this.command([
        0x0f,
        offset >> 8,
        offset & 255,
        length,
        ...next.slice(offset, offset + length),
      ]);
    }
    await this.command([0x0f, last >> 8, last & 255, 1, 0]);
    const readback = await this.readMacros();
    if (readback.some((b, i) => b !== next[i]))
      throw new Error(
        "Macro readback did not match. Keep the downloaded backup.",
      );
  }
  async readAnalog(control: AnalogControl) {
    const r = await this.command([8, control.channel, control.valueId]);
    return (control.bytes === 1 ? r[3] : r[3] * 256 + r[4]) / control.scale;
  }
  async writeAnalog(control: AnalogControl, value: number) {
    if (!Number.isFinite(value) || value < control.min || value > control.max)
      throw new Error(
        "Analog setting is outside this board’s supported range.",
      );
    const n = Math.round(value * control.scale);
    await this.command([
      7,
      control.channel,
      control.valueId,
      ...(control.bytes === 1 ? [n] : [n >> 8, n & 255]),
    ]);
    if (Math.abs((await this.readAnalog(control)) - value) > 1 / control.scale)
      throw new Error(`${control.label} did not save.`);
  }
  async close() {
    this.closed = true;
    this.device.removeEventListener("inputreport", this.onReport);
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error("Keyboard disconnected."));
      this.pending = undefined;
    }
    if (this.device.opened) await this.device.close();
  }
}
export async function connectVia(existing?: HIDDevice) {
  if (!navigator.hid)
    throw new Error(
      "Use the Keystone desktop app, or a browser with WebHID support.",
    );
  const devices = existing
    ? [existing]
    : await navigator.hid.requestDevice({
        filters: [{ usagePage: 0xff60, usage: 0x61 }],
      });
  if (!devices.length) throw new Error("No keyboard selected.");
  const device = devices[0];
  if (!device.opened) await device.open();
  let adapter: ViaAdapter | undefined;
  try {
    adapter = new ViaAdapter(device);
    await adapter.initialize();
    return adapter;
  } catch (error) {
    if (adapter) await adapter.close();
    else await device.close();
    throw error;
  }
}
