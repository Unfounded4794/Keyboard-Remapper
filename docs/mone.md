# Besides Studio M-ONE native support

Keystone 0.8.0 discovers the wired M-ONE automatically and uses the usual Keymap, Macros and Tester views. It does not require the discontinued Windows software, a JSON import, or a special connection button. The adapter runs through WebHID in the offline desktop app; the original executable and DLLs are not distributed or loaded.

## Qualified hardware

- USB VID/PID `05AC:024F`, exact product name `M-ONE`.
- Vendor collection `FF1C:0092`, input/output report 4, 63-byte payloads.
- EVision V2 capabilities beginning `AA 55 00 00 0D AA 18`.
- Factory mapping must match the captured 510-byte M-ONE factory table. An unknown firmware variant is rejected before writing.

The USB ID is shared with unrelated keyboards. Identification requires all of the above. The 82-key ANSI physical geometry, including function-row gaps and the bottom-row blocker, was checked against the owner's original `Skin/XML/DeviceXml/keyboarddevice.xml`. Its UI uses a different numbering system; the adapter uses the firmware factory action table to map the physical keys to native slots. Hidden ISO/JIS positions, unused entries and the motor-control positions are excluded from the editor and preserved in memory.

## Protocol and preservation

These protocol facts are independently implemented from the public [ICL01 EVision V2 reference](https://github.com/lephilousophe/icl01-tools/blob/master/icl01.py) and [OpenRGB's EVision V2 controller](https://github.com/CalcProgrammer1/OpenRGB/tree/master/Controllers/EVisionKeyboardController/EVisionV2KeyboardController). No GPL implementation code is included in Keystone. The original software bundle confirms the EVision controller family. The maker's [M-ONE announcement](https://geekhack.org/index.php?topic=114039.0) documents the proprietary configurator and motorized height mechanism.

Report framing: 16-bit little-endian sum of command, length, offset, status and data; command at payload byte 2; length byte 3; 16-bit offset bytes 4–5; status byte 6; up to 56 data bytes starting at byte 7. Replies echo the request checksum, command and offset. Nonzero status, malformed replies, timeouts and disconnection stop the session.

Commands used:

| Command | Use |
| --- | --- |
| `01`, `02` | Begin/end a configuration transaction |
| `03` | Read capabilities |
| `05` | Read configuration, for preservation checks |
| `07` | Read immutable factory mappings |
| `08` | Read current mappings |
| `09` | Write only changed three-byte mapping entries |
| `14`, `15` | Read/write macro memory |

Other EVision generations assign different meanings to some of these commands. The adapter does not use them unless the complete M-ONE identity and factory map match. It sends no firmware, reset, capability-write, lighting-write or motor commands. It presents one editable map; native Fn behavior remains in firmware rather than inventing programmable QMK layers.

Remap saves compare a fresh complete keymap with the editing baseline, save a raw recovery copy under `keystone.mone-recovery`, write only changed positions, then verify the entire keymap and unchanged configuration. Macro saves preserve every unrelated macro record, reserved header fields, keymap and configuration. Macro data is read back and compared after saving. On a failed or partial transaction, reconnect before further edits; automatic rollback is not attempted.

## Macros

Select a macro, record keys or edit graphical actions, and save it. Assign that macro to a physical key from the Keymap macro palette, then Apply. Existing keyboard macros load automatically. The UI exposes at least 16 macro entries, extending to preserve existing entries if necessary; the firmware's actual shared memory is 3072 bytes, so long sequences reduce available capacity.

Keyboard keys, modifiers, chords, press/release actions and recorded/fixed timing are supported. Native events store a 16-bit wait **after** each event. No-delay actions retain a minimum 1 ms event wait, matching the owner's existing macro format. ASCII text literals and consumer/mouse macro actions are currently rejected rather than converted incorrectly. Existing unsupported macro events display as raw data and remain untouched unless their macro is explicitly replaced. Ordinary remaps include basic keys, modifiers, common media controls and native Fn. Other native mappings are preserved and displayed as native actions.

## Validation

Actual connected-board read checks recovered the complete capabilities, factory/current maps, configuration, physical map and macro memory without configuration writes. The packaged app's desktop smoke test passed automatic recognition, 82-key rendering and macro loading using reads only. All 73 unit and 33 browser tests passed, covering staged remaps, macro recording/assignment, fragmented USB transfers, zero-length write acknowledgments, byte preservation, mismatched firmware, stale baselines and failed readback.

On 2026-10-14, the owner tested Keystone 0.8.0 on the wired M-ONE and confirmed that both remapping and recorded macro playback work and remain saved after unplugging and reconnecting. This verifies those tested operations on this firmware profile; other firmware variants and unsupported native actions remain outside the qualified scope.
