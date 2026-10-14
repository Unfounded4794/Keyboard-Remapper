// Hardware emulator for the documented V2 command set, including zero-length write ACKs.
export function createFakeMone(factory: number[]) {
  return new (class extends EventTarget {
    opened = true;
    vendorId = 0x05ac;
    productId = 0x024f;
    productName = "M-ONE";
    collections = [
      {
        usagePage: 0xff1c,
        usage: 0x92,
        inputReports: [
          { reportId: 4, items: [{ reportSize: 8, reportCount: 63 }] },
        ],
        outputReports: [
          { reportId: 4, items: [{ reportSize: 8, reportCount: 63 }] },
        ],
      },
    ];
    factory = new Uint8Array(factory);
    current = new Uint8Array(factory);
    config = new Uint8Array(192);
    macros = new Uint8Array(3072);
    capabilities = new Uint8Array([
      170,
      85,
      0,
      0,
      13,
      170,
      24,
      ...Array(57).fill(0),
    ]);
    commands: number[] = [];
    writes: { cmd: number; offset: number; data: number[] }[] = [];
    ignoreWrites = false;
    badChecksum = false;
    configuring = false;
    async open() {
      this.opened = true;
    }
    async close() {
      this.opened = false;
    }
    async sendReport(id: number, p: Uint8Array) {
      if (id !== 4 || p.length !== 63) throw Error("Bad report framing");
      const sum = p.slice(2).reduce((n, v) => n + v, 0);
      if (sum !== (p[0] | (p[1] << 8))) throw Error("Bad checksum");
      const cmd = p[2],
        len = p[3],
        offset = p[4] | (p[5] << 8);
      this.commands.push(cmd);
      const r = p.slice();
      r.fill(0, 7);
      const regions: Record<number, Uint8Array> = {
        3: this.capabilities,
        5: this.config,
        7: this.factory,
        8: this.current,
        0x14: this.macros,
      };
      if (regions[cmd]) r.set(regions[cmd].slice(offset, offset + len), 7);
      else if (cmd === 1) {
        this.configuring = true;
        r[3] = 0;
      } else if (cmd === 2) {
        this.configuring = false;
        r[3] = 0;
      } else if (cmd === 9 || cmd === 0x15) {
        if (!this.configuring) throw Error("Write outside configure session");
        const data = [...p.slice(7, 7 + len)];
        this.writes.push({ cmd, offset, data });
        if (!this.ignoreWrites)
          (cmd === 9 ? this.current : this.macros).set(data, offset);
        r[3] = 0;
      } else throw Error(`Unexpected command ${cmd}`);
      if (this.badChecksum) r[0] ^= 1;
      const e = new Event("inputreport");
      Object.assign(e, { reportId: 4, data: new DataView(r.buffer) });
      this.dispatchEvent(e);
    }
  })();
}
