import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { effectiveTheme, themes } from "../core/themes";
export default function ThemePicker({
  value,
  mode,
  onChange,
}: {
  value: string;
  mode: "light" | "dark";
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [cursor, setCursor] = useState(0),
    ref = useRef<HTMLDivElement>(null);
  const selected = Math.max(
    0,
    themes.findIndex((t) => t.id === value),
  );
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open)
      ref.current
        ?.querySelector(`[data-index="${cursor}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);
  function colors(id: string) {
    const t = effectiveTheme(id, mode);
    return (
      <span className="theme-swatches" aria-hidden="true">
        {[t.key, t.mod, t.accentKey].map((c, i) => (
          <i key={i} style={{ background: c }} />
        ))}
      </span>
    );
  }
  return (
    <div
      className="theme-picker"
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        role="combobox"
        aria-label="Color theme"
        aria-expanded={open}
        aria-controls="theme-options"
        aria-activedescendant={open ? `theme-${cursor}` : undefined}
        onClick={() => {
          setCursor(selected);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.preventDefault();
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
            setCursor((i) =>
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? themes.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        themes.length - 1,
                        (open ? i : selected) +
                          (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
            );
          } else if (open && ["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onChange(themes[cursor].id);
            setOpen(false);
          }
        }}
      >
        {themes[selected].name}
        {colors(value)}
        <ChevronDown size={17} />
      </button>
      {open && (
        <div
          role="listbox"
          id="theme-options"
          aria-label="Color themes"
          className="theme-options"
        >
          {themes.map((t, i) => (
            <button
              role="option"
              id={`theme-${i}`}
              data-index={i}
              data-theme-id={t.id}
              key={t.id}
              aria-selected={value === t.id}
              className={cursor === i ? "highlighted" : ""}
              onPointerMove={() => setCursor(i)}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
                ref.current?.querySelector("button")?.focus();
              }}
            >
              {t.name}
              {colors(t.id)}
              {value === t.id ? (
                <Check size={16} />
              ) : (
                <span className="check-space" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
