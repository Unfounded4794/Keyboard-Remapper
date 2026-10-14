import {
  Request,
  Response,
  type RequestResponse,
} from "@zmkfirmware/zmk-studio-ts-client/studio";
import {
  get_encoder,
  get_decoder,
} from "@zmkfirmware/zmk-studio-ts-client/framing";
import type {
  BehaviorBinding,
  Keymap,
  PhysicalLayouts,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type {
  Adapter,
  Definition,
  DeviceInfo,
  Layers,
  PhysicalKey,
} from "../types";
import { labelFor } from "../core/keycodes";
const consumerUsages: Record<number, number> = {
  168: 0xe2,
  169: 0xe9,
  170: 0xea,
  171: 0xb5,
  172: 0xb6,
  174: 0xcd,
};
export interface SavedBinding extends BehaviorBinding {
  displayName: string;
}
export class ZmkAdapter implements Adapter {
  info: DeviceInfo = {
    name: "ZMK keyboard",
    protocol: "ZMK",
    version: 1,
    layerCount: 0,
    macroCount: 0,
    macroSize: 0,
    keycodesVersion: 0,
  };
  definition?: Definition;
  keymap?: Keymap;
  layouts?: PhysicalLayouts;
  behaviors: GetBehaviorDetailsResponse[] = [];
  bindings: Record<string, SavedBinding> = {};
  onDisconnect?: () => void;
  private kp?: number;
  private nextCode = 0x8000;
  private id = 0;
  private controller = new AbortController();
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writePipeline?: Promise<void>;
  private readLoop?: Promise<void>;
  private pending = new Map<
    number,
    {
      resolve: (r: RequestResponse) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(private port: SerialPort) {}
  async start() {
    await this.port.open({ baudRate: 12500 });
    const encoder = new TransformStream(get_encoder());
    this.writer = encoder.writable.getWriter();
    this.writePipeline = encoder.readable
      .pipeTo(this.port.writable!, { signal: this.controller.signal })
      .catch(() => {});
    this.reader = this.port
      .readable!.pipeThrough(new TransformStream(get_decoder()), {
        signal: this.controller.signal,
      })
      .getReader();
    this.readLoop = this.listen();
    const info = await this.rpc({ core: { getDeviceInfo: true } });
    this.info.name = info.core?.getDeviceInfo?.name || "ZMK keyboard";
    const lock = await this.rpc({ core: { getLockState: true } });
    if (lock.core?.getLockState !== 1)
      throw new Error(
        "ZMK Studio is locked. Press your keyboard’s Studio unlock binding, then reconnect.",
      );
    const layouts = await this.rpc({ keymap: { getPhysicalLayouts: true } });
    this.layouts = layouts.keymap?.getPhysicalLayouts;
    const active = this.layouts?.layouts[this.layouts.activeLayoutIndex];
    if (!active?.keys.length)
      throw new Error("Firmware must include a ZMK Studio physical layout.");
    this.definition = {
      name: this.info.name,
      matrix: { rows: Math.ceil(active.keys.length / 16), cols: 16 },
      labels: [],
      keys: active.keys.map((k, i) => ({
        id: `${Math.floor(i / 16)},${i % 16}`,
        row: Math.floor(i / 16),
        col: i % 16,
        x: k.x / 100,
        y: k.y / 100,
        w: k.width / 100,
        h: k.height / 100,
        rotation: k.r / 100,
        rx: k.rx / 100,
        ry: k.ry / 100,
      })),
    };
    const behaviors = await this.rpc({ behaviors: { listAllBehaviors: true } });
    for (const id of behaviors.behaviors?.listAllBehaviors?.behaviors ?? []) {
      const r = await this.rpc({
        behaviors: { getBehaviorDetails: { behaviorId: id } },
      });
      if (r.behaviors?.getBehaviorDetails)
        this.behaviors.push(r.behaviors.getBehaviorDetails);
    }
    this.kp = this.behaviors.find((b) =>
      b.metadata.some(
        (m) => m.param1.some((p) => p.hidUsage) && m.param2.every((p) => p.nil),
      ),
    )?.id;
    await this.readLayers(this.definition);
  }
  private async listen() {
    try {
      while (!this.controller.signal.aborted) {
        const { done, value } = await this.reader!.read();
        if (done) break;
        const response = Response.decode(value).requestResponse;
        if (!response) continue;
        const p = this.pending.get(response.requestId);
        if (!p) continue;
        this.pending.delete(response.requestId);
        clearTimeout(p.timer);
        if (
          response.meta?.noResponse ||
          response.meta?.simpleError !== undefined
        )
          p.reject(
            new Error(
              response.meta?.simpleError === 1
                ? "ZMK is locked. Press your Studio unlock key."
                : `ZMK RPC error: ${response.meta?.simpleError ?? "no response"}`,
            ),
          );
        else p.resolve(response);
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.fail(new Error("ZMK connection closed."));
      this.reader?.releaseLock();
      if (!this.controller.signal.aborted) {
        this.onDisconnect?.();
        this.controller.abort();
      }
    }
  }
  private fail(error: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
  async rpc(request: Omit<Request, "requestId">) {
    if (this.controller.signal.aborted) throw new Error("ZMK disconnected.");
    const requestId = this.id++;
    const promise = new Promise<RequestResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(
          new Error(
            "ZMK did not respond. Check Studio firmware and reconnect.",
          ),
        );
      }, 3500);
      this.pending.set(requestId, { resolve, reject, timer });
    });
    this.writer!.write(
      Request.encode({ ...request, requestId }).finish(),
    ).catch((e) => {
      const p = this.pending.get(requestId);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(requestId);
        p.reject(e);
      }
    });
    return promise;
  }
  encodeBinding(binding: BehaviorBinding) {
    if (
      binding.behaviorId === this.kp &&
      binding.param2 === 0 &&
      binding.param1 >>> 16 === 12
    ) {
      const entry = Object.entries(consumerUsages).find(
        ([, usage]) => usage === (binding.param1 & 65535),
      );
      if (entry) return +entry[0];
    }
    if (
      binding.behaviorId === this.kp &&
      binding.param2 === 0 &&
      binding.param1 >>> 16 === 7 &&
      (binding.param1 & 65535) >= 4 &&
      (binding.param1 & 65535) <= 255
    )
      return binding.param1 & 65535;
    const existing = Object.entries(this.bindings).find(
      ([, b]) =>
        b.behaviorId === binding.behaviorId &&
        b.param1 === binding.param1 &&
        b.param2 === binding.param2,
    );
    if (existing) return +existing[0];
    const code = this.nextCode++;
    if (code > 65534) throw new Error("Too many distinct behavior bindings.");
    this.bindings[code] = {
      ...binding,
      displayName:
        this.behaviors.find((b) => b.id === binding.behaviorId)?.displayName ??
        `Behavior ${binding.behaviorId}`,
    };
    return code;
  }
  decodeBinding(code: number): BehaviorBinding {
    if (code >= 4 && code <= 255 && this.kp !== undefined)
      return {
        behaviorId: this.kp,
        param1:
          consumerUsages[code] !== undefined
            ? 0xc0000 | consumerUsages[code]
            : 0x70000 | code,
        param2: 0,
      };
    if (this.bindings[code]) return this.bindings[code];
    const behavior = this.behaviors.find(
      (b) =>
        b.displayName.toLowerCase() === (code === 1 ? "transparent" : "none"),
    );
    if ((code === 0 || code === 1) && behavior)
      return { behaviorId: behavior.id, param1: 0, param2: 0 };
    throw new Error(
      "Choose a ZMK behavior for this assignment; QMK keycodes cannot be sent to ZMK.",
    );
  }
  restoreBindings(bindings: Record<string, SavedBinding>) {
    for (const b of Object.values(bindings))
      if (!this.behaviors.some((behavior) => behavior.id === b.behaviorId))
        throw new Error(
          "This project contains behavior IDs unavailable on this ZMK keyboard.",
        );
    this.bindings = { ...bindings };
    this.nextCode = Math.max(0x7fff, ...Object.keys(bindings).map(Number)) + 1;
  }
  label(code: number) {
    const b = this.bindings[code];
    return b ? b.displayName.replace(/^Key /, "") : labelFor(code);
  }
  async readLayers(_def: Definition): Promise<Layers> {
    const r = await this.rpc({ keymap: { getKeymap: true } });
    this.keymap = r.keymap?.getKeymap;
    if (!this.keymap?.layers.length) throw new Error("ZMK returned no keymap.");
    this.info.layerCount = this.keymap.layers.length;
    return this.keymap.layers.map((l) =>
      Object.fromEntries(
        l.bindings.map((b, i) => [
          `${Math.floor(i / 16)},${i % 16}`,
          this.encodeBinding(b),
        ]),
      ),
    );
  }
  async writeKey(layer: number, key: PhysicalKey, code: number) {
    const l = this.keymap?.layers[layer];
    if (!l) throw new Error("Invalid ZMK layer.");
    const r = await this.rpc({
      keymap: {
        setLayerBinding: {
          layerId: l.id,
          keyPosition: key.row * 16 + key.col,
          binding: this.decodeBinding(code),
        },
      },
    });
    if (r.keymap?.setLayerBinding !== 0)
      throw new Error(
        `ZMK rejected the binding (${r.keymap?.setLayerBinding}).`,
      );
  }
  async save() {
    const r = await this.rpc({ keymap: { saveChanges: true } });
    if (!r.keymap?.saveChanges?.ok)
      throw new Error("ZMK could not save to persistent storage.");
  }
  async discard() {
    const r = await this.rpc({ keymap: { discardChanges: true } });
    if (!r.keymap?.discardChanges)
      throw new Error("ZMK could not discard changes.");
  }
  async close() {
    this.controller.abort();
    this.fail(new Error("ZMK disconnected."));
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      await this.writer?.abort();
      this.writer?.releaseLock();
    } catch {}
    await Promise.allSettled([this.writePipeline, this.readLoop]);
    try {
      await this.port.close();
    } catch {}
  }
}
export async function connectZmk() {
  if (!navigator.serial)
    throw new Error(
      "Use the desktop app to connect a ZMK Studio board over USB.",
    );
  const port = await navigator.serial.requestPort();
  const a = new ZmkAdapter(port);
  try {
    await a.start();
    return a;
  } catch (e) {
    await a.close();
    throw e;
  }
}
