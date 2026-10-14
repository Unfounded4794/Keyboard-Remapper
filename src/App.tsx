import { useEffect, useRef, useState } from "react";
import {
  Keyboard as KeyboardIcon,
  Command,
  Activity,
  Settings,
  SlidersHorizontal,
  Plug,
  Unplug,
  RefreshCw,
  Save,
  Upload,
  Download,
  Search,
  X,
  Square,
  Circle,
  Undo2,
  HelpCircle,
  Sun,
  Moon,
  Check,
  LockKeyhole,
  ChevronDown,
} from "lucide-react";
import { useWorkbench, type Page } from "./useWorkbench";
import Keyboard from "./components/Keyboard";
import { keyColors } from "./core/themes";
import ThemePicker from "./components/ThemePicker";
import MacroVisual from "./components/MacroVisual";
import Shortcuts from "./components/Shortcuts";
import { definitionId } from "./core/device-definitions";
import { visibleKeys } from "./core/definitions";
import {
  byCode,
  keycodesFor,
  hex,
  labelFor,
  macroKeycode,
  type Keycode,
} from "./core/keycodes";
import { download } from "./core/storage";
import { ViaAdapter } from "./protocols/via";
import { isMoneDevice, MoneAdapter } from "./protocols/mone";
import { monePalette } from "./core/mone";
import { isNizDevice, NizAdapter } from "./protocols/niz";
import type { TesterSize } from "./core/layouts";
import type { Timing } from "./core/macro-editor";
import {
  languages,
  localizedLegend,
  hostCodeFor,
  type LegendLanguage,
} from "./core/languages";
import {
  actionCode,
  layerActions,
  layerActionLabel,
  layerModifierCode,
} from "./core/layer-actions";
import { describeKey } from "./core/key-descriptions";
import PollingPanel from "./components/PollingPanel";
import { nizLabel, nizPalette } from "./core/niz";
export default function App() {
  const w = useWorkbench(),
    { project, adapter, via, zmk, niz, mone, prefs } = w;
  const palette = mone
      ? monePalette()
      : niz
        ? nizPalette()
        : keycodesFor(via?.info.keycodeTable),
    table = new Map(palette.map((k) => [k.value, k]));
  const layoutRef = useRef<HTMLDivElement>(null),
    recentRef = useRef<HTMLDivElement>(null),
    contentRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<Keycode | null>(null),
    [tapLayer, setTapLayer] = useState(0),
    [tapKey, setTapKey] = useState(44),
    [layerModifier, setLayerModifier] = useState(1);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    setHovered(null);
  }, [w.page]);
  useEffect(() => setHovered(null), [w.category, w.query, w.selected]);
  useEffect(() => {
    if (recentRef.current)
      recentRef.current.scrollLeft = recentRef.current.scrollWidth;
  }, [w.tester.current.total]);
  useEffect(() => {
    if (!w.layoutOpen) return;
    const close = (e: PointerEvent) => {
      if (!layoutRef.current?.contains(e.target as Node))
        w.setLayoutOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") w.setLayoutOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [w.layoutOpen]);
  function label(code: number) {
    if (mone?.label(code)) return mone.label(code)!;
    if (niz) {
      const name = nizLabel(code);
      if (name) return name;
    }
    if (code === 1) return "▽";
    if (project?.firmware === "ZMK" && project.bindings?.[code])
      return project.bindings[code].displayName;
    const first = macroKeycode(0, via?.info.keycodesVersion ?? 13);
    if (code >= first && code < first + (adapter?.info.macroCount ?? 0))
      return `Macro ${code - first + 1}`;
    if (code === 227 || code === 231)
      return `${code === 227 ? "L" : "R"}${prefs.os === "macOS" ? "Cmd" : prefs.os === "Windows" ? "Win" : "Super"}`;
    if (prefs.os === "macOS" && (code === 226 || code === 230))
      return code === 226 ? "LOption" : "ROption";
    const translated = localizedLegend(code, prefs.language);
    if (translated !== undefined) return translated;
    const action = layerActionLabel(code, via?.info.keycodesVersion ?? 13);
    if (action) return action;
    const k = table.get(code);
    return k
      ? k.category === "Special"
        ? describeKey(k).label
        : k.label
      : labelFor(code);
  }
  const shown = palette.filter((k) =>
    w.query
      ? (label(k.value) + " " + k.name + " " + describeKey(k).description)
          .toLowerCase()
          .includes(w.query.toLowerCase())
      : w.category === "Basic"
        ? ["Basic", "Modifiers", "Navigation", "Function", "Numpad"].includes(
            k.category,
          )
        : k.category === w.category,
  );
  const testKeys = visibleKeys(w.testDef, w.testOptions).filter(
      (k) => !k.encoder,
    ),
    expected = new Set(
      testKeys.map(
        (k) => hostCodeFor(w.testLayers[0][k.id]) ?? `matrix:${k.id}`,
      ),
    ),
    tested = [...expected].filter(
      (c) =>
        w.tester.current.seen.has(c) ||
        testKeys.some(
          (k) =>
            w.matrixSeen.has(k.id) &&
            (hostCodeFor(w.testLayers[0][k.id]) ?? `matrix:${k.id}`) === c,
        ),
    ).length,
    good = [...expected].filter(
      (c) => w.tester.current.state(c, prefs.passes) === "good",
    ).length,
    chatter = [...w.tester.current.chatter.keys()].filter(
      (c) => w.tester.current.state(c, prefs.passes) === "chatter",
    );
  const [behavior, setBehavior] = useState(0),
    [param1, setParam1] = useState("0"),
    [param2, setParam2] = useState("0");
  useEffect(() => {
    if (!zmk || !w.selected || !project) return;
    try {
      const b =
        project.bindings?.[project.layers[w.layer][w.selected]] ??
        zmk.decodeBinding(project.layers[w.layer][w.selected]);
      setBehavior(b.behaviorId);
      setParam1(String(b.param1));
      setParam2(String(b.param2));
    } catch {}
  }, [zmk, w.selected, w.layer, project]);
  function renderKey(k: Keycode) {
    const info = describeKey(k);
    const colors = keyColors(prefs.theme, k.value);
    return (
      <button
        key={`${k.category}-${k.name}`}
        className={`palette-key ${["Modifiers", "Navigation"].includes(k.category) ? "modifier" : ""} ${[40, 41].includes(k.value) ? "accent-key" : ""} ${w.selected && project?.layers[w.layer]?.[w.selected] === k.value ? "selected" : ""}`}
        style={
          colors ? { background: colors.cap, color: colors.text } : undefined
        }
        disabled={!w.selected || w.busy}
        title={`${info.description}\n${k.name}`}
        onPointerEnter={() => setHovered(k)}
        onPointerLeave={() => setHovered(null)}
        onFocus={() => setHovered(k)}
        onBlur={() => setHovered(null)}
        onClick={() => w.assign(k.value)}
      >
        <span>{label(k.value)}</span>
      </button>
    );
  }
  const navs = [
    { id: "keymap", name: "Keymap", icon: KeyboardIcon, disabled: !w.canEdit },
    { id: "macros", name: "Macros", icon: Command, disabled: !w.canEdit },
    { id: "tester", name: "Tester", icon: Activity, disabled: false },
    ...(w.canAnalog
      ? [
          {
            id: "analog",
            name: "Actuation",
            icon: SlidersHorizontal,
            disabled: false,
          },
        ]
      : []),
  ];
  return (
    <div className="workbench">
      <input
        hidden
        type="file"
        ref={w.input}
        accept=".json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void w.importFile(f);
          e.target.value = "";
        }}
      />
      <nav className="rail" aria-label="Main navigation">
        <div className="app-mark">
          <KeyboardIcon size={28} />
        </div>
        {navs.map((p) => (
          <button
            key={p.id}
            className={w.page === p.id ? "active" : ""}
            aria-label={p.name}
            title={p.disabled ? "Connect a keyboard" : p.name}
            disabled={p.disabled || w.busy}
            onClick={() => w.setPage(p.id as Page)}
          >
            <p.icon size={25} />
            <span>{p.name}</span>
          </button>
        ))}
        <button
          className={`settings-link ${w.page === "settings" ? "active" : ""}`}
          aria-label="Settings"
          onClick={() => w.setPage("settings")}
        >
          <Settings size={25} />
          <span>Settings</span>
        </button>
      </nav>
      <main
        ref={contentRef}
        className="content"
        data-keyboard={project?.definition.name ?? ""}
      >
        <div className="controls">
          <div className="page-controls">
            {w.page === "tester" && (
              <>
                <select
                  aria-label="Tester keyboard layout"
                  value={w.useConnected && project ? "connected" : w.testSize}
                  onChange={(e) => {
                    if (e.target.value === "connected") w.setUseConnected(true);
                    else {
                      w.setUseConnected(false);
                      w.setTestSize(e.target.value as TesterSize);
                    }
                    w.tester.current.blur();
                  }}
                >
                  {project && (
                    <option value="connected">{project.definition.name}</option>
                  )}
                  {(["100%", "TKL", "75%", "65%", "60%"] as TesterSize[]).map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                {!(w.useConnected && project) && (
                  <>
                    <select
                      aria-label="Tester enter layout"
                      value={w.testEnter}
                      onChange={(e) => w.setTestEnter(+e.target.value)}
                    >
                      <option value={0}>ANSI</option>
                      <option value={1}>ISO</option>
                    </select>
                    <select
                      aria-label="Tester bottom row"
                      value={w.testBottom}
                      onChange={(e) => w.setTestBottom(+e.target.value)}
                    >
                      <option value={0}>Standard</option>
                      <option value={1}>Tsangan</option>
                    </select>
                  </>
                )}
                <button onClick={w.resetTest}>
                  <RefreshCw size={18} />
                  Reset
                </button>
                {via?.info.protocol === "Vial" && !w.unlocked && (
                  <button disabled={w.busy} onClick={() => void w.unlock()}>
                    <LockKeyhole size={17} />
                    {w.unlockRemaining !== null
                      ? `Hold keys · ${Math.ceil(w.unlockRemaining / 8)} s`
                      : "Unlock"}
                  </button>
                )}
                {via && w.useConnected && (
                  <select
                    aria-label="Tester highlight source"
                    title="Physical scans highlight media and macro switches. They can miss very short presses; chatter measurements use key events."
                    value={w.matrixLive ? "matrix" : "events"}
                    onChange={(e) =>
                      w.setMatrixLive(e.target.value === "matrix")
                    }
                  >
                    <option value="events">Key event highlights</option>
                    <option value="matrix">Physical switch highlights</option>
                  </select>
                )}
              </>
            )}
            {w.page === "keymap" && w.canEdit && project && (
              <>
                <div className="layers" aria-label="Layers">
                  <span>Layer</span>
                  {project.layers.map((_, i) => (
                    <button
                      key={i}
                      aria-label={`Layer ${i}`}
                      title={
                        niz
                          ? i === 0
                            ? "Base layer"
                            : "Fn layer · hold Right Fn on the keyboard"
                          : undefined
                      }
                      className={w.layer === i ? "active" : ""}
                      onClick={() => {
                        w.setLayer(i);
                        w.setSelected(null);
                      }}
                    >
                      {niz ? (i === 0 ? "Base" : "Fn") : i}
                    </button>
                  ))}
                </div>
                {!!project.definition.labels.length && (
                  <div className="popover-anchor" ref={layoutRef}>
                    <button
                      aria-expanded={w.layoutOpen}
                      onClick={() => w.setLayoutOpen((o) => !o)}
                    >
                      Layout
                      <ChevronDown size={16} />
                    </button>
                    {w.layoutOpen && (
                      <div className="popover layout-popover">
                        {project.definition.labels.map((l, i) => (
                          <label key={i}>
                            {typeof l === "string" ? l : l[0]}
                            {typeof l === "string" ||
                            (l.length === 3 &&
                              /^(off|disabled|no)$/i.test(l[1]) &&
                              /^(on|enabled|yes)$/i.test(l[2])) ? (
                              <input
                                className="toggle-switch"
                                type="checkbox"
                                role="switch"
                                aria-label={typeof l === "string" ? l : l[0]}
                                checked={(project.options[i] ?? 0) !== 0}
                                onChange={(e) =>
                                  w.changeLayout(i, Number(e.target.checked))
                                }
                              />
                            ) : (
                              <select
                                aria-label={typeof l === "string" ? l : l[0]}
                                value={project.options[i] ?? 0}
                                onChange={(e) =>
                                  w.changeLayout(i, +e.target.value)
                                }
                              >
                                {(typeof l === "string"
                                  ? ["Off", "On"]
                                  : l.slice(1)
                                ).map((name, j) => (
                                  <option key={j} value={j}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  aria-label="Undo"
                  disabled={!w.undo.length || w.busy}
                  onClick={w.undoChange}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="primary"
                  disabled={!w.pending || w.busy}
                  onClick={() => void w.apply()}
                >
                  <Check size={18} />
                  Apply{w.pending > 0 ? ` (${w.pending})` : ""}
                </button>
                <button
                  disabled={!w.pending || w.busy}
                  onClick={w.cancelChanges}
                >
                  Cancel
                </button>
              </>
            )}
            {w.page === "macros" && (
              <button
                onClick={() => void w.loadMacros()}
                disabled={!via || w.busy || w.recording}
              >
                <RefreshCw size={18} />
                Reload
              </button>
            )}
          </div>
          <div className="connection-controls">
            {w.sessions.length > 0 && (
              <select
                aria-label="Connected keyboard"
                value={w.activeId ?? ""}
                disabled={w.busy || w.recording}
                onChange={(e) => {
                  const s = w.sessions.find((s) => s.id === e.target.value);
                  if (s) void w.switchDevice(s);
                }}
              >
                <option value="" disabled>
                  Choose keyboard
                </option>
                {w.sessions.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {s.adapter.info.name}
                    {w.sessions.filter(
                      (x) => x.adapter.info.name === s.adapter.info.name,
                    ).length > 1
                      ? ` · ${i + 1}`
                      : ""}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Legend language"
              title="Key legends. Match your operating system's keyboard language."
              value={prefs.language}
              onChange={(e) =>
                w.setPrefs((p) => ({
                  ...p,
                  language: e.target.value as LegendLanguage,
                }))
              }
            >
              {languages.map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
            {adapter && (
              <button
                aria-label="Disconnect keyboard"
                title="Disconnect keyboard"
                disabled={w.busy}
                onClick={() => void w.disconnect()}
              >
                <Unplug size={18} />
              </button>
            )}
            <div className="popover-anchor">
              <button
                onClick={() => {
                  w.setConnectOpen((o) => !o);
                  void w.discover();
                }}
                aria-expanded={w.connectOpen}
                disabled={w.busy || w.recording}
              >
                <Plug size={19} />
                {w.sessions.length ? "Add keyboard" : "Connect"}
              </button>
              {w.connectOpen && (
                <div className="popover connect-popover">
                  {w.available
                    .filter(
                      (d) =>
                        !w.sessions.some(
                          (s) =>
                            (s.adapter instanceof ViaAdapter ||
                              s.adapter instanceof NizAdapter ||
                              s.adapter instanceof MoneAdapter) &&
                            s.adapter.device === d,
                        ),
                    )
                    .map((d, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          w.setConnectOpen(false);
                          void w.task(() => w.addDevice(d));
                        }}
                      >
                        {isMoneDevice(d)
                          ? "Besides Studio M-ONE"
                          : isNizDevice(d)
                            ? "NIZ x108"
                            : d.productName ||
                              `USB ${hex(d.vendorId)}:${hex(d.productId)}`}
                      </button>
                    ))}
                  <button onClick={() => void w.connectNew("via")}>
                    USB keyboard…
                  </button>
                  <button onClick={() => void w.connectNew("zmk")}>
                    ZMK Studio…
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {w.message && (
          <div
            role={w.message.error ? "alert" : "status"}
            className={`notice ${w.message.error ? "error" : ""}`}
          >
            <span>{w.message.text}</span>
            <button
              aria-label="Dismiss message"
              onClick={() => w.setMessage(null)}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {w.busy && (
          <div className="busy-indicator" role="status">
            Reading / saving keyboard…
          </div>
        )}
        {w.session && !project && w.session.definitions.length > 0 && (
          <section className="definition-choice">
            <label>
              Choose keyboard / PCB
              <select
                aria-label="Keyboard model / PCB"
                value=""
                disabled={w.busy}
                onChange={(e) => void w.chooseDefinition(e.target.value)}
              >
                <option value="" disabled>
                  Select your board
                </option>
                {w.session.definitions.map((d) => (
                  <option key={definitionId(d)} value={definitionId(d)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">
              These boards share a USB identity.
              {w.session.identity
                ? " Your choice is remembered for this device."
                : " This device has no unique serial; choose its PCB when connecting."}
            </span>
          </section>
        )}
        {w.page === "tester" && (
          <>
            <div className="test-summary">
              <span>
                {tested} / {expected.size} tested
              </span>
              <span>{good} good</span>
              <span>
                {w.tester.current.held.size} held · {w.tester.current.peak} max
              </span>
              <span className={chatter.length ? "error-text" : ""}>
                {chatter.length} suspected chatter
              </span>
            </div>
            <section className="board-panel">
              <Keyboard
                themeId={prefs.theme}
                definition={w.testDef}
                options={w.testOptions}
                layers={w.testLayers}
                pressed={w.pressed}
                test
                matrixPressed={w.matrixPressed}
                matrixSeen={w.matrixSeen}
                unlock={w.unlockKeys}
                label={label}
                state={(c) => w.tester.current.state(c, prefs.passes)}
              />
            </section>
            <div className="test-legend">
              {[
                ["untested", "Untested"],
                ["observed", "Observed"],
                ["good", `Good (${prefs.passes}+ presses)`],
                ["held", "Held"],
                ["chatter", "Suspected chatter"],
              ].map(([state, name]) => (
                <span key={state}>
                  <i className={`legend-${state}`} />
                  {name}
                </span>
              ))}
            </div>
            {chatter.length > 0 && (
              <div className="chatter-results">
                {chatter.map((code) => (
                  <span key={code}>
                    {byCode.get(code)?.label ?? code}:{" "}
                    {w.tester.current.chatter.get(code)} fast re-presses
                    {!expected.has(code) ? " · outside this layout" : ""}
                  </span>
                ))}
              </div>
            )}
            <div className="tester-details">
              <div>
                <strong>Recent keys</strong>
                <div className="recent-keys" ref={recentRef}>
                  {w.tester.current.events
                    .filter((e) => e.type !== "up")
                    .slice(-150)
                    .map((e) => (
                      <span
                        key={e.press}
                        className={`recent-tone-${e.press % 2}`}
                        data-press={e.press}
                        title={`Press ${e.press} · ${e.code}`}
                        aria-label={`Press ${e.press}: ${byCode.get(e.code)?.label ?? e.code}`}
                      >
                        {byCode.get(e.code)?.label ?? e.code}
                      </span>
                    ))}
                </div>
              </div>
              <div className="tester-info">
                <label>
                  Chatter threshold{" "}
                  <select
                    aria-label="Chatter threshold"
                    value={prefs.threshold}
                    onChange={(e) =>
                      w.setPrefs((p) => ({ ...p, threshold: +e.target.value }))
                    }
                  >
                    {[10, 15, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} ms
                      </option>
                    ))}
                  </select>
                </label>
                <div className="popover-anchor">
                  <button
                    aria-label="Tester information"
                    aria-expanded={w.helpOpen}
                    onClick={() => w.setHelpOpen((o) => !o)}
                  >
                    <HelpCircle size={20} />
                  </button>
                  {w.helpOpen && (
                    <div className="popover help-popover">
                      Good means {prefs.passes} completed presses without
                      detected chatter. Default: 300 clean cycles, a screening
                      target, not a certification. Suspects recover after that
                      many new clean cycles. Repeats do not count. Fast
                      re-presses are suspects; firmware can hide switch bounce.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {via && w.matrixStatus && (
              <div className="matrix-status" aria-live="polite">
                {w.matrixStatus}
              </div>
            )}
            <PollingPanel eventInterval={w.tester.current.medianInterval} />
          </>
        )}
        {w.page === "keymap" && project && (
          <>
            <section className="board-panel">
              <Keyboard
                themeId={prefs.theme}
                baseLayers={w.baseline?.layers}
                definition={project.definition}
                options={project.options}
                layers={project.layers}
                layer={w.layer}
                selected={w.selected ?? undefined}
                pressed={w.pressed}
                matrixPressed={w.matrixPressed}
                physicalOnly={w.matrixLive}
                unlock={w.unlockKeys}
                onSelect={(k) =>
                  w.setSelected(k.id === w.selected ? null : k.id)
                }
                label={label}
              />
            </section>
            <div className="keymap-status">
              <span>
                {w.selected
                  ? `${label(project.layers[w.layer][w.selected])} · ${hex(project.layers[w.layer][w.selected])}`
                  : "Select a key to remap"}
              </span>
              <div>
                {via?.info.protocol === "Vial" && (
                  <button
                    className={w.unlocked ? "unlocked-button" : ""}
                    onClick={() => void w.unlock()}
                    disabled={w.busy || !!w.unlocked}
                  >
                    {w.unlocked ? (
                      <Check size={17} />
                    ) : (
                      <LockKeyhole size={17} />
                    )}
                    {w.unlocked
                      ? "Unlocked"
                      : w.unlockRemaining !== null
                        ? `Hold keys · ${Math.ceil(w.unlockRemaining / 8)} s`
                        : "Unlock"}
                  </button>
                )}
                {via && (
                  <select
                    aria-label="Key highlight source"
                    title="Key events follow remaps. Physical switches show matrix positions, including keys that send macros; requires firmware support."
                    value={w.matrixLive ? "matrix" : "events"}
                    onChange={(e) =>
                      w.setMatrixLive(e.target.value === "matrix")
                    }
                  >
                    <option value="events">Key event highlights</option>
                    <option value="matrix">Physical switch highlights</option>
                  </select>
                )}
              </div>
            </div>
            {via && (
              <div className="matrix-status" aria-live="polite">
                {w.matrixStatus}
              </div>
            )}
            <section className="mapping-panel">
              <div className="categories">
                {[
                  "Basic",
                  "Media",
                  "Macros",
                  "Layers",
                  "Special",
                  "Lighting",
                  "Platform",
                ].map((c) => (
                  <button
                    key={c}
                    className={w.category === c ? "active" : ""}
                    onClick={() => {
                      w.setCategory(c);
                      w.setQuery("");
                    }}
                  >
                    {c}
                  </button>
                ))}
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search keys"
                    placeholder="Search keys"
                    value={w.query}
                    onChange={(e) => w.setQuery(e.target.value)}
                  />
                  {w.query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => w.setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="key-help" aria-live="polite">
                {hovered && (
                  <>
                    <strong>{label(hovered.value)}</strong>
                    <span>{describeKey(hovered).description}</span>
                  </>
                )}
              </div>
              <div
                className={`keycode-grid ${w.category === "Layers" && !w.query ? "layer-grid" : ""}`}
              >
                {shown
                  .filter(
                    (k) =>
                      !zmk ||
                      k.value <= 0xa4 ||
                      k.category === "Media" ||
                      k.category === "Modifiers",
                  )
                  .map(renderKey)}
                {!w.query &&
                  w.category === "Macros" &&
                  !zmk &&
                  !niz &&
                  Array.from(
                    { length: adapter?.info.macroCount ?? 0 },
                    (_, i) => (
                      <button
                        className="palette-key"
                        key={i}
                        disabled={!w.selected || w.busy}
                        onClick={() =>
                          w.assign(
                            macroKeycode(i, via?.info.keycodesVersion ?? 13),
                          )
                        }
                      >
                        Macro {i + 1}
                      </button>
                    ),
                  )}
                {!w.query && w.category === "Macros" && niz && (
                  <button
                    className="palette-key"
                    disabled={!w.selected || w.busy}
                    onClick={() => w.setPage("macros")}
                  >
                    Edit macro
                  </button>
                )}
                {!w.query &&
                  w.category === "Layers" &&
                  !zmk &&
                  !niz &&
                  !mone && (
                    <div
                      className="layer-action-groups"
                      style={{
                        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${150 + project.layers.length * 74}px), 1fr))`,
                      }}
                    >
                      {layerActions
                        .filter(
                          (a) =>
                            actionCode(
                              a.id,
                              0,
                              via?.info.keycodesVersion ?? 13,
                            ) !== undefined,
                        )
                        .map((a) => (
                          <div className="layer-action-row" key={a.id}>
                            <span title={a.description}>{a.label}</span>
                            {project.layers.map((_, i) => {
                              const code = actionCode(
                                a.id,
                                i,
                                via?.info.keycodesVersion ?? 13,
                              );
                              return code === undefined ? null : (
                                <button
                                  className="palette-key"
                                  key={i}
                                  title={a.description}
                                  disabled={!w.selected || w.busy}
                                  onPointerEnter={() =>
                                    setHovered({
                                      value: code,
                                      label: `${a.id}(${i})`,
                                      name: a.description,
                                      category: "Layers",
                                    })
                                  }
                                  onPointerLeave={() => setHovered(null)}
                                  onBlur={() => setHovered(null)}
                                  onClick={() => w.assign(code)}
                                >
                                  {a.id}({i})
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      <div className="layer-composer">
                        <select
                          aria-label="Tap-hold layer"
                          value={Math.min(tapLayer, project.layers.length - 1)}
                          onChange={(e) => setTapLayer(+e.target.value)}
                        >
                          {project.layers.slice(0, 16).map((_, i) => (
                            <option key={i} value={i}>
                              Layer {i}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Tap key"
                          value={tapKey}
                          onChange={(e) => setTapKey(+e.target.value)}
                        >
                          {palette
                            .filter((k) => k.value >= 4 && k.value < 0xa5)
                            .map((k) => (
                              <option key={k.value} value={k.value}>
                                {label(k.value)}
                              </option>
                            ))}
                        </select>
                        <button
                          disabled={!w.selected || w.busy}
                          title="Tap sends the selected key; hold activates the selected layer."
                          onClick={() =>
                            w.assign(
                              0x4000 |
                                (Math.min(
                                  tapLayer,
                                  project.layers.length - 1,
                                ) <<
                                  8) |
                                tapKey,
                            )
                          }
                        >
                          Layer / tap key
                        </button>
                        <select
                          aria-label="Layer modifier"
                          value={layerModifier}
                          onChange={(e) => setLayerModifier(+e.target.value)}
                        >
                          {[
                            [1, "Ctrl"],
                            [2, "Shift"],
                            [4, "Alt"],
                            [8, "Win / Cmd"],
                            [17, "Right Ctrl"],
                            [18, "Right Shift"],
                            [20, "Right Alt"],
                            [24, "Right Win / Cmd"],
                          ]
                            .filter(
                              ([v]) =>
                                (via?.info.keycodesVersion ?? 13) >= 11 ||
                                Number(v) < 16,
                            )
                            .map(([v, n]) => (
                              <option key={v} value={v}>
                                {n}
                              </option>
                            ))}
                        </select>
                        <button
                          disabled={
                            !w.selected ||
                            w.busy ||
                            layerModifierCode(
                              Math.min(tapLayer, project.layers.length - 1),
                              layerModifier,
                              via?.info.keycodesVersion ?? 13,
                            ) === undefined
                          }
                          title="Hold to activate the selected layer with the selected modifier."
                          onClick={() =>
                            w.assign(
                              layerModifierCode(
                                Math.min(tapLayer, project.layers.length - 1),
                                layerModifier,
                                via?.info.keycodesVersion ?? 13,
                              )!,
                            )
                          }
                        >
                          Layer + modifier
                        </button>
                      </div>
                    </div>
                  )}
              </div>
              {zmk ? (
                <div className="custom-binding">
                  <select
                    aria-label="ZMK behavior"
                    value={behavior}
                    onChange={(e) => setBehavior(+e.target.value)}
                  >
                    {zmk.behaviors.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Parameter 1"
                    value={param1}
                    onChange={(e) => setParam1(e.target.value)}
                  />
                  <input
                    aria-label="Parameter 2"
                    value={param2}
                    onChange={(e) => setParam2(e.target.value)}
                  />
                  <button
                    disabled={!w.selected || w.busy}
                    onClick={() => {
                      const a = Number(param1),
                        b = Number(param2);
                      if (
                        !Number.isInteger(a) ||
                        a < 0 ||
                        a > 0xffffffff ||
                        !Number.isInteger(b) ||
                        b < 0 ||
                        b > 0xffffffff
                      ) {
                        w.notify("Use unsigned 32-bit parameters.", true);
                        return;
                      }
                      w.assign(
                        zmk.encodeBinding({
                          behaviorId: behavior,
                          param1: a,
                          param2: b,
                        }),
                      );
                    }}
                  >
                    Assign
                  </button>
                </div>
              ) : (
                <div className="custom-binding">
                  <input
                    aria-label="Custom keycode"
                    placeholder="Custom keycode · 0x0004"
                    value={w.raw}
                    onChange={(e) => w.setRaw(e.target.value)}
                  />
                  <button
                    disabled={!w.selected || w.busy}
                    onClick={() => {
                      if (!/^0x[\da-f]{1,4}$/i.test(w.raw.trim())) {
                        w.notify("Enter a QMK keycode, e.g. 0x0004.", true);
                        return;
                      }
                      w.assign(parseInt(w.raw, 16));
                      w.setRaw("");
                    }}
                  >
                    Assign
                  </button>
                </div>
              )}
            </section>
          </>
        )}
        {w.page === "macros" && w.canEdit && (
          <section
            className="macro-panel"
            aria-busy={w.busy || (!!(via || niz || mone) && !w.macrosReady)}
          >
            {via || niz || mone ? (
              <>
                <div className="macro-tabs">
                  {niz ? (
                    <select
                      aria-label="Macro key and layer"
                      value={w.macroIndex}
                      disabled={w.busy || w.recording}
                      onChange={(e) => {
                        const i = +e.target.value;
                        w.setMacroIndex(i);
                        w.setCaptured(null);
                        w.setExpression(w.macroPrograms[i] ?? "");
                      }}
                    >
                      {Array.from({ length: niz.info.macroCount }, (_, i) => (
                        <option key={i} value={i}>
                          {niz.macroLabel(i)}
                          {w.macroPrograms[i] ? " · Macro" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    Array.from({ length: adapter!.info.macroCount }, (_, i) => (
                      <button
                        key={i}
                        className={w.macroIndex === i ? "active" : ""}
                        disabled={w.busy || w.recording}
                        onClick={() => {
                          w.setMacroIndex(i);
                          w.setCaptured(null);
                          w.setExpression(w.macroPrograms[i] ?? "");
                        }}
                      >
                        Macro {i + 1}
                      </button>
                    ))
                  )}
                </div>
                {adapter!.info.macroCount > 0 ? (
                  <>
                    <div className="macro-toolbar">
                      <button
                        className={
                          w.recording
                            ? "record-button recording"
                            : "record-button"
                        }
                        disabled={w.busy}
                        onClick={
                          w.recording ? w.stopRecording : w.startRecording
                        }
                      >
                        {w.recording ? (
                          <Square size={19} />
                        ) : (
                          <Circle size={19} />
                        )}{" "}
                        {w.recording ? "Stop" : "Record"}
                      </button>
                      <label>
                        Timing
                        <select
                          aria-label="Macro timing"
                          value={w.timing}
                          disabled={w.busy}
                          onChange={(e) =>
                            w.setTiming(e.target.value as Timing)
                          }
                        >
                          <option value="recorded">Recorded</option>
                          <option value="none">No delay</option>
                          <option value="fixed">Fixed delay</option>
                        </select>
                      </label>
                      {w.timing === "fixed" && (
                        <label>
                          <input
                            aria-label="Fixed macro delay"
                            type="number"
                            min={0}
                            max={9999}
                            value={w.fixedDelay}
                            onChange={(e) =>
                              w.setFixedDelay(
                                Math.min(9999, Math.max(0, +e.target.value)),
                              )
                            }
                          />
                          ms
                        </label>
                      )}
                      <button
                        disabled={w.busy || w.recording}
                        onClick={() => {
                          w.setCaptured(null);
                          w.setExpression("");
                        }}
                      >
                        Clear
                      </button>
                      <button
                        className="primary"
                        disabled={
                          w.busy ||
                          w.recording ||
                          w.expression === w.macroPrograms[w.macroIndex]
                        }
                        onClick={() => void w.saveMacro()}
                      >
                        <Save size={18} />
                        Save to keyboard
                      </button>
                    </div>
                    <MacroVisual
                      key={`${w.activeId}-${w.macroIndex}`}
                      value={w.expression}
                      disabled={w.busy || w.recording}
                      label={label}
                      onChange={(value) => {
                        w.setCaptured(null);
                        w.setExpression(value);
                      }}
                    />
                    <label className="macro-code-label" htmlFor="macro-code">
                      Macro code
                    </label>
                    <textarea
                      id="macro-code"
                      aria-label="Macro sequence"
                      spellCheck={false}
                      readOnly={w.recording}
                      value={w.expression}
                      onChange={(e) => {
                        w.setCaptured(null);
                        w.setExpression(e.target.value);
                      }}
                      placeholder={
                        niz || mone
                          ? "Click Record, or add key actions above."
                          : "Type text here, or click Record and press your keys."
                      }
                    />
                    <div className="macro-note">
                      {w.recording
                        ? "Recording · Esc to stop"
                        : "Actions: {KC_A} · chord: {KC_LCTL,KC_C} · delay: {100}"}
                    </div>
                  </>
                ) : (
                  <p className="short-empty">
                    This keyboard has no macro support.
                  </p>
                )}
              </>
            ) : (
              <p className="short-empty">
                ZMK macros are defined in firmware. Assign existing macro
                behaviors in Keymap.
              </p>
            )}
          </section>
        )}
        {w.page === "analog" && w.canAnalog && project && (
          <section className="settings-panel analog-panel">
            {project.definition.analog!.controls.map((c) => (
              <label key={c.id} className="setting-row">
                <span>{c.label}</span>
                {c.min === 0 && c.max === 1 ? (
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={c.label}
                    checked={!!(project.analog[c.id] ?? c.default)}
                    onChange={(e) =>
                      w.change((p) => ({
                        ...p,
                        analog: {
                          ...p.analog,
                          [c.id]: e.target.checked ? 1 : 0,
                        },
                      }))
                    }
                  />
                ) : (
                  <div className="slider-setting">
                    <input
                      type="range"
                      aria-label={c.label}
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={project.analog[c.id] ?? c.default}
                      onChange={(e) =>
                        w.change((p) => ({
                          ...p,
                          analog: { ...p.analog, [c.id]: +e.target.value },
                        }))
                      }
                    />
                    <output>
                      {(project.analog[c.id] ?? c.default).toFixed(2)} {c.unit}
                    </output>
                  </div>
                )}
              </label>
            ))}
            <div className="settings-actions">
              <button
                className="primary"
                disabled={w.busy || !via}
                onClick={() =>
                  void w.task(async () => {
                    for (const c of project.definition.analog!.controls)
                      await via!.writeAnalog(
                        c,
                        project.analog[c.id] ?? c.default,
                      );
                    if (project.definition.analog?.save)
                      for (const channel of new Set(
                        project.definition.analog.controls.map(
                          (c) => c.channel,
                        ),
                      ))
                        await via!.command([9, channel]);
                    w.notify("Saved to keyboard.");
                  })
                }
              >
                Save to keyboard
              </button>
            </div>
          </section>
        )}
        {w.page === "settings" && (
          <div className="settings-grid">
            <section className="settings-panel">
              <h2>Appearance</h2>
              <div className="setting-row">
                <span>Mode</span>
                <div className="segmented">
                  <button
                    className={prefs.mode === "dark" ? "active" : ""}
                    onClick={() => w.setPrefs((p) => ({ ...p, mode: "dark" }))}
                  >
                    <Moon size={17} />
                    Dark
                  </button>
                  <button
                    className={prefs.mode === "light" ? "active" : ""}
                    onClick={() => w.setPrefs((p) => ({ ...p, mode: "light" }))}
                  >
                    <Sun size={17} />
                    Light
                  </button>
                </div>
              </div>
              <label className="setting-row">
                Key labels
                <select
                  aria-label="Operating system labels"
                  value={prefs.os}
                  onChange={(e) =>
                    w.setPrefs((p) => ({
                      ...p,
                      os: e.target.value as typeof prefs.os,
                    }))
                  }
                >
                  {["Windows", "macOS", "Linux"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="setting-row">
                <span>Color theme</span>
                <ThemePicker
                  value={prefs.theme}
                  mode={prefs.mode}
                  onChange={(theme) => w.setPrefs((p) => ({ ...p, theme }))}
                />
              </div>
            </section>
            <section className="settings-panel">
              <h2>Keyboard</h2>
              {adapter ? (
                <>
                  <div className="setting-row">
                    <span>{adapter.info.name}</span>
                    <span className="muted">{adapter.info.protocol}</span>
                  </div>
                  {w.session && w.session.definitions.length > 1 && (
                    <label className="setting-row">
                      Definition
                      <select
                        aria-label="Keyboard definition"
                        value={project ? definitionId(project.definition) : ""}
                        onChange={(e) =>
                          void w.chooseDefinition(e.target.value)
                        }
                      >
                        {w.session.definitions.map((d, i) => (
                          <option key={i} value={definitionId(d)}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="settings-actions">
                    <button
                      disabled={w.busy || !w.canEdit}
                      onClick={() =>
                        download(`${adapter.info.name}-layout.json`, project)
                      }
                    >
                      <Download size={18} />
                      Save layout to file
                    </button>
                    <button
                      disabled={w.busy || !w.canEdit}
                      onClick={() => w.chooseImport("project")}
                    >
                      <Upload size={18} />
                      Load layout from file
                    </button>
                  </div>
                </>
              ) : (
                <p className="short-empty">
                  Connect a keyboard to edit or save its layout.
                </p>
              )}
              <div className="setting-row">
                <span>Custom definition</span>
                <div className="inline-actions">
                  <button
                    disabled={w.busy}
                    onClick={() => w.chooseImport("definition")}
                  >
                    <Upload size={17} />
                    Add JSON
                  </button>
                  <div className="popover-anchor">
                    <button
                      aria-label="Definition information"
                      aria-expanded={w.helpOpen}
                      onClick={() => w.setHelpOpen((o) => !o)}
                    >
                      <HelpCircle size={20} />
                    </button>
                    {w.helpOpen && (
                      <div className="popover help-popover">
                        Known VIA boards load automatically. Vial reads its
                        definition from the keyboard. Add JSON only for an
                        unlisted board; it is remembered.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <label className="setting-row">
                Good after
                <select
                  aria-label="Good test count"
                  value={prefs.passes}
                  onChange={(e) =>
                    w.setPrefs((p) => ({ ...p, passes: +e.target.value }))
                  }
                >
                  {[10, 20, 50, 100, 300, 1000].map((n) => (
                    <option key={n} value={n}>
                      {n} completed presses
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <Shortcuts
              value={prefs.shortcuts}
              mac={prefs.os === "macOS"}
              onChange={(shortcuts) => w.setPrefs((p) => ({ ...p, shortcuts }))}
            />
          </div>
        )}
      </main>
    </div>
  );
}
