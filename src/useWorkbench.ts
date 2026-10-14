import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultLayers,
  parseDefinition,
  parseProject,
  unpackOptions,
} from "./core/definitions";
import { testerDefinition, type TesterSize } from "./core/layouts";
import { effectiveTheme } from "./core/themes";
import { findDefinitions } from "./core/registry";
import { byCode } from "./core/keycodes";
import {
  compileExpression,
  decodeExpression,
  recordedExpression,
  splitMacroMemory,
  type Timing,
} from "./core/macro-editor";
import { sameAssignment } from "./core/projects";
import { KeyboardTester } from "./core/tester";
import type { LegendLanguage } from "./core/languages";
import { captureKeyIdentities } from "./core/key-identities";
import { definitionId, resolveDefinition } from "./core/device-definitions";
import {
  defaultShortcuts,
  shortcutFromEvent,
  type ShortcutPage,
} from "./core/shortcuts";
import { connectVia, ViaAdapter } from "./protocols/via";
import { connectZmk, ZmkAdapter } from "./protocols/zmk";
import { connectMone, isMoneDevice, MoneAdapter } from "./protocols/mone";
import { connectNiz, isNizDevice, NizAdapter } from "./protocols/niz";
import type { Adapter, Definition, MacroEvent, Project } from "./types";
export type Page = "keymap" | "macros" | "tester" | "analog" | "settings";
async function connectHid(device?: HIDDevice) {
  if (!device) {
    const devices = await navigator.hid.requestDevice({
      filters: [
        { usagePage: 0xff60, usage: 0x61 },
        { vendorId: 0x05ac, productId: 0x024f, usagePage: 0xff1c, usage: 0x92 },
        { vendorId: 0x0483, productId: 0x5230, usagePage: 0x8c, usage: 1 },
      ],
    });
    device = devices[0];
    if (!device) throw Error("No keyboard selected.");
  }
  return isMoneDevice(device)
    ? connectMone(device)
    : isNizDevice(device)
      ? connectNiz(device)
      : connectVia(device);
}
interface Session {
  id: string;
  adapter: Adapter;
  definitions: Definition[];
  project?: Project;
  baseline?: Project;
  identity?: string | null;
  selectedDefinition?: Definition;
}
interface Preferences {
  mode: "dark" | "light";
  theme: string;
  threshold: number;
  passes: number;
  os: "Windows" | "macOS" | "Linux";
  language: LegendLanguage;
  testerVersion: number;
  shortcuts: typeof defaultShortcuts;
}
function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem("keystone.preferences") ?? "{}",
    );
    return {
      mode: "dark",
      threshold: 20,
      passes: 300,
      os: "Windows",
      language: "en-US",
      ...stored,
      shortcuts: { ...defaultShortcuts, ...stored.shortcuts },
      theme:
        stored.theme === "sound-waves" ? "wavez" : (stored.theme ?? "classic"),
      ...(!stored.testerVersion && (!stored.passes || stored.passes <= 5)
        ? { passes: 300 }
        : {}),
      testerVersion: 1,
    };
  } catch {
    return {
      mode: "dark",
      theme: "classic",
      shortcuts: { ...defaultShortcuts },
      threshold: 20,
      passes: 300,
      os: "Windows",
      language: "en-US",
      testerVersion: 1,
    };
  }
}
export function useWorkbench() {
  const [page, setPage] = useState<Page>("tester"),
    [prefs, setPrefs] = useState(loadPreferences),
    [sessions, setSessions] = useState<Session[]>([]),
    [activeId, setActiveId] = useState<string | null>(null),
    [available, setAvailable] = useState<HIDDevice[]>([]),
    [connectOpen, setConnectOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [project, setProject] = useState<Project | null>(null),
    [baseline, setBaseline] = useState<Project | null>(null),
    [layer, setLayer] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [category, setCategory] = useState("Basic"),
    [query, setQuery] = useState(""),
    [raw, setRaw] = useState(""),
    [undo, setUndo] = useState<Project[]>([]),
    [layoutOpen, setLayoutOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const [testSize, setTestSize] = useState<TesterSize>("100%"),
    [testEnter, setTestEnter] = useState(0),
    [testBottom, setTestBottom] = useState(0),
    [useConnected, setUseConnected] = useState(true),
    [pressed, setPressed] = useState(new Set<string>()),
    [matrixPressed, setMatrixPressed] = useState(new Set<string>()),
    [matrixSeen, setMatrixSeen] = useState(new Set<string>()),
    [matrixLive, setMatrixLive] = useState(false),
    [matrixStatus, setMatrixStatus] = useState(""),
    [unlockKeys, setUnlockKeys] = useState(new Set<string>()),
    [unlocked, setUnlocked] = useState<boolean | null>(null),
    [unlockRemaining, setUnlockRemaining] = useState<number | null>(null);
  const tester = useRef(new KeyboardTester(prefs.threshold)),
    [, tick] = useState(0),
    [macroIndex, setMacroIndex] = useState(0),
    [macroPrograms, setMacroPrograms] = useState<string[]>([]),
    [expression, setExpression] = useState(""),
    [timing, setTiming] = useState<Timing>("recorded"),
    [fixedDelay, setFixedDelay] = useState(50),
    [recording, setRecording] = useState(false),
    [captured, setCaptured] = useState<MacroEvent[] | null>(null);
  const recordingRef = useRef(false),
    macroLoadedFor = useRef<string | null>(null),
    recordStart = useRef(0),
    events = useRef<MacroEvent[]>([]),
    held = useRef(new Map<string, number>()),
    activeRef = useRef<Session | null>(null),
    projectRef = useRef(project),
    busyRef = useRef(false),
    pageRef = useRef(page),
    prefsRef = useRef(prefs),
    connectedRef = useRef(sessions),
    input = useRef<HTMLInputElement>(null),
    importMode = useRef<"definition" | "project">("definition"),
    startup = useRef(false);
  const hostPressCount = useRef(0);
  const nativeMediaSeen = useRef(new Map<string, number>());
  const session = sessions.find((s) => s.id === activeId) ?? null,
    adapter = session?.adapter ?? null,
    via = adapter instanceof ViaAdapter ? adapter : null,
    zmk = adapter instanceof ZmkAdapter ? adapter : null,
    niz = adapter instanceof NizAdapter ? adapter : null,
    mone = adapter instanceof MoneAdapter ? adapter : null;
  activeRef.current = session;
  projectRef.current = project;
  pageRef.current = page;
  prefsRef.current = prefs;
  connectedRef.current = sessions;
  const canEdit = !!adapter && !!project && !!baseline,
    canAnalog = canEdit && !!project?.definition.analog;
  const standalone = testerDefinition(testSize),
    testDef = useConnected && project ? project.definition : standalone,
    testOptions =
      useConnected && project ? project.options : [testEnter, testBottom, 0],
    testLayers =
      useConnected && project ? project.layers : defaultLayers(standalone, 1);
  const pending =
    project && baseline
      ? project.layers.reduce(
          (total, l, i) =>
            total +
            Object.keys(l).filter(
              (id) => !sameAssignment(project, baseline, i, id),
            ).length,
          0,
        )
      : 0;
  const notify = useCallback(
    (text: string, error = false) => setMessage({ text, error }),
    [],
  );
  function change(update: (p: Project) => Project) {
    const p = projectRef.current;
    if (!p || !canEdit) return;
    setUndo((u) => [...u.slice(-29), p]);
    const next = update(p);
    projectRef.current = next;
    setProject(next);
    setSessions((all) =>
      all.map((s) => (s.id === activeId ? { ...s, project: next } : s)),
    );
  }
  function changeLayout(index: number, value: number) {
    const p = projectRef.current;
    if (!p || !canEdit) return;
    const options = p.definition.labels.map((_, i) =>
      i === index ? value : (p.options[i] ?? 0),
    );
    const next = { ...p, options };
    projectRef.current = next;
    setProject(next);
    setSelected(null);
    setSessions((all) =>
      all.map((s) => (s.id === activeId ? { ...s, project: next } : s)),
    );
  }
  function cancelChanges() {
    if (!baseline || !project || busyRef.current) return;
    const next = {
      ...structuredClone(baseline),
      options: [...project.options],
    };
    if (zmk) zmk.restoreBindings(next.bindings ?? {});
    projectRef.current = next;
    setProject(next);
    setSessions((all) =>
      all.map((s) => (s.id === activeId ? { ...s, project: next } : s)),
    );
    setUndo([]);
    setSelected(null);
  }
  useEffect(() => {
    if (!project) return;
    localStorage.setItem(
      `keystone.view-layout.${project.definition.vendorId}.${project.definition.productId}.${project.definition.name}`,
      JSON.stringify(project.options),
    );
  }, [project?.definition, project?.options]);
  async function task(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    localStorage.setItem("keystone.preferences", JSON.stringify(prefs));
    tester.current.threshold = prefs.threshold;
    const theme = effectiveTheme(prefs.theme, prefs.mode),
      root = document.documentElement;
    root.dataset.mode = prefs.mode;
    root.dataset.theme = theme.id;
    for (const [k, v] of Object.entries({
      key: theme.key,
      "key-text": theme.text,
      mod: theme.mod,
      "mod-text": theme.modText,
      accent: theme.accent,
      "accent-text": theme.accentText,
      "accent-key": theme.accentKey,
      "accent-key-text": theme.accentKeyText,
    }))
      root.style.setProperty(`--${k}`, v);
  }, [prefs]);
  useEffect(() => {
    if (!message || message.error) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);
  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    const at = Math.round(performance.now() - recordStart.current);
    for (const [code, keycode] of held.current)
      events.current.push({ type: "up", code, keycode, at });
    held.current.clear();
    recordingRef.current = false;
    setRecording(false);
    setCaptured([...events.current]);
  }, []);
  useEffect(() => {
    if (page !== "macros") stopRecording();
    if (page !== "macros") macroLoadedFor.current = null;
    setHelpOpen(false);
    setLayoutOpen(false);
    setPressed(new Set());
    tester.current.blur();
  }, [page, stopRecording]);
  useEffect(() => {
    if (!canAnalog && page === "analog") setPage("tester");
    if (!canEdit && (page === "keymap" || page === "macros")) setPage("tester");
  }, [canEdit, canAnalog, page]);
  useEffect(() => {
    if (captured)
      setExpression(recordedExpression(captured, timing, fixedDelay));
  }, [captured, timing, fixedDelay]);
  useEffect(() => {
    function handle(e: KeyboardEvent, type: "down" | "up") {
      const editing =
        e.target instanceof HTMLElement &&
        !!e.target.closest('input,textarea,select,[contenteditable="true"]');
      if (editing && type === "down" && !recordingRef.current) return;
      if (recordingRef.current && e.code === "Escape") {
        e.preventDefault();
        stopRecording();
        return;
      }
      const testing = pageRef.current === "tester";
      if (
        type === "down" &&
        !editing &&
        !recordingRef.current &&
        !busyRef.current &&
        !e.repeat &&
        !e.getModifierState("AltGraph")
      ) {
        const shortcut = shortcutFromEvent(e),
          target = (Object.keys(defaultShortcuts) as ShortcutPage[]).find(
            (p) => prefsRef.current.shortcuts[p] === shortcut,
          );
        if (
          target &&
          (target === "tester" ||
            target === "settings" ||
            !!activeRef.current?.project)
        ) {
          e.preventDefault();
          setPage(target);
          tester.current.blur();
          setPressed(new Set());
          return;
        }
      }
      if (testing || recordingRef.current) e.preventDefault();
      if (type === "down" && e.repeat) return;
      if (type === "down" && /^(Media|AudioVolume)/.test(e.code))
        nativeMediaSeen.current.set(e.code, performance.now());
      if (type === "down" && !editing) hostPressCount.current++;
      setPressed((p) => {
        const n = new Set(p);
        type === "down" ? n.add(e.code) : n.delete(e.code);
        return n;
      });
      if (testing) {
        tester.current.ingest(e.code, type, performance.now(), e.repeat);
        tick((t) => t + 1);
      }
      if (recordingRef.current) {
        const keycode = byCode.get(e.code)?.value;
        if (!keycode) return;
        if (
          (type === "down" && held.current.has(e.code)) ||
          (type === "up" && !held.current.has(e.code))
        )
          return;
        type === "down"
          ? held.current.set(e.code, keycode)
          : held.current.delete(e.code);
        events.current.push({
          type,
          code: e.code,
          keycode,
          at: Math.round(performance.now() - recordStart.current),
        });
        setCaptured([...events.current]);
      }
    }
    const down = (e: KeyboardEvent) => handle(e, "down"),
      up = (e: KeyboardEvent) => handle(e, "up"),
      clear = () => {
        setPressed(new Set());
        tester.current.blur();
        stopRecording();
        tick((t) => t + 1);
      };
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stopRecording]);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = window.keystone?.onMediaKey?.((code) => {
      if (
        performance.now() - (nativeMediaSeen.current.get(code) ?? -Infinity) <
        100
      )
        return;
      // Give a corresponding DOM key event time to arrive regardless of which
      // notification Windows delivers first. Only DOM events update this map.
      const observation = setTimeout(() => {
        timers.delete(observation);
        if (
          performance.now() - (nativeMediaSeen.current.get(code) ?? -Infinity) <
          100
        )
          return;
        setPressed((p) => new Set([...p, code]));
        // app-command has no release timestamp: never fabricate clean switch
        // cycles, chatter timing, or rollover holds from this visual pulse.
        if (pageRef.current === "tester") {
          tester.current.observePulse(code, performance.now());
          tick((t) => t + 1);
        }
        const timer = setTimeout(() => {
          setPressed((p) => {
            const next = new Set(p);
            next.delete(code);
            return next;
          });
          timers.delete(timer);
        }, 160);
        timers.add(timer);
      }, 45);
      timers.add(observation);
    });
    return () => {
      unsubscribe?.();
      timers.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (busyRef.current || via?.info.protocol !== "Vial") return;
      try {
        const status = await via.unlockStatus();
        if (!cancelled) setUnlocked(status[0] === 1);
      } catch {
        /* Connection errors are reported by the active operation. */
      }
    };
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, [via]);
  useEffect(() => {
    if (
      !via ||
      !matrixLive ||
      busy ||
      !["keymap", "tester"].includes(page) ||
      !project ||
      (page === "tester" && !useConnected)
    )
      return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>;
    const started = performance.now(),
      presses = hostPressCount.current;
    let received = false;
    setMatrixStatus("Press a key to check physical switch data");
    const poll = async () => {
      try {
        const p = await via.matrix(project.definition);
        if (!cancelled) {
          setMatrixPressed(p);
          setMatrixSeen((seen) => new Set([...seen, ...p]));
          if (p.size) {
            received = true;
            setMatrixStatus("Physical switches live · ignores remaps");
          }
          if (
            !received &&
            performance.now() - started > 4000 &&
            hostPressCount.current > presses
          ) {
            setMatrixLive(false);
            setMatrixStatus(
              "No physical switch data. Unlock the keyboard or enable matrix testing in its firmware.",
            );
            return;
          }
          timer = setTimeout(poll, 65);
        }
      } catch (e) {
        if (!cancelled) {
          setMatrixLive(false);
          setMatrixStatus(`Physical switch data unavailable: ${String(e)}`);
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setMatrixPressed(new Set());
    };
  }, [via, matrixLive, busy, page, project?.definition, useConnected, notify]);
  async function makeProject(a: Adapter, d: Definition): Promise<Project> {
    const layers = await a.readLayers(d),
      options =
        a instanceof ViaAdapter ? unpackOptions(d, await a.readOptions()) : [];
    try {
      const stored = JSON.parse(
        localStorage.getItem(
          `keystone.view-layout.${d.vendorId}.${d.productId}.${d.name}`,
        ) ?? "null",
      );
      if (
        Array.isArray(stored) &&
        stored.length === d.labels.length &&
        stored.every(
          (v, i) =>
            Number.isInteger(v) &&
            v >= 0 &&
            v < (typeof d.labels[i] === "string" ? 2 : d.labels[i].length - 1),
        )
      )
        options.splice(0, options.length, ...stored);
    } catch {}
    const analog: Record<string, number> = {};
    if (a instanceof ViaAdapter && d.analog)
      for (const c of d.analog.controls) analog[c.id] = await a.readAnalog(c);
    const identityKey = `keystone.key-identities.${d.vendorId}.${d.productId}.${d.name}`;
    let remembered: Record<string, number> = {};
    try {
      const saved = JSON.parse(localStorage.getItem(identityKey) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved))
        for (const [key, value] of Object.entries(saved))
          if (
            Number.isInteger(value) &&
            Number(value) >= 4 &&
            Number(value) <= 255
          )
            remembered[key] = Number(value);
    } catch {}
    const definition = captureKeyIdentities(d, layers, remembered);
    localStorage.setItem(
      identityKey,
      JSON.stringify(
        Object.fromEntries(
          definition.keys
            .filter((k) => k.themeCode !== undefined)
            .map((k) => [k.id, k.themeCode]),
        ),
      ),
    );
    return {
      version: 1,
      definition,
      layers,
      options,
      macros: [],
      analog,
      firmware:
        a instanceof ZmkAdapter
          ? "ZMK"
          : a instanceof MoneAdapter
            ? "M-ONE"
            : a instanceof NizAdapter
              ? "NIZ"
              : "QMK",
      bindings: a instanceof ZmkAdapter ? { ...a.bindings } : undefined,
    };
  }
  function install(p: Project, id: string, base = p) {
    const current = connectedRef.current.find((s) => s.id === id);
    if (current) current.adapter.info.name = p.definition.name;
    macroLoadedFor.current = null;
    setUseConnected(true);
    setMatrixSeen(new Set());
    setProject(p);
    setBaseline(structuredClone(base));
    setActiveId(id);
    setLayer(0);
    setSelected(null);
    setUndo([]);
    setMacroPrograms([]);
    setExpression("");
    setMacroIndex(0);
    setCaptured(null);
    tester.current = new KeyboardTester(prefsRef.current.threshold);
    setSessions((all) =>
      all.map((s) =>
        s.id === id ? { ...s, project: p, baseline: structuredClone(base) } : s,
      ),
    );
  }
  async function activate(s: Session) {
    setUnlocked(null);
    setUnlockRemaining(null);
    if (s.adapter instanceof ViaAdapter && s.adapter.info.protocol === "Vial")
      setUnlocked((await s.adapter.unlockStatus())[0] === 1);
    if (!s.definitions.length) {
      setActiveId(s.id);
      setProject(null);
      setBaseline(null);
      notify("Definition not found. Add its JSON in Settings.", true);
      return false;
    }
    let remembered: string | undefined;
    if (s.identity)
      try {
        remembered =
          localStorage.getItem(`keystone.definition.${s.identity}`) ??
          undefined;
      } catch {}
    const chosen =
      s.selectedDefinition ??
      s.project?.definition ??
      resolveDefinition(
        s.definitions,
        s.adapter instanceof ViaAdapter
          ? s.adapter.device.productName
          : s.adapter.info.name,
        remembered,
      );
    if (!chosen) {
      setActiveId(s.id);
      setProject(null);
      setBaseline(null);
      setSelected(null);
      setPage("tester");
      setMatrixLive(false);
      if (s.adapter instanceof ViaAdapter)
        s.adapter.info.name = `USB ${s.adapter.device.vendorId.toString(16).toUpperCase()}:${s.adapter.device.productId.toString(16).toUpperCase()} · Choose PCB`;
      return false;
    }
    const d = chosen,
      actual = await makeProject(s.adapter, d);
    const staged =
      s.project &&
      s.baseline &&
      (JSON.stringify(s.project.analog) !== JSON.stringify(s.baseline.analog) ||
        s.project.layers.some((l, i) =>
          Object.keys(l).some(
            (id) => !sameAssignment(s.project!, s.baseline!, i, id),
          ),
        ));
    install(staged ? s.project! : actual, s.id, actual);
    return true;
  }
  async function switchDevice(s: Session) {
    const deadline = performance.now() + 30000;
    while (busyRef.current && performance.now() < deadline)
      await new Promise((r) => setTimeout(r, 25));
    if (busyRef.current) {
      notify("Keyboard is still busy. Try switching again.", true);
      return;
    }
    await task(async () => {
      await activate(s);
    });
  }
  async function chooseDefinition(id: string) {
    const s = activeRef.current;
    if (!s) return;
    const d = s.definitions.find((d) => definitionId(d) === id);
    if (!d) return;
    await task(async () => {
      const p = await makeProject(s.adapter, d);
      s.selectedDefinition = d;
      if (s.identity)
        localStorage.setItem(
          `keystone.definition.${s.identity}`,
          definitionId(d),
        );
      install(p, s.id);
      setPage("keymap");
    });
  }
  async function addDevice(device?: HIDDevice, showEditor = true) {
    if (device) {
      const existing = connectedRef.current.find(
        (s) =>
          (s.adapter instanceof ViaAdapter ||
            s.adapter instanceof NizAdapter ||
            s.adapter instanceof MoneAdapter) &&
          s.adapter.device === device,
      );
      if (existing) {
        const loaded = await activate(existing);
        if (showEditor && loaded) setPage("keymap");
        return;
      }
    }
    const a = await connectHid(device);
    const definitions = a.definition
      ? [a.definition]
      : await findDefinitions(
          a.device.vendorId,
          a.device.productId,
          a.info.version,
        );
    const identity = await window.keystone?.keyboardIdentity?.(
      a.device.vendorId,
      a.device.productId,
      a.device.productName,
    );
    const s: Session = {
      id: crypto.randomUUID(),
      adapter: a,
      definitions,
      identity,
    };
    setSessions((all) => [...all, s]);
    connectedRef.current = [...connectedRef.current, s];
    const loaded = await activate(s);
    if (showEditor && loaded) setPage("keymap");
  }
  async function discover() {
    if (!navigator.hid) return [];
    await window.keystone?.beginIdentityScan?.();
    const all = (await navigator.hid.getDevices()).filter(
      (d) =>
        isNizDevice(d) ||
        isMoneDevice(d) ||
        d.collections.some((c) => c.usagePage === 0xff60 && c.usage === 0x61),
    );
    setAvailable(all);
    return all;
  }
  useEffect(() => {
    if (startup.current) return;
    startup.current = true;
    void task(async () => {
      const devices = await discover();
      let selectedFirst = false;
      for (const d of devices) {
        try {
          const a = await connectHid(d),
            definitions = a.definition
              ? [a.definition]
              : await findDefinitions(d.vendorId, d.productId, a.info.version);
          const identity = await window.keystone?.keyboardIdentity?.(
            d.vendorId,
            d.productId,
            d.productName,
          );
          const s: Session = {
            id: crypto.randomUUID(),
            adapter: a,
            definitions,
            identity,
          };
          setSessions((all) => [...all, s]);
          connectedRef.current = [...connectedRef.current, s];
          if (!selectedFirst) {
            const loaded = await activate(s);
            selectedFirst = true;
            if (loaded) setPage("keymap");
          }
        } catch (e) {
          notify(String(e), true);
        }
      }
    });
  }, []);
  useEffect(() => {
    const disconnected = (e: HIDConnectionEvent) => {
      const s = connectedRef.current.find(
        (s) =>
          (s.adapter instanceof ViaAdapter ||
            s.adapter instanceof NizAdapter ||
            s.adapter instanceof MoneAdapter) &&
          s.adapter.device === e.device,
      );
      if (!s) return;
      void s.adapter.close();
      setSessions((all) => all.filter((x) => x.id !== s.id));
      if (activeRef.current?.id === s.id) {
        stopRecording();
        setActiveId(null);
        setProject(null);
        setBaseline(null);
        setPage("tester");
        setMatrixLive(false);
      }
      void discover();
    };
    const added = () => {
      void discover();
    };
    navigator.hid?.addEventListener("disconnect", disconnected);
    navigator.hid?.addEventListener("connect", added);
    return () => {
      navigator.hid?.removeEventListener("disconnect", disconnected);
      navigator.hid?.removeEventListener("connect", added);
    };
  }, [stopRecording]);
  async function connectNew(kind: "via" | "zmk") {
    stopRecording();
    setConnectOpen(false);
    await task(async () => {
      if (kind === "via") {
        await addDevice();
        await discover();
      } else {
        const a = await connectZmk(),
          s: Session = {
            id: crypto.randomUUID(),
            adapter: a,
            definitions: a.definition ? [a.definition] : [],
          };
        a.onDisconnect = () => {
          setSessions((all) => all.filter((x) => x.id !== s.id));
          if (activeRef.current?.id === s.id) {
            setProject(null);
            setBaseline(null);
            setActiveId(null);
            setPage("tester");
          }
        };
        setSessions((all) => [...all, s]);
        await activate(s);
        setPage("keymap");
      }
    });
  }
  async function disconnect() {
    await task(async () => {
      stopRecording();
      await adapter?.close();
      setSessions((all) => all.filter((s) => s.id !== activeId));
      setActiveId(null);
      setProject(null);
      setBaseline(null);
      setPage("tester");
      setMatrixLive(false);
    });
  }
  function assign(code: number) {
    if (!selected || !canEdit) return;
    change((p) => ({
      ...p,
      layers: p.layers.map((l, i) =>
        i === layer ? { ...l, [selected]: code } : l,
      ),
      bindings: zmk ? { ...zmk.bindings } : p.bindings,
    }));
  }
  async function apply() {
    await task(async () => {
      if (!project || !baseline || !adapter) return;
      if (zmk) zmk.restoreBindings(project.bindings ?? {});
      localStorage.setItem("keystone.recovery", JSON.stringify(baseline));
      let written = 0;
      try {
        for (let l = 0; l < project.layers.length; l++)
          for (const k of new Map(
            project.definition.keys.map((k) => [k.id, k]),
          ).values())
            if (!sameAssignment(project, baseline, l, k.id)) {
              await adapter.writeKey(l, k, project.layers[l][k.id]);
              written++;
            }
        if (zmk) await zmk.save();
        if (mone)
          await mone.commit((data) =>
            localStorage.setItem(
              "keystone.mone-recovery",
              JSON.stringify(data),
            ),
          );
        if (niz)
          await niz.commit((reports) =>
            localStorage.setItem(
              "keystone.niz-recovery",
              JSON.stringify({ version: niz.firmwareVersion, reports }),
            ),
          );
        const actual = await adapter.readLayers(project.definition);
        if (
          actual.some((l, i) =>
            Object.entries(project.layers[i]).some(([id, v]) => l[id] !== v),
          )
        )
          throw new Error("Keymap verification failed.");
        setBaseline(structuredClone(project));
        setUndo([]);
        setSessions((all) =>
          all.map((s) =>
            s.id === activeId
              ? { ...s, project, baseline: structuredClone(project) }
              : s,
          ),
        );
        notify("Saved to keyboard.");
      } catch (e) {
        niz?.discard();
        mone?.discard();
        if (zmk)
          try {
            await zmk.discard();
          } catch {}
        try {
          const actual = await makeProject(adapter, project.definition);
          setBaseline(actual);
        } catch {
          setBaseline(null);
        }
        throw new Error(
          `${e instanceof Error ? e.message : e} ${written} keys written. Unsaved changes remain visible.`,
        );
      }
    });
  }
  async function loadMacros() {
    if ((!via && !niz && !mone) || busyRef.current) return;
    macroLoadedFor.current = activeId;
    await task(async () => {
      const programs = mone
        ? await mone.macroPrograms()
        : niz
          ? await niz.macroPrograms()
          : splitMacroMemory(await via!.readMacros(), via!.info.macroCount).map(
              (b) => decodeExpression(b, via!.macroFormat),
            );
      setMacroPrograms(programs);
      const index =
        niz && selected && project
          ? niz.definition.keys.find((k) => k.id === selected)!.col +
            layer * 108
          : 0;
      setExpression(programs[index] ?? "");
      setMacroIndex(index);
      setCaptured(null);
    });
  }
  useEffect(() => {
    if (
      page === "macros" &&
      (via || niz || mone) &&
      !busy &&
      macroLoadedFor.current !== activeId
    )
      void loadMacros();
  }, [page, via, niz, mone, busy, activeId]);
  function startRecording() {
    events.current = [];
    held.current.clear();
    recordStart.current = performance.now();
    recordingRef.current = true;
    setRecording(true);
    setCaptured([]);
    setExpression("");
    (document.activeElement as HTMLElement)?.blur();
  }
  async function saveMacro() {
    await task(async () => {
      if (mone) {
        if (pending)
          throw Error("Apply or cancel keymap changes before saving a macro.");
        await mone.writeMacro(macroIndex, expression, (data) =>
          localStorage.setItem("keystone.mone-recovery", JSON.stringify(data)),
        );
        const programs = await mone.macroPrograms();
        setMacroPrograms(programs);
        setExpression(programs[macroIndex]);
        setCaptured(null);
        notify("Macro saved to keyboard.");
        return;
      }
      if (niz) {
        if (pending)
          throw Error(
            "Apply or cancel keymap changes before saving a NIZ macro.",
          );
        const index = macroIndex;
        await niz.writeMacro(index, expression, (reports) =>
          localStorage.setItem(
            "keystone.niz-recovery",
            JSON.stringify({ version: niz.firmwareVersion, reports }),
          ),
        );
        install(await makeProject(niz, niz.definition), activeId!);
        const programs = await niz.macroPrograms();
        macroLoadedFor.current = activeId;
        setMacroPrograms(programs);
        setMacroIndex(index);
        setExpression(programs[index]);
        setCaptured(null);
        notify("Macro saved to keyboard.");
        return;
      }
      if (!via) return;
      await via.writeMacro(
        macroIndex,
        compileExpression(expression, via.macroFormat),
        (b) =>
          localStorage.setItem(
            "keystone.macro-recovery",
            JSON.stringify([...b]),
          ),
      );
      const programs = splitMacroMemory(
        await via.readMacros(),
        via.info.macroCount,
      ).map((b) => decodeExpression(b, via.macroFormat));
      setMacroPrograms(programs);
      setExpression(programs[macroIndex]);
      setCaptured(null);
      notify(`Macro ${macroIndex + 1} saved to keyboard.`);
    });
  }
  async function unlock() {
    await task(async () => {
      if (!via) return;
      const status = await via.unlockStatus();
      if (status[0] === 1) {
        setUnlocked(true);
        notify("Keyboard is unlocked.");
        return;
      }
      const ids = new Set<string>();
      for (let i = 2; i < 32; i += 2)
        if (status[i] !== 255 && status[i + 1] !== 255)
          ids.add(`${status[i]},${status[i + 1]}`);
      setUnlockKeys(ids);
      setUnlocked(false);
      setUnlockRemaining(50);
      notify("Hold the outlined keys for 6 seconds.");
      try {
        await via.unlock(setUnlockRemaining);
        setUnlocked((await via.unlockStatus())[0] === 1);
        notify("Keyboard unlocked.");
      } finally {
        setUnlockKeys(new Set());
        setUnlockRemaining(null);
      }
    });
  }
  function chooseImport(mode: "definition" | "project") {
    importMode.current = mode;
    input.current?.click();
  }
  async function importFile(file: File) {
    await task(async () => {
      if (file.size > 2 * 1024 * 1024) throw new Error("File is too large.");
      const value = JSON.parse(await file.text());
      if (importMode.current === "definition") {
        const d = parseDefinition(value);
        let saved: Definition[] = [];
        try {
          saved = JSON.parse(
            localStorage.getItem("keystone.definitions") ?? "[]",
          );
        } catch {}
        localStorage.setItem(
          "keystone.definitions",
          JSON.stringify([
            ...saved.filter(
              (s) => s.vendorId !== d.vendorId || s.productId !== d.productId,
            ),
            d,
          ]),
        );
        if (via && via.matches(d)) {
          const p = await makeProject(via, d);
          setSessions((all) =>
            all.map((s) =>
              s.id === activeId
                ? { ...s, definitions: [d, ...s.definitions] }
                : s,
            ),
          );
          install(p, activeId!);
          notify("Definition saved.");
        } else notify("Definition saved for its next connection.");
      } else {
        if (!project || !adapter)
          throw new Error("Connect the keyboard first.");
        const p = parseProject(value);
        if (
          p.firmware !== project.firmware ||
          p.definition.vendorId !== project.definition.vendorId ||
          p.definition.productId !== project.definition.productId ||
          p.definition.name !== project.definition.name ||
          p.layers.length !== project.layers.length ||
          JSON.stringify(p.definition.matrix) !==
            JSON.stringify(project.definition.matrix)
        )
          throw new Error("This layout belongs to a different keyboard.");
        if (zmk) zmk.restoreBindings(p.bindings ?? {});
        change(() => p);
        setPage("keymap");
        notify("Layout loaded. Apply to save it to the keyboard.");
      }
    });
  }
  const undoChange = () => {
    const last = undo.at(-1);
    const p = last && {
      ...last,
      options: projectRef.current?.options ?? last.options,
    };
    if (p) {
      setProject(p);
      setUndo((u) => u.slice(0, -1));
      setSessions((all) =>
        all.map((s) => (s.id === activeId ? { ...s, project: p } : s)),
      );
    }
  };
  const resetTest = () => {
    tester.current = new KeyboardTester(prefs.threshold);
    setPressed(new Set());
    setMatrixSeen(new Set());
    tick((t) => t + 1);
  };
  return {
    page,
    setPage,
    prefs,
    setPrefs,
    sessions,
    session,
    activeId,
    available,
    connectOpen,
    setConnectOpen,
    busy,
    message,
    setMessage,
    project,
    baseline,
    layer,
    setLayer,
    selected,
    setSelected,
    category,
    setCategory,
    query,
    setQuery,
    raw,
    setRaw,
    undo,
    layoutOpen,
    setLayoutOpen,
    helpOpen,
    setHelpOpen,
    testSize,
    setTestSize,
    testEnter,
    setTestEnter,
    testBottom,
    setTestBottom,
    useConnected,
    setUseConnected,
    pressed,
    matrixPressed,
    matrixSeen,
    matrixLive,
    setMatrixLive,
    matrixStatus,
    unlockKeys,
    unlocked,
    unlockRemaining,
    tester,
    macroIndex,
    setMacroIndex,
    macroPrograms,
    expression,
    setExpression,
    timing,
    setTiming,
    fixedDelay,
    setFixedDelay,
    recording,
    setCaptured,
    input,
    adapter,
    via,
    zmk,
    niz,
    mone,
    canEdit,
    canAnalog,
    testDef,
    testOptions,
    testLayers,
    pending,
    notify,
    change,
    changeLayout,
    cancelChanges,
    task,
    stopRecording,
    makeProject,
    install,
    activate,
    addDevice,
    discover,
    connectNew,
    disconnect,
    assign,
    apply,
    loadMacros,
    switchDevice,
    chooseDefinition,
    macrosReady:
      macroLoadedFor.current === activeId &&
      macroPrograms.length === (adapter?.info.macroCount ?? 0),
    startRecording,
    saveMacro,
    unlock,
    chooseImport,
    importFile,
    undoChange,
    resetTest,
  };
}
