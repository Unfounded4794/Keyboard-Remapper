# Keystone 0.8.0

Offline desktop keyboard configuration for VIA, Vial, USB ZMK Studio, the supported NIZ x108 firmware and the wired Besides Studio M-ONE.

## Run

Use `release/0.8.0/Keystone 0.8.0.exe` for the Windows portable build, or `release/0.8.0/Keystone Setup 0.8.0.exe` to install. These builds are unsigned. Source builds require Node.js 22.12+:

```sh
npm ci
npm run desktop
```

Dependencies download during installation/building. The packaged app needs no account, web server or internet connection.

## Device connection

- The app discovers available VIA/Vial raw HID devices and the supported NIZ and M-ONE interfaces, and lists connected boards by name. Use the keyboard selector to switch between multiple boards. **Add keyboard** opens the USB keyboard or ZMK Studio connection picker when needed.
- A pinned snapshot of **3,513 official VIA definitions** is bundled offline, including SP-111 and SP-111 V2. An additional 116 vendor PCB definitions cover available Createkeebs/Luminkey, Meletrix, Qwertykeys/Neo, Owlab, Wind Studio, Wuque Studio and NIZ x87 files. See [hardware coverage and sources](docs/hardware-additions.md). Matching uses USB vendor/product IDs. Where several definitions share an identity, select the appropriate definition in Settings.
- Different boards can share a VID/PID and generic USB name. In that case select **Choose keyboard / PCB** before editing. Choices are remembered only when a unique USB serial identifies the actual device; generic IDs never carry a Thera selection over to a Glacier80.
- Vial supplies its compressed definition from firmware. ZMK Studio supplies physical geometry and behavior metadata over USB serial.
- For an unlisted VIA board, use **Settings → Custom definition → Add JSON** once. Its definition is retained for future connections. This does not require a network request.
- Close other configurators before connecting. Simultaneous clients can interfere with keyboard responses.

Without a supported keyboard connected, remapping and macros are disabled. The tester remains available with a full-size default layout. Actuation appears only when the connected board has a matching analog profile whose controls can be read.

## Keymap

Select a key, choose a keycode, then **Apply**. Changes are written to firmware and read back to verify them. **Cancel** discards pending mappings on every layer. Clicking the selected key again clears the selection. Layer count comes from firmware. Layer actions include MO, TG, TO, DF, OSL, TT and PDF where supported, plus layer/tap-key and layer/modifier composers. Hover descriptions explain special functions.

**Layout** chooses the physical arrangement immediately; click outside or press Esc to close it. These view choices are remembered locally per keyboard and never require Apply. The app initially reads firmware layout metadata, but does not write layout-option callbacks when you change the view. Boards that use those firmware callbacks for additional behavior may still require their dedicated configurator. Cancel and Undo affect remaps, not physical view choices.

The language selector beside the device selector changes unshifted legends and the key palette for US/UK English, German, Hungarian, French, Spanish, Italian or Swedish. Match it to your OS input layout; it does not change the OS language or firmware keycodes.

**Key highlight source** selects host key events or physical matrix switches. Host events follow the keycodes emitted by remaps. Matrix highlighting also works for keys that emit macros or layer actions, if firmware exposes matrix data. The app reports incoming matrix data, and falls back to host events with an explanation if keypresses arrive but firmware returns only zeros. Some boards require unlocking or firmware matrix-test support.

The key palette contains larger square keys, basic/media/layer/macro options, expanded special functions, lighting keycodes, and platform shortcuts. Hover effects and active controls use the selected theme. Firmware must support the assigned function; a numeric keycode cannot add a disabled firmware feature.

KLE alternate options are aligned with their base-layout pivots. ISO Enter and other two-rectangle shapes retain their secondary geometry. Matrix coordinates remain unchanged.

**Settings → Save layout to file** exports the connected board's keymap, physical definition, layout options and analog settings as JSON. **Load layout from file** stages matching keymap changes for Apply. This is a file backup, not an on-keyboard profile selector. No profile library or disconnected editing workspace is shown. Macro memory is edited separately on the keyboard.

## Macros

The visual sequence shows keycaps, press/release arrows, text and delays. Select an action to change keys, build a combination, edit timing, move or delete it. The original expression stays editable below; unsupported firmware actions are preserved.

