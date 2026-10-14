import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Definition, Layers, PhysicalKey } from "../types";
import { visibleKeys } from "../core/definitions";
import { labelFor } from "../core/keycodes";
import { hostCodeFor } from "../core/languages";
import { keyColors } from "../core/themes";
import type { CapColors } from "../core/theme-profiles";
import type { CSSProperties } from "react";
import { keyGeometry } from "../core/geometry";
interface Props {
  definition: Definition;
  options: number[];
  layers: Layers;
  layer?: number;
  selected?: string;
  pressed?: Set<string>;
  matrixPressed?: Set<string>;
  matrixSeen?: Set<string>;
  unlock?: Set<string>;
  onSelect?: (key: PhysicalKey) => void;
  label?: (code: number) => string;
  state?: (code: string) => string;
  test?: boolean;
  physicalOnly?: boolean;
  themeId?: string;
  baseLayers?: Layers;
}
function KeyLegend({ text, secondary }: { text: string; secondary: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      let size = text.length > 3 ? 14 : 17;
      el.style.fontSize = `${size}px`;
      while (
        size > 10 &&
        (el.firstElementChild!.scrollHeight > el.clientHeight - 6 ||
          el.firstElementChild!.scrollWidth > el.clientWidth - 6)
      ) {
        size--;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [text]);
  return (
    <span ref={ref} className={`key-label ${secondary ? "iso-label" : ""}`}>
      <span>{text}</span>
    </span>
  );
}
export default function Keyboard({
  definition,
  options,
  layers,
  layer = 0,
  selected,
  pressed = new Set(),
  matrixPressed = new Set(),
  matrixSeen = new Set(),
  unlock,
  onSelect,
  label = labelFor,
  state,
  test = false,
  physicalOnly = false,
  themeId = "classic",
  baseLayers = layers,
}: Props) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(1100);
  useEffect(() => {
    const o = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  const allKeys = visibleKeys(definition, options),
    keys = allKeys.filter((k) => !k.encoder),
    geometries = keys.map(keyGeometry);
  const corners = keys.flatMap((k, i) => {
    const g = geometries[i];
    return [
      [k.x + g.x, k.y + g.y],
      [k.x + g.x + g.width, k.y + g.y],
      [k.x + g.x, k.y + g.y + g.height],
      [k.x + g.x + g.width, k.y + g.y + g.height],
    ].map(([x, y]) => {
      const r = ((k.rotation ?? 0) * Math.PI) / 180,
        rx = k.rx ?? 0,
        ry = k.ry ?? 0;
      return [
        rx + (x - rx) * Math.cos(r) - (y - ry) * Math.sin(r),
        ry + (x - rx) * Math.sin(r) + (y - ry) * Math.cos(r),
      ];
    });
  });
  if (!corners.length) corners.push([0, 0], [1, 1]);
  const minX = Math.min(...corners.map((p) => p[0])),
    maxX = Math.max(...corners.map((p) => p[0])),
    minY = Math.min(...corners.map((p) => p[1])),
    maxY = Math.max(...corners.map((p) => p[1])),
    unit = Math.min(74, (width - 32) / (maxX - minX));
  return (
    <div className="keyboard-viewport" ref={ref}>
      <div
        className="keyboard-case"
        style={{
          width: (maxX - minX) * unit + 24,
          height: (maxY - minY) * unit + 24,
        }}
      >
        <div
          className="keyboard-bed"
          style={{ left: 12 - minX * unit, top: 12 - minY * unit }}
        >
          {keys.map((k, i) => {
            const g = geometries[i],
              value = layers[layer]?.[k.id] ?? 0,
              effective = value === 1 ? layers[0]?.[k.id] : value,
              host = hostCodeFor(effective ?? 0),
              down =
                matrixPressed.has(k.id) ||
                (!physicalOnly && !!host && pressed.has(host)),
              hostStatus = host ? state?.(host) : undefined,
              status =
                hostStatus === "chatter"
                  ? hostStatus
                  : test && matrixPressed.has(k.id)
                    ? "held"
                    : test &&
                        matrixSeen.has(k.id) &&
                        (!hostStatus || hostStatus === "untested")
                      ? "observed"
                      : hostStatus,
              text = label(value).replace(/^Num /, ""),
              physical =
                k.themeCode ?? k.defaultCode ?? baseLayers[0]?.[k.id] ?? 0,
              modifier = k.color
                ? k.color === "mod"
                : (physical >= 224 && physical <= 231) ||
                  [
                    40, 41, 42, 43, 57, 49, 50, 70, 71, 72, 73, 74, 75, 76, 77,
                    78, 101,
                  ].includes(physical),
              isSelected = !test && selected === k.id,
              colors: Partial<CapColors> =
                !down && (!status || status === "untested")
                  ? (keyColors(
                      themeId,
                      physical,
                      k.color ?? (modifier ? "mod" : "alpha"),
                    ) ?? {})
                  : {};
            return (
              <button
                key={`${k.id}-${i}`}
                data-testid={`key-${k.id}`}
                data-state={status ?? (down ? "held" : "")}
                data-theme-code={physical}
                aria-label={`Key ${text}, row ${k.row}, column ${k.col}`}
                aria-pressed={test ? down : isSelected}
                title={test ? `${text}${status ? ` · ${status}` : ""}` : text}
                className={`keycap ${k.knob !== undefined ? "knob" : ""} ${g.secondary ? "shaped" : ""} ${modifier ? "modifier" : ""} ${k.color === "accent" || (!k.color && [40, 41].includes(physical)) ? "accent-key" : ""} ${isSelected ? "selected" : ""} ${down ? "pressed" : ""} ${test && status ? `state-${status}` : ""} ${unlock?.has(k.id) ? "unlock" : ""}`}
                style={
                  {
                    ...(colors.cap ? { "--cap": colors.cap } : {}),
                    ...(colors.text ? { "--cap-text": colors.text } : {}),
                    left: (k.x + g.x) * unit + 3,
                    top: (k.y + g.y) * unit + 3,
                    width: g.width * unit - 6,
                    height: g.height * unit - 6,
                    transform: `rotate(${k.rotation ?? 0}deg)`,
                    transformOrigin: `${((k.rx ?? 0) - k.x - g.x) * unit - 3}px ${((k.ry ?? 0) - k.y - g.y) * unit - 3}px`,
                  } as CSSProperties
                }
                onClick={() => onSelect?.(k)}
              >
                <span className="keyface">
                  <svg
                    key={`${themeId}-${isSelected}-${down}-${status ?? ""}`}
                    viewBox={`${g.x - 0.015} ${g.y - 0.015} ${g.width + 0.03} ${g.height + 0.03}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {g.secondary ? (
                      <path d={g.path} />
                    ) : (
                      <rect
                        x="0"
                        y="0"
                        width={k.w}
                        height={k.h}
                        rx={k.knob !== undefined ? ".5" : ".09"}
                      />
                    )}
                  </svg>
                  <KeyLegend text={text} secondary={!!g.secondary} />
                  {status === "good" && <i className="key-state-mark">✓</i>}
                  {status === "chatter" && <i className="key-state-mark">!</i>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {!test && allKeys.some((k) => k.encoder) && (
        <div className="encoder-controls" aria-label="Encoder assignments">
          {[
            ...new Set(
              allKeys.flatMap((k) => (k.encoder ? [k.encoder.index] : [])),
            ),
          ].map((index) => (
            <div className="encoder-control" key={index}>
              <span>Knob {index + 1}</span>
              {[0, 1].map((direction) => {
                const k = allKeys.find(
                  (k) =>
                    k.encoder?.index === index &&
                    k.encoder.direction === direction,
                );
                return (
                  k && (
                    <button
                      key={direction}
                      className={selected === k.id ? "active" : ""}
                      aria-label={`Knob ${index + 1} ${direction ? "clockwise" : "counterclockwise"}`}
                      onClick={() => onSelect?.(k)}
                    >
                      <b>{direction ? "↻" : "↺"}</b>
                      {label(layers[layer]?.[k.id] ?? 0)}
                    </button>
                  )
                );
              })}
              {allKeys
                .filter((k) => k.knob === index)
                .map((k) => (
                  <button
                    key={k.id}
                    className={selected === k.id ? "active" : ""}
                    aria-label={`Knob ${index + 1} press`}
                    onClick={() => onSelect?.(k)}
                  >
                    ↓ {label(layers[layer]?.[k.id] ?? 0)}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
