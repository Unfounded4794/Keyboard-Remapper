import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Keyboard,
  Type,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { keycodes } from "../core/keycodes";
import { macroText, macroTokens } from "../core/macro-visual";
export default function MacroVisual({
  value,
  disabled,
  label,
  onChange,
}: {
  value: string;
  disabled: boolean;
  label: (n: number) => string;
  onChange: (value: string) => void;
}) {
  const tokens = macroTokens(value),
    [selected, setSelected] = useState<number | null>(null),
    [search, setSearch] = useState(""),
    [chord, setChord] = useState(false);
  const token = selected === null ? undefined : tokens[selected];
  const update = (raw: string) => {
    if (selected === null) onChange(value + raw);
    else
      onChange(tokens.map((t, i) => (i === selected ? raw : t.raw)).join(""));
  };
  const keyLabel = (name: string) => {
    const k = keycodes.find((k) => k.name === name);
    return k ? label(k.value) : name;
  };
  function move(delta: number) {
    if (selected === null || !tokens[selected + delta]) return;
    const items = [...tokens];
    [items[selected], items[selected + delta]] = [
      items[selected + delta],
      items[selected],
    ];
    onChange(items.map((t) => t.raw).join(""));
    setSelected(selected + delta);
  }
  return (
    <div className="macro-visual">
      <div className="macro-sequence" aria-label="Visual actions">
        {tokens.map((t, i) => (
          <button
            key={i}
            disabled={disabled}
            aria-label={`Action ${i + 1}: ${t.kind} ${t.keys?.map(keyLabel).join(" + ") ?? t.text}`}
            className={`macro-token ${i === selected ? "selected" : ""}`}
            onClick={() => {
              setSelected(i === selected ? null : i);
              setChord((t.keys?.length ?? 0) > 1);
            }}
          >
            {t.kind === "down" ? (
              <ArrowDown size={17} />
            ) : t.kind === "up" ? (
              <ArrowUp size={17} />
            ) : t.kind === "delay" ? (
              <Clock size={17} />
            ) : t.kind === "text" ? (
              <Type size={17} />
            ) : (
              <Keyboard size={17} />
            )}
            <span>
              {t.keys
                ? t.keys.map((k, j) => <kbd key={j}>{keyLabel(k)}</kbd>)
                : t.kind === "delay"
                  ? `${t.text} ms`
                  : t.kind === "raw"
                    ? "Firmware action"
                    : t.text || "Text"}
            </span>
          </button>
        ))}
        {!tokens.length && (
          <span className="muted">
            Record keys, add an action, or type text below.
          </span>
        )}
      </div>
      <div className="macro-edit-toolbar">
        {token ? (
          <>
            <button
              disabled={disabled || selected === 0}
              aria-label="Move action left"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={disabled || selected === tokens.length - 1}
              aria-label="Move action right"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
            <button
              disabled={disabled}
              aria-label="Delete action"
              onClick={() => {
                onChange(
                  tokens
                    .filter((_, i) => i !== selected)
                    .map((t) => t.raw)
                    .join(""),
                );
                setSelected(null);
              }}
            >
              <X size={18} />
            </button>
            {token.kind === "text" ? (
              <input
                aria-label="Action text"
                disabled={disabled}
                value={token.text}
                onChange={(e) => update(macroText(e.target.value))}
              />
            ) : token.kind === "delay" ? (
              <label>
                Delay{" "}
                <input
                  aria-label="Action delay"
                  type="number"
                  min={0}
                  max={600000}
                  disabled={disabled}
                  value={token.text}
                  onChange={(e) =>
                    update(
                      `{${Math.max(0, Math.min(600000, +e.target.value))}}`,
                    )
                  }
                />{" "}
                ms
              </label>
            ) : token.keys ? (
              <select
                aria-label="Action type"
                disabled={disabled}
                value={token.kind}
                onChange={(e) =>
                  update(
                    `{${e.target.value === "down" ? "+" : e.target.value === "up" ? "-" : ""}${token.keys!.join(",")}}`,
                  )
                }
              >
                <option value="tap">Tap / chord</option>
                <option value="down">Press</option>
                <option value="up">Release</option>
              </select>
            ) : (
              <span className="muted">
                Edit this firmware action in the code below.
              </span>
            )}
            <button disabled={disabled} onClick={() => setSelected(null)}>
              Done
            </button>
          </>
        ) : (
          <>
            <button
              disabled={disabled}
              onClick={() => {
                onChange(value + "{KC_A}");
                setSelected(tokens.length);
                setChord(false);
              }}
            >
              <Keyboard size={18} /> Add key
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                onChange(value + "{100}");
                setSelected(tokens.length);
              }}
            >
              <Clock size={18} /> Add delay
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                onChange(value + "Text");
                setSelected(
                  tokens.length - (tokens.at(-1)?.kind === "text" ? 1 : 0),
                );
              }}
            >
              <Type size={18} /> Add text
            </button>
          </>
        )}
      </div>
      {token?.keys && (
        <>
          <label className="macro-chord">
            <input
              type="checkbox"
              disabled={disabled}
              checked={chord}
              onChange={(e) => setChord(e.target.checked)}
            />{" "}
            Key combination
          </label>
          <input
            aria-label="Search macro keys"
            placeholder="Search keys"
            disabled={disabled}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="macro-key-palette">
            {keycodes
              .filter(
                (k) =>
                  k.value >= 4 &&
                  k.value <= 255 &&
                  (label(k.value) + " " + k.name)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((k) => (
                <button
                  className={`palette-key ${token.keys!.includes(k.name) ? "selected" : ""}`}
                  key={k.name}
                  disabled={disabled}
                  onClick={() => {
                    const keys = !chord
                      ? [k.name]
                      : token.keys!.includes(k.name)
                        ? token.keys!.filter((name) => name !== k.name)
                        : [...token.keys!, k.name];
                    if (keys.length)
                      update(
                        `{${token.kind === "down" ? "+" : token.kind === "up" ? "-" : ""}${keys.join(",")}}`,
                      );
                  }}
                >
                  {label(k.value)}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
