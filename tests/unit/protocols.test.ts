import { describe, it, expect, vi, afterEach } from "vitest";
import { ViaAdapter } from "../../src/protocols/via";
import { ZmkAdapter } from "../../src/protocols/zmk";
import {
  Request,
  Response,
  type RequestResponse,
} from "@zmkfirmware/zmk-studio-ts-client/studio";
import type { Definition, Macro } from "../../src/types";
const definition: Definition = {
  name: "Test board",
  vendorId: 0xcafe,
  productId: 0x10,
  matrix: { rows: 2, cols: 9 },
  keys: [
    { id: "0,0", row: 0, col: 0, x: 0, y: 0, w: 1, h: 1 },
    { id: "1,8", row: 1, col: 8, x: 1, y: 0, w: 1, h: 1 },
  ],
  labels: [],
};
class FakeHid extends EventTarget {
  opened = true;
  productName = "Test board";
  vendorId = 0xcafe;
  productId = 0x10;
  collections = [
    {
      usagePage: 0xff60,
      usage: 0x61,
      inputReports: [
        { reportId: 0, items: [{ reportSize: 8, reportCount: 32 }] },
      ],
      outputReports: [
        { reportId: 0, items: [{ reportSize: 8, reportCount: 32 }] },
      ],
    },
  ];
  version = 13;
  vialVersion = 0;
  locked = false;
  unlockPolls = 0;
  map = new Map<string, number>();
  options = 0;
  inflight = 0;
  peak = 0;
  ignoreWrites = false;
  noReply = false;
  unrelated = false;
  macros = Uint8Array.from([65, 0, 66, 0, ...Array(60).fill(0)]);
  commands: number[][] = [];
  async sendReport(_id: number, bytes: Uint8Array) {
    this.commands.push([...bytes]);
    this.inflight++;
    this.peak = Math.max(this.peak, this.inflight);
    const data = bytes.slice();
    switch (data[0]) {
      case 1:
        data[1] = 0;
        data[2] = this.version;
        break;
      case 0xfe:
        if (this.vialVersion && data[1] === 0) {
          data.fill(0);
          data[0] = this.vialVersion;
        } else if (data[1] === 3) {
          const ccw = this.map.get(`encoder:${data[2]}:${data[3]}:0`) ?? 0xa9;
          const cw = this.map.get(`encoder:${data[2]}:${data[3]}:1`) ?? 0xaa;
          data.set([ccw >> 8, ccw & 255, cw >> 8, cw & 255]);
        } else if (data[1] === 4) {
          if (!this.ignoreWrites)
            this.map.set(
              `encoder:${data[2]}:${data[3]}:${data[4]}`,
              data[5] * 256 + data[6],
            );
        } else if (data[1] === 6) {
          this.unlockPolls = 0;
        } else if (data[1] === 7) {
          if (++this.unlockPolls >= 2) this.locked = false;
          data.set([
            this.locked ? 0 : 1,
            this.locked ? 1 : 0,
            this.locked ? 25 : 0,
          ]);
        } else if (data[1] === 5) {
          data.fill(255);
          data[0] = this.locked ? 0 : 1;
        } else data[0] = 255;
        break;
      case 0x11:
        data[1] = 2;
        break;
      case 0x0c:
        data[1] = 2;
        break;
      case 0x0d:
        data[1] = 0;
        data[2] = 64;
        break;
      case 4: {
        const code = this.map.get(`${data[1]}:${data[2]},${data[3]}`) ?? 4;
        data[4] = code >> 8;
        data[5] = code & 255;
        break;
      }
      case 5:
        if (!this.ignoreWrites)
          this.map.set(
            `${data[1]}:${data[2]},${data[3]}`,
            data[4] * 256 + data[5],
          );
        break;
      case 0x14: {
        const c =
          this.map.get(`encoder:${data[1]}:${data[2]}:${data[3]}`) ?? 0xa9;
        data[4] = c >> 8;
        data[5] = c & 255;
        break;
      }
      case 0x15:
        if (!this.ignoreWrites)
          this.map.set(
            `encoder:${data[1]}:${data[2]}:${data[3]}`,
            data[4] * 256 + data[5],
          );
        break;
      case 2:
        if (data[1] === 2) new DataView(data.buffer).setUint32(2, this.options);
        else if (data[1] === 3) {
          const start = this.version >= 12 ? 3 : 2;
          data[start] = 0;
          data[start + 1] = 1;
          data[start + 2] = 1;
          data[start + 3] = 0;
        }
        break;
      case 3:
        this.options = new DataView(data.buffer).getUint32(2);
        break;
      case 0x0e: {
        const start = data[1] * 256 + data[2],
          length = data[3];
        data.set(this.macros.slice(start, start + length), 4);
        break;
      }
      case 0x0f: {
        const start = data[1] * 256 + data[2];
        this.macros.set(data.slice(4, 4 + data[3]), start);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1));
    this.inflight--;
    if (this.noReply) return;
    if (this.unrelated) {
      const stray = new Event("inputreport"),
        other = new Uint8Array(32);
      other.set([2, 3]);
      Object.assign(stray, { reportId: 0, data: new DataView(other.buffer) });
      this.dispatchEvent(stray);
    }
    const event = new Event("inputreport");
    Object.assign(event, { reportId: 0, data: new DataView(data.buffer) });
    this.dispatchEvent(event);
  }
  async close() {
    this.opened = false;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("VIA HID adapter", () => {
  it("reads and verifies VIA and Vial encoder directions independently of matrix switches", async () => {
    vi.stubGlobal("window", {});
    for (const vial of [false, true]) {
      const hid = new FakeHid();
      hid.vialVersion = vial ? 4 : 0;
      const a = new ViaAdapter(hid as unknown as HIDDevice);
      await a.initialize();
      const key = {
        id: "encoder:0:1",
        row: 0,
        col: 1,
        x: 2,
        y: 0,
        w: 1,
        h: 1,
        encoder: { index: 0, direction: 1 as const },
      };
      const d = { ...definition, keys: [...definition.keys, key] };
      expect((await a.readLayers(d))[0][key.id]).toBe(vial ? 0xaa : 0xa9);
      await a.writeKey(0, key, 0xab);
      expect((await a.readLayers(d))[0][key.id]).toBe(0xab);
      expect(hid.commands.filter((c) => c[0] === 5)).toHaveLength(0);
      hid.ignoreWrites = true;
      await expect(a.writeKey(0, key, 0xac)).rejects.toThrow(
        "Encoder assignment did not save",
      );
      await a.close();
    }
  });
  it("keeps matrix-emulated encoder writes on their original matrix coordinates", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid(),
      a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    const key = {
      ...definition.keys[1],
      id: "encoder:0:0",
      encoder: { index: 0, direction: 0 as const, virtual: true },
    };
    await a.writeKey(1, key, 42);
    expect(hid.commands.find((c) => c[0] === 5)?.slice(0, 6)).toEqual([
      5, 1, 1, 8, 0, 42,
    ]);
    await a.close();
  });
  it("verifies Vial unlock status after the hardware countdown completes", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid();
    hid.vialVersion = 4;
    hid.locked = true;
    const a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    expect((await a.unlockStatus())[0]).toBe(0);
    const progress = vi.fn();
    await a.unlock(progress);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([25, 0]);
    expect((await a.unlockStatus())[0]).toBe(1);
    await a.close();
  });
  it("ignores reports for other commands instead of treating them as the pending reply", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid();
    hid.unrelated = true;
    const a = new ViaAdapter(hid as unknown as HIDDevice);
    expect((await a.command([1]))[2]).toBe(13);
    await a.close();
  });
  it("serializes requests, reads layers, verifies writes and persists layout options", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid(),
      a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    const [layers] = await Promise.all([
      a.readLayers(definition),
      a.readOptions(),
    ]);
    expect(layers).toHaveLength(2);
    expect(hid.peak).toBe(1);
    await a.writeKey(1, definition.keys[1], 0x5221);
    expect(hid.map.get("1:1,8")).toBe(0x5221);
    await a.writeOptions(0x80000001);
    expect(await a.readOptions()).toBe(0x80000001);
    await a.close();
  });
  it("rejects a mismatched definition before reading keys and detects blocked writes", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid(),
      a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    await expect(a.readLayers({ ...definition, productId: 1 })).rejects.toThrow(
      /match/,
    );
    expect(hid.commands.filter((c) => c[0] === 4)).toHaveLength(0);
    hid.ignoreWrites = true;
    await expect(a.writeKey(0, definition.keys[0], 5)).rejects.toThrow(
      /did not save/,
    );
    await a.close();
  });
  it("decodes matrix bits across byte boundaries for legacy and paged firmware", async () => {
    vi.stubGlobal("window", {});
    for (const version of [9, 13]) {
      const hid = new FakeHid();
      hid.version = version;
      const a = new ViaAdapter(hid as unknown as HIDDevice);
      await a.initialize();
      expect([...(await a.matrix(definition))]).toEqual(["0,0", "1,8"]);
      await a.close();
    }
  });
  it("detects Vial 6 keycode ranges independently of its VIA 9 transport version", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid();
    hid.version = 9;
    hid.vialVersion = 6;
    const a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    expect(a.info.protocol).toBe("Vial");
    expect(a.info.version).toBe(9);
    expect(a.info.keycodesVersion).toBe(13);
    await a.close();
  });
  it("backs up macro memory and preserves the other slot during upload", async () => {
    vi.stubGlobal("window", {});
    const hid = new FakeHid(),
      a = new ViaAdapter(hid as unknown as HIDDevice);
    await a.initialize();
    const backup = vi.fn();
    const macro: Macro = {
      id: "m",
      name: "A",
      events: [
        { code: "KeyA", keycode: 4, type: "down", at: 0 },
        { code: "KeyA", keycode: 4, type: "up", at: 100 },
      ],
    };
    await a.uploadMacro(macro, 1, backup);
    expect([...backup.mock.calls[0][0]].slice(0, 4)).toEqual([65, 0, 66, 0]);
    expect([...hid.macros].slice(0, 2)).toEqual([65, 0]);
    expect([...hid.macros].slice(2, 15)).toEqual([
      1, 2, 4, 1, 4, 49, 48, 48, 124, 1, 3, 4, 0,
    ]);
    expect(hid.macros.at(-1)).toBe(0);
    await a.close();
  });
  it("faults the connection after a timeout to prevent late packets matching later writes", async () => {
    vi.stubGlobal("window", {});
    vi.useFakeTimers();
    const hid = new FakeHid();
    hid.noReply = true;
    const a = new ViaAdapter(hid as unknown as HIDDevice);
    const first = a.command([1]);
    const rejection = expect(first).rejects.toThrow(/did not respond/);
    await vi.advanceTimersByTimeAsync(2000);
    await rejection;
    await expect(a.command([5, 0, 0, 0, 0, 4])).rejects.toThrow(/Reconnect/);
    await a.close();
  });
});

