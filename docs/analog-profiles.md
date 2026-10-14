# Magnetic board profiles

HE and TMR describe the switch sensor, not a shared configuration protocol. Many commercial boards use proprietary HID commands, authentication, calibration data, or a different report format. Keystone currently supports **global scalar controls exposed through documented VIA custom channels**. It does not implement proprietary vendor adapters or per-key analog calibration.

Add a `keystone` extension to an exact VIA/Vial definition, as demonstrated in `examples/analog-profile.example.json`. Use `sensor: "HE"` or `"TMR"`. Supply the correct vendor/product IDs and geometry from the manufacturer. The example channel/value IDs are illustrative and are **not commands for any retail keyboard**.

Each control supplies a unique `id`, display `label`, `min`, `max`, `step`, `unit`, `default`, `channel`, `valueId`, positive `scale`, and `bytes` (1 or 2). The firmware integer is `round(displayValue * scale)`. Two-byte values use big-endian encoding. Controls spanning 0–1 with step 1 are rendered as toggles. Others are sliders. These are global controls, so commands do not include matrix coordinates.

| Operation | Report prefix |
| --- | --- |
| Read | `08 channel valueId` |
| Write | `07 channel valueId encodedValue…` |
| Persist (when `save` is true) | `09 channel` |

Reports are padded to 32 bytes and use the board's VIA raw HID collection. Read response data starts at byte 3. Controls are read on connection and verified after writing. Imported values are range-checked before device writes. Tuning can change device RAM before all controls complete; if an error occurs, read the keyboard again to inspect the actual settings.

Do not treat successful HID enumeration as evidence of analog support. A board with an undocumented or incompatible protocol needs a new adapter under `src/protocols/`, packet fixtures, simulated tests and actual device validation. Profiles do not run JavaScript, shell commands, or downloaded code.
