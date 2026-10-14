export type TimestampUnit = "s" | "ms" | "us";
export interface PollingResult {
  reports: number;
  durationMs: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  hz: number;
  histogram: { ms: number; count: number }[];
}
export function parseTimestamps(text: string, unit: TimestampUnit): number[] {
  if (text.length > 5_000_000)
    throw new Error("Use a capture smaller than 5 MB.");
  const scale = { s: 1000, ms: 1, us: 0.001 };
  let values: unknown[],
    actualUnit = unit;
  if (/^\s*[\[{]/.test(text)) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) values = data;
    else {
      values = data.timestamps;
      if (!["s", "ms", "us"].includes(data.unit))
        throw new Error("JSON needs a unit: s, ms or us.");
      actualUnit = data.unit;
    }
    if (!Array.isArray(values))
      throw new Error("JSON needs an array of timestamps.");
  } else {
    const lines = text.trim().split(/\r?\n/).filter(Boolean),
      fields = (s: string) =>
        s.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
    const first = fields(lines[0] ?? "");
    let index = 0;
    if (!Number.isFinite(Number(first[0]))) {
      index = first.findIndex((x) =>
        /^(frame\.time_relative|timestamp(?:_(?:ms|us|s))?|time)$/i.test(x),
      );
      if (index < 0)
        throw new Error(
          "CSV needs a timestamp, timestamp_ms, timestamp_us, time or frame.time_relative column.",
        );
      const name = first[index];
      if (name === "frame.time_relative" || name.endsWith("_s"))
        actualUnit = "s";
      if (name.endsWith("_ms")) actualUnit = "ms";
      if (name.endsWith("_us")) actualUnit = "us";
      lines.shift();
    }
    values = lines.map((line) => fields(line)[index]);
  }
  return values.map((v) => {
    if (
      (typeof v !== "number" && typeof v !== "string") ||
      String(v).trim() === "" ||
      !Number.isFinite(Number(v)) ||
      Number(v) < 0
    )
      throw new Error("Every timestamp must be a non-negative number.");
    return Number(v) * scale[actualUnit];
  });
}
export function analyzePolling(timestamps: number[]): PollingResult {
  if (timestamps.length < 20)
    throw new Error(
      "Include at least 20 input report timestamps from one USB endpoint.",
    );
  const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
  if (intervals.some((t) => !Number.isFinite(t) || t <= 0))
    throw new Error(
      "Timestamps must increase. Export only completed input reports from one endpoint.",
    );
  const sorted = [...intervals].sort((a, b) => a - b),
    n = sorted.length;
  const medianMs =
    n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const bins = new Map<number, number>();
  for (const delta of intervals) {
    const ms = Math.round(delta * 1000) / 1000;
    bins.set(ms, (bins.get(ms) ?? 0) + 1);
  }
  return {
    reports: timestamps.length,
    durationMs: timestamps.at(-1)! - timestamps[0],
    medianMs,
    p95Ms: sorted[Math.ceil(n * 0.95) - 1],
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    hz: 1000 / medianMs,
    histogram: [...bins]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .sort((a, b) => a[0] - b[0])
      .map(([ms, count]) => ({ ms, count })),
  };
}
