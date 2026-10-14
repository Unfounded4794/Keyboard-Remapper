export interface Sample {
  code: string;
  type: "down" | "up" | "pulse";
  at: number;
  press: number;
}
export class KeyboardTester {
  held = new Set<string>();
  seen = new Set<string>();
  releases = new Map<string, number>();
  chatter = new Map<string, number>();
  cycles = new Map<string, number>();
  cleanCycles = new Map<string, number>();
  private dirtyHeld = new Set<string>();
  peak = 0;
  total = 0;
  events: Sample[] = [];
  intervals: number[] = [];
  last: number | undefined;
  constructor(public threshold = 20) {}
  observePulse(code: string, at: number) {
    this.seen.add(code);
    this.total++;
    this.events.push({ code, type: "pulse", at, press: this.total });
    if (this.events.length > 200) this.events.shift();
  }
  ingest(code: string, type: "down" | "up", at: number, repeat = false) {
    if (
      repeat ||
      (type === "down" && this.held.has(code)) ||
      (type === "up" && !this.held.has(code))
    )
      return;
    if (type === "down") {
      const released = this.releases.get(code);
      if (
        released !== undefined &&
        at - released >= 0 &&
        at - released < this.threshold
      ) {
        this.chatter.set(code, (this.chatter.get(code) ?? 0) + 1);
        this.cleanCycles.set(code, 0);
        this.dirtyHeld.add(code);
      }
      this.held.add(code);
      this.seen.add(code);
      this.total++;
      this.peak = Math.max(this.peak, this.held.size);
    } else {
      this.held.delete(code);
      this.releases.set(code, at);
      this.cycles.set(code, (this.cycles.get(code) ?? 0) + 1);
      if (!this.dirtyHeld.delete(code))
        this.cleanCycles.set(code, (this.cleanCycles.get(code) ?? 0) + 1);
    }
    if (this.last !== undefined && at > this.last) {
      this.intervals.push(at - this.last);
      if (this.intervals.length > 1000) this.intervals.shift();
    }
    this.last = at;
    this.events.push({ code, type, at, press: this.total });
    if (this.events.length > 200) this.events.shift();
  }
  blur() {
    this.held.clear();
    this.releases.clear();
    this.last = undefined;
    this.dirtyHeld.clear();
  }
  state(
    code: string,
    required = 300,
  ): "untested" | "observed" | "good" | "held" | "chatter" {
    if (this.chatter.has(code) && (this.cleanCycles.get(code) ?? 0) < required)
      return "chatter";
    if (this.held.has(code)) return "held";
    if ((this.cleanCycles.get(code) ?? 0) >= required) return "good";
    return this.seen.has(code) ? "observed" : "untested";
  }
  get medianInterval() {
    if (!this.intervals.length) return null;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  report() {
    return {
      source: "Focused application keyboard events; not raw USB polling",
      tested: [...this.seen],
      maxSimultaneousKeys: this.peak,
      totalPresses: this.total,
      suspectedChatter: Object.fromEntries(this.chatter),
      consecutiveCleanCycles: Object.fromEntries(this.cleanCycles),
      chatterThresholdMs: this.threshold,
      medianEventIntervalMs: this.medianInterval,
      events: this.events,
    };
  }
}