class FakeSerial {
  controller!: ReadableStreamDefaultController<Uint8Array>;
  buffer: number[] = [];
  escaped = false;
  frame = false;
  locked = false;
  closed = false;
  persisted = false;
  bindings = [
    { behaviorId: 10, param1: 0x70004, param2: 0 },
    { behaviorId: 20, param1: 123, param2: 456 },
  ];
  readable = new ReadableStream<Uint8Array>({
    start: (c) => {
      this.controller = c;
    },
  });
  writable = new WritableStream<Uint8Array>({
    write: (chunk) => {
      for (const b of chunk) {
        if (this.escaped) {
          this.buffer.push(b);
          this.escaped = false;
        } else if (b === 0xab) {
          this.buffer = [];
          this.frame = true;
        } else if (b === 0xac) {
          this.escaped = true;
        } else if (b === 0xad) {
          this.handle(Request.decode(Uint8Array.from(this.buffer)));
          this.frame = false;
        } else if (this.frame) this.buffer.push(b);
      }
    },
  });
  async open() {}
  async close() {
    this.closed = true;
  }
  send(value: Parameters<typeof Response.encode>[0]) {
    const bytes = Response.encode(value).finish(),
      out = [0xab];
    for (const b of bytes) {
      if ([0xab, 0xac, 0xad].includes(b)) out.push(0xac);
      out.push(b);
    }
    out.push(0xad);
    this.controller.enqueue(Uint8Array.from(out));
  }
  handle(req: ReturnType<typeof Request.decode>) {
    this.send({
      notification: { core: { lockStateChanged: this.locked ? 0 : 1 } },
    });
    const r: RequestResponse = { requestId: req.requestId };
    if (req.core?.getDeviceInfo)
      r.core = {
        getDeviceInfo: {
          name: "Studio test",
          serialNumber: new Uint8Array([1, 2]),
        },
      };
    else if (req.core?.getLockState)
      r.core = { getLockState: this.locked ? 0 : 1 };
    else if (req.keymap?.getPhysicalLayouts)
      r.keymap = {
        getPhysicalLayouts: {
          activeLayoutIndex: 0,
          layouts: [
            {
              name: "ANSI",
              keys: [0, 1].map((x) => ({
                x: x * 100,
                y: 0,
                width: 100,
                height: 100,
                r: 0,
                rx: 0,
                ry: 0,
              })),
            },
          ],
        },
      };
    else if (req.behaviors?.listAllBehaviors)
      r.behaviors = { listAllBehaviors: { behaviors: [10, 20] } };
    else if (req.behaviors?.getBehaviorDetails) {
      const id = req.behaviors.getBehaviorDetails.behaviorId;
      r.behaviors = {
        getBehaviorDetails: {
          id,
          displayName: id === 10 ? "Key Press" : "Hold Tap",
          metadata:
            id === 10
              ? [
                  {
                    param1: [
                      {
                        name: "key",
                        hidUsage: { keyboardMax: 255, consumerMax: 1024 },
                      },
                    ],
                    param2: [],
                  },
                ]
              : [],
        },
      };
    } else if (req.keymap?.getKeymap)
      r.keymap = {
        getKeymap: {
          layers: [{ id: 7, name: "Base", bindings: this.bindings }],
          availableLayers: 4,
          maxLayerNameLength: 16,
        },
      };
    else if (req.keymap?.setLayerBinding) {
      const b = req.keymap.setLayerBinding;
      if (b.layerId === 7 && b.binding) {
        this.bindings[b.keyPosition] = b.binding;
        r.keymap = { setLayerBinding: 0 };
      } else r.keymap = { setLayerBinding: 1 };
    } else if (req.keymap?.saveChanges) {
      this.persisted = true;
      r.keymap = { saveChanges: { ok: true } };
    } else r.meta = { simpleError: 2 };
    this.send({ requestResponse: r });
  }
}
describe("ZMK Studio serial adapter", () => {
  it("uses framed protobuf RPC, drains notifications and preserves complex behaviors", async () => {
    const port = new FakeSerial(),
      a = new ZmkAdapter(port as unknown as SerialPort);
    await a.start();
    expect(a.info.name).toBe("Studio test");
    expect(a.definition?.keys[1].x).toBe(1);
    const layers = await a.readLayers(a.definition!);
    expect(layers[0]["0,0"]).toBe(4);
    const custom = layers[0]["0,1"];
    expect(a.decodeBinding(custom)).toMatchObject({
      behaviorId: 20,
      param1: 123,
      param2: 456,
    });
    await a.writeKey(0, a.definition!.keys[0], 5);
    await a.save();
    expect(port.persisted).toBe(true);
    expect(port.bindings[0]).toEqual({
      behaviorId: 10,
      param1: 0x70005,
      param2: 0,
    });
    await a.close();
    expect(port.closed).toBe(true);
  });
  it("encodes media as consumer usages rather than keyboard usages", async () => {
    const port = new FakeSerial(),
      a = new ZmkAdapter(port as unknown as SerialPort);
    await a.start();
    expect(a.decodeBinding(168)).toMatchObject({ param1: 0xc00e2 });
    await a.close();
  });
  it("refuses writes when Studio is locked", async () => {
    const port = new FakeSerial();
    port.locked = true;
    const a = new ZmkAdapter(port as unknown as SerialPort);
    await expect(a.start()).rejects.toThrow(/locked/);
    await a.close();
    expect(port.persisted).toBe(false);
  });
});
