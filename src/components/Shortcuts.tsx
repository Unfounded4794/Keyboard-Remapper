import { useState } from "react";
import {
  defaultShortcuts,
  shortcutFromEvent,
  shortcutLabel,
  type ShortcutPage,
} from "../core/shortcuts";
export default function Shortcuts({
  value,
  mac,
  onChange,
}: {
  value: typeof defaultShortcuts;
  mac: boolean;
  onChange: (value: typeof defaultShortcuts) => void;
}) {
  const [editing, setEditing] = useState<ShortcutPage | null>(null),
    [error, setError] = useState("");
  return (
    <section className="settings-panel">
      <h2>Tab shortcuts</h2>
      {(Object.keys(defaultShortcuts) as ShortcutPage[]).map((page) => (
        <div className="setting-row" key={page}>
          <span>{page[0].toUpperCase() + page.slice(1)}</span>
          <button
            aria-label={`${page} shortcut`}
            className={editing === page ? "active" : ""}
            onClick={() => {
              setEditing(page);
              setError("");
            }}
            onBlur={() => setEditing(null)}
            onKeyDown={(e) => {
              if (editing !== page) return;
              e.preventDefault();
              e.stopPropagation();
              if (e.code === "Escape") {
                setEditing(null);
                return;
              }
              const shortcut = shortcutFromEvent(e.nativeEvent);
              if (!shortcut) return;
              if (
                Object.entries(value).some(
                  ([key, v]) => key !== page && v === shortcut,
                )
              ) {
                setError("That shortcut is already assigned.");
                return;
              }
              onChange({ ...value, [page]: shortcut });
              setEditing(null);
              setError("");
            }}
          >
            {editing === page
              ? "Press shortcut…"
              : shortcutLabel(value[page], mac)}
          </button>
        </div>
      ))}
      <div className="settings-actions">
        <button
          onClick={() => {
            onChange({ ...defaultShortcuts });
            setError("");
          }}
        >
          Reset shortcuts
        </button>
        {error && <span role="alert">{error}</span>}
      </div>
    </section>
  );
}
