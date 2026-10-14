import { useRef, useState } from "react";
import {
  analyzePolling,
  parseTimestamps,
  type TimestampUnit,
  type PollingResult,
} from "../core/polling";
export default function PollingPanel({
  eventInterval,
}: {
  eventInterval: number | null;
}) {
  const input = useRef<HTMLInputElement>(null),
    [unit, setUnit] = useState<TimestampUnit>("s"),
    [result, setResult] = useState<PollingResult | null>(null),
    [error, setError] = useState(""),
    [name, setName] = useState("");
  return (
    <section className="polling-panel" aria-label="USB polling tester">
      <div className="polling-controls">
        <strong>USB polling</strong>
        <select
          aria-label="Capture timestamp unit"
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value as TimestampUnit);
            setResult(null);
            setName("");
            setError("");
          }}
        >
          <option value="s">Seconds</option>
          <option value="ms">Milliseconds</option>
          <option value="us">Microseconds</option>
        </select>
        <button onClick={() => input.current?.click()}>
          Import USB capture
        </button>
        {result && (
          <button
            onClick={() => {
              setResult(null);
              setName("");
            }}
          >
            Clear capture
          </button>
        )}
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept=".csv,.txt,.json"
        aria-label="USB capture file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 5_000_000)
              throw new Error("Use a capture smaller than 5 MB.");
            const r = analyzePolling(parseTimestamps(await file.text(), unit));
            setResult(r);
            setName(file.name);
            setError("");
          } catch (err) {
            setResult(null);
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      {error && <p role="alert">{error}</p>}
      {result ? (
        <>
          <div className="polling-stats">
            <span>
              <b>{Math.round(result.hz).toLocaleString()} Hz</b> report cadence
            </span>
            <span>{result.medianMs.toFixed(3)} ms median</span>
            <span>{result.p95Ms.toFixed(3)} ms p95</span>
            <span>
              {result.minMs.toFixed(3)}–{result.maxMs.toFixed(3)} ms range
            </span>
            <span>
              {result.reports.toLocaleString()} reports ·{" "}
              {(result.durationMs / 1000).toFixed(2)} s
            </span>
          </div>
          <div
            className="polling-histogram"
            aria-label="USB report interval histogram"
          >
            {result.histogram.map((b) => (
              <div key={b.ms}>
                <span>{b.ms.toFixed(3)} ms</span>
                <i
                  style={{
                    width: `${(100 * b.count) / Math.max(...result.histogram.map((x) => x.count))}%`,
                  }}
                />
                <span>{b.count}</span>
              </div>
            ))}
          </div>
          <p>
            {name} · Measured input-report cadence; idle suppression and capture
            timing affect the result.
          </p>
        </>
      ) : (
        <p>
          Load timestamps from a USB capture filtered to completed input reports
          on one keyboard endpoint. CSV (Wireshark time column), one timestamp
          per line, or JSON: {`{"unit":"ms","timestamps":[0,1,2,…]}`}
        </p>
      )}
      <p className="event-cadence">
        Key-event interval:{" "}
        {eventInterval === null
          ? "waiting for keypresses"
          : `${eventInterval.toFixed(1)} ms median`}{" "}
        · OS event timing, not USB polling.
      </p>
    </section>
  );
}