Open **Macros**, select **Macro 1**, **Macro 2**, etc., then type text or press **Record**. Press **Stop** or **Esc** to finish. Losing app focus also stops recording and releases held keys in the recording.

Recording timing modes:

- **Recorded:** retain the time between recorded events.
- **No delay:** omit timing.
- **Fixed delay:** use the chosen millisecond delay between events.

Timing can be changed after recording. **Save to keyboard** writes the selected macro and verifies it. Existing macros are read from keyboard memory; other macros are preserved. No separate local macro library or upload step is required. The firmware's total memory limit still applies and is reported only if a save cannot fit.

VIA-style expressions are supported: `Hello`, `{KC_A}`, `{KC_LCTL,KC_C}`, `{+KC_LCTL}`, `{-KC_LCTL}`, `{100}`. Escape a literal opening brace with `\{`. Macro text is ASCII; recorded physical keys follow the host's language layout. Unknown Vial extended actions are retained as raw expressions. Legacy VIA firmware cannot save delays.

ZMK Studio can assign macro behaviors already compiled into firmware. Creating new ZMK macros still requires a firmware update; the app does not pretend those definitions can be uploaded dynamically.

NIZ x108 firmware `X108EC(S);V1.0.22` uses the same Keymap/Macros/Tester views through its native USB protocol. Its 108 keys and two layers are built in; no JSON import or additional connection button is needed. **Base** is layer 0; **Fn** is layer 1, active while holding Right Fn. NIZ macros belong to keys: select the key and layer in the macro dropdown, then record or edit graphical key actions and save. Timing supports recorded, none and fixed delays, with a 3 ms minimum report interval and a 65535 ms maximum between events. “No delay” still observes that minimum so press/release reports reach the host. Text literals are not supported by this adapter; use key actions. Existing non-default playback modes remain opaque and are preserved until explicitly replaced. NIZ saves require a complete configuration stream, so the adapter preserves untouched records, checks that the live baseline has not changed, stores a raw recovery copy locally, and verifies the complete readback. Reads have been checked on the actual connected x108. The owner confirmed ordinary remapping and Ctrl+V macro playback in 0.7.1; broader write cases remain covered by simulated tests. Use the keyboard's **M** key to enable its programmable mode for custom mappings. Other NIZ firmware/USB variants need separate qualification. See [NIZ protocol notes](docs/niz-x108.md).

The wired Besides Studio M-ONE uses its native EVision V2 USB protocol with built-in 82-key geometry. Remap keys normally, or record and save a macro, then assign its Macro button to a physical key and Apply. Its identity and factory map are checked before allowing writes; unrelated entries and motor controls are preserved. The adapter exposes one editable map and does not alter the motor mechanism. The owner confirmed remapping, recorded macro playback and persistence after reconnecting in Keystone 0.8.0. See [M-ONE protocol notes](docs/mone.md).

VIA and Vial encoder turn bindings use their respective encoder protocols and verify writes. Encoder push remains a normal matrix switch. The Pikatea GB3 helper row is shown as turn controls; Thera75 V2 turns retain its firmware’s virtual matrix coordinates. Vial unlock state is read from the board, with a live hold countdown and verified completion.

## Tester

Selecting **Tester** begins capturing immediately while the app has focus. Reset clears the session. Choose the recognized board or a manual 100%, TKL, 75%, 65% or 60% layout, with ANSI/ISO and standard/Tsangan bottom-row options for manual layouts.

Media events are recognized where the OS exposes them. Windows app commands provide a brief highlight and an observed press, without inventing release timings or good/chatter cycles. For remapped media, macro, and layer switches, select **Physical switch highlights** in Keymap or Tester. Matrix scanning may miss very short presses; chatter and good-cycle measurements continue to use key events.

Key states are shown directly on each key:

| State | Color | Evidence |
| --- | --- | --- |
| Untested | Theme key color | No press observed |
| Observed | Amber | Some completed presses |
| Good | Green, check mark | Configured number of completed presses without detected chatter |
| Held | Neutral gray | Currently pressed |
| Suspected chatter | Red, exclamation mark | Re-press inside the configured release threshold |

