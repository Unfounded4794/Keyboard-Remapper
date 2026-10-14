import type { Keycode } from "./keycodes";
const names: Record<string, [string, string]> = {
  KC_NO: ["Disabled", "Sends no keypress."],
  KC_TRNS: [
    "Pass through",
    "Use the mapping from the next active layer below this one.",
  ],
  KC_EXECUTE: [
    "Execute",
    "Send the HID Execute command; application support varies.",
  ],
  KC_AGAIN: ["Repeat action", "Ask the application to repeat its last action."],
  KC_ALTERNATE_ERASE: [
    "Alternate erase",
    "Send the HID alternate erase command; application support varies.",
  ],
  KC_LANGUAGE_1: [
    "Hangul",
    "Switch Hangul / English input on supported Korean layouts.",
  ],
  KC_LANGUAGE_2: [
    "Hanja",
    "Convert Korean input to Hanja on supported layouts.",
  ],
  KC_LANGUAGE_3: [
    "Katakana",
    "Select Katakana input on supported Japanese layouts.",
  ],
  KC_LANGUAGE_4: [
    "Hiragana",
    "Select Hiragana input on supported Japanese layouts.",
  ],
  KC_LANGUAGE_5: ["JP input", "Toggle Japanese alphanumeric / kana input."],
  KC_INTERNATIONAL_1: [
    "JP Ro",
    "Japanese Ro key; output depends on the host input layout.",
  ],
  KC_INTERNATIONAL_2: ["JP Kana", "Japanese Katakana / Hiragana key."],
  KC_INTERNATIONAL_3: ["JP Yen", "Japanese Yen / vertical bar key."],
  KC_INTERNATIONAL_4: ["JP Convert", "Japanese input conversion key."],
  KC_INTERNATIONAL_5: ["JP No convert", "Japanese non-conversion key."],
  KC_INTERNATIONAL_6: ["KP comma", "International keypad comma key."],
  QK_BOOTLOADER: [
    "Flash mode",
    "Restart the keyboard into its firmware bootloader. Normal typing stops until it restarts.",
  ],
  QK_DEBUG_TOGGLE: [
    "Debug output",
    "Toggle firmware debug logging; requires firmware support.",
  ],
  QK_CLEAR_EEPROM: [
    "Reset settings",
    "Reset persistent keyboard settings to firmware defaults.",
  ],
  QK_MAGIC_NKRO_ON: ["NKRO on", "Enable n-key rollover in firmware."],
  QK_MAGIC_NKRO_OFF: ["NKRO off", "Disable n-key rollover in firmware."],
  QK_MAGIC_TOGGLE_NKRO: ["Toggle NKRO", "Toggle n-key rollover in firmware."],
  QK_MAGIC_GUI_ON: ["Win/Cmd on", "Enable the Windows / Command / Super keys."],
  QK_MAGIC_GUI_OFF: [
    "Win/Cmd off",
    "Disable the Windows / Command / Super keys.",
  ],
  QK_MAGIC_TOGGLE_GUI: [
    "Win/Cmd lock",
    "Toggle whether Windows / Command / Super keys work.",
  ],
  QK_MAGIC_EE_HANDS_LEFT: [
    "Left half",
    "Store this split keyboard half as the left half. Requires EE_HANDS firmware.",
  ],
  QK_MAGIC_EE_HANDS_RIGHT: [
    "Right half",
    "Store this split keyboard half as the right half. Requires EE_HANDS firmware.",
  ],
};
const readable = (s: string) =>
  s
    .replace(/LALT/g, "left Alt")
    .replace(/RALT/g, "right Alt")
    .replace(/LGUI/g, "left Win/Cmd")
    .replace(/RGUI/g, "right Win/Cmd")
    .replace(/LCTL/g, "left Ctrl")
    .replace(/RCTL/g, "right Ctrl")
    .replace(/CTL|CONTROL/g, "Ctrl")
    .replace(/GUI/g, "Win/Cmd")
    .replace(/_/g, " ")
    .toLowerCase();
export function describeKey(k: Keycode): {
  label: string;
  description: string;
} {
  if (k.category === "Layers") return { label: k.label, description: k.name };
  const explicit = names[k.name];
  if (explicit) return { label: explicit[0], description: explicit[1] };
  let label = k.label,
    description = `${k.label}.`;
  if (/^KC_F\d+$/.test(k.name))
    description = `Send ${k.label}, an extended function key for application shortcuts.`;
  else if (/^KC_(LANGUAGE|INTERNATIONAL)_/.test(k.name))
    description =
      "Reserved international HID key; behavior depends on host layout and input method.";
  else if (k.name.startsWith("KC_LOCKING_")) {
    label = `Latching ${k.label.replace(/Locking /i, "").replace(/ Lock$/i, "")}`;
    description =
      "For a mechanically latching switch. Requires firmware support; use the normal lock key for ordinary switches.";
  } else if (k.name.startsWith("QK_MAGIC_")) {
    const action = k.name.slice(9),
      text = readable(action.replace(/^(UNSWAP|SWAP|TOGGLE)_/, "")).replace(
        /caps lock/g,
        "Caps Lock",
      );
    const verb = action.startsWith("UNSWAP")
      ? "Restore"
      : action.startsWith("SWAP")
        ? "Swap"
        : action.startsWith("TOGGLE")
          ? "Toggle swap"
          : "Set";
    label = `${verb} ${text}`;
    description = `${label} in keyboard firmware. Changes the keyboard's modifier behavior.`;
  } else if (k.name.startsWith("QK_MOUSE_")) {
    description = k.name.includes("ACCELERATION")
      ? `Select mouse-key speed preset ${k.name.slice(-1)}. Requires firmware mouse keys.`
      : `Use keyboard firmware to ${readable(k.name.slice(9))}. Requires mouse-key support.`;
  } else if (k.name.startsWith("QK_AUDIO"))
    description = `${k.label} for the keyboard's built-in speaker. Requires audio-capable firmware and hardware.`;
  else if (k.name.startsWith("QK_MUSIC"))
    description = `${k.label} for QMK's musical keyboard mode. Requires firmware audio support.`;
  else if (k.category === "Lighting")
    description = `${k.label.replace(/Value/g, "brightness").replace(/Flag/g, "LED zone")}. Requires matching lighting support in firmware.`;
  else if (k.category === "Platform")
    description = `Send the shortcut for ${k.label}. Host shortcuts may be customized.`;
  else description += " Host and application support determine its behavior.";
  return { label, description };
}