Good defaults to **300 consecutive clean completed cycles**, an app screening target rather than certification. A suspected key can recover to Good after a new clean run reaches the threshold; another suspect resets that run. Historical counts remain in the session report. Recent press chips alternate colors with stable sequence numbers, including after the rolling window advances. Fast intentional taps can be flagged. Untested is not a dead-switch diagnosis. Duplicate output keycodes and shortcuts consumed by firmware/OS cannot always be distinguished. OS key-repeat is ignored. The rollover figure is the observed simultaneous-key maximum, not proof of unlimited NKRO. Suspect events absent from the visible layout appear as red chips marked “outside this layout.”

**USB polling** analyzes imported USB report timestamps offline, with cadence, median/p95 intervals, range and a histogram. It does not capture live USB transfers or infer polling from typing speed. Key-event timing is shown separately. See [tester evidence and capture formats](docs/tester-evidence.md) for the researched default, limitations and import instructions.

## Appearance

Settings includes dark/light modes, Windows/macOS/Linux modifier labels, and a compact **Color theme** dropdown with 29 choices. The 20 supplied reference images define key-specific cap and legend colors, including Hero and Wavez (renamed from Sound Waves). Color assignments use captured key identities, not screen positions: a left-side numpad retains its keypad colors. Physical cap identities are remembered when mappings are edited or saved. Great Wave follows the pictured diagonal key assignments; function groups, main/numpad Enter and individual rainbow legends follow their references. Binary physical layout choices use toggle switches. See [palettes and language references](docs/appearance-sources.md). Preferences are stored locally.

## Compatibility boundaries

| Interface | Implemented |
| --- | --- |
| VIA protocols 9–13 | Verified keymap writes, layers, physical layout views, macro editing |
| Vial protocols 1–6 | VIA features, embedded XZ/LZMA definition, physical unlock, separate macro encoding |
| ZMK Studio USB | Physical layout, basic/consumer keys, existing behavior parameters, persistent save |
| NIZ x108 EC(S) 1.0.22, USB 0483:5230 | Native detection, 108-key layout, two layers, per-key macro editor; hardware reads and simulated writes verified |
| HE/TMR VIA custom channels | Profile-defined global actuation/rapid-trigger controls with range validation and readback |

There is no universal configuration protocol for proprietary HE/TMR keyboards. Other proprietary vendor protocols, per-key analog calibration, ZMK BLE, firmware compiling/flashing, Vial combos/tap dance and live USB capture are not implemented. A catalog match is not a claim that every optional firmware feature has been tested on physical hardware.

See [analog profiles](docs/analog-profiles.md) and [Linux permissions](docs/linux-permissions.md). Windows/macOS use system HID/serial interfaces; Linux may require vendor-scoped hidraw permissions and the serial device's group. Do not replace the normal keyboard driver or run the app as root.

## Verify and build

```sh
npm test
npm exec playwright -- install chromium
npm run test:ui
npm run build
npm run test:desktop
npm run dist
```

Build macOS releases on macOS and Linux releases on Linux. CI includes all three host platforms. Windows packaging, desktop launch, device switching, keymap reads and macro reads have been locally validated, including physical SP-111 V2, Pikatea Macropad GB3 and ISOlation boards. Firmware-write tests use simulated devices; the hardware checks did not change mappings or macros. macOS/Linux hardware validation remains necessary.

The bundled VIA catalog is GPL-3.0 data from [the-via/keyboards](https://github.com/the-via/keyboards), snapshot `9e3e9f4aa9f50f9439fdebc747560f51aaf109a0`. Its license and source information are included under `public/data/` and in the packaged app. To regenerate, extract that source snapshot into `build/via-source/keyboards-<commit>` and run `node scripts/bundle-definitions.mjs`. Application code remains under the root MIT license. Protocol references: [QMK VIA](https://github.com/qmk/qmk_firmware/blob/master/quantum/via.h), [VIA reader](https://github.com/the-via/reader), [Vial](https://github.com/vial-kb/vial-qmk) and [ZMK Studio](https://zmk.dev/docs/features/studio).

## Tab shortcuts

Defaults: Ctrl+1 Keymap, Ctrl+2 Macros, Ctrl+3 Tester, Ctrl+, Settings (Cmd on macOS). Change them in Settings → Tab shortcuts. They are local to the focused app, skip text inputs and recording, and cannot duplicate another tab shortcut.

Theme dropdown entries include live palette swatches; Classic follows light/dark mode. The keyboard case follows appearance mode and held highlights use neutral gray.
