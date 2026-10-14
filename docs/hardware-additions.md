# Version 0.5 hardware additions

## Version 0.6: vendor catalog and shared identities

The supplemental offline catalog now holds 116 unique vendor PCB definitions, collected from public manufacturer and authorized-distributor download pages. They supplement the existing 3,513-entry VIA snapshot. Counts are definitions/PCB variants, not distinct keyboard models or hardware certifications. Exact file URLs, hashes, retrieval date, unavailable links and source pages are in `public/data/vendor-sources.json`. Reproduce the download inventory with `scripts/collect-vendor-definitions.mjs`, then bundle with `scripts/bundle-vendor-definitions.mjs`. Downloaded executables and firmware are never run or flashed by this process; ZIP archives are inspected for JSON only.

Coverage includes Createkeebs Glacier80, Thera75/V2 and High65 V2; related Luminkey Nova/KINE/65/75/LX60/80/MK2 files; Meletrix Zoom65 generations, Zoom75/TIGA, ZoomTKL/DYNA, Zoom98, ZoomPad/TIGA and Zoom64; Qwertykeys QK60/65/65V2/75/80/100/Cub65 and Neo families; Owlab Jelly Epoch/Evolv, Mr. Suit, Spring, Link, Vento80 and Chalice; Wind X/R2, X65, X98, X80 and Sin65; Wuque NAMA75, DK60, Mammoth75/20 wireless, Freya, Paper65/80, Vany and Ginkgo65 Pro; and the NIZ x87 VIA files found in NIZ's official download folders. Existing VIA definitions and self-describing Vial firmware remain available. A JSON file does not add VIA support to a proprietary-only firmware revision, nor does it add firmware features such as HE calibration. Remaining NIZ/proprietary models require testing with the actual connected board.

The current Glacier80 reports `FEED:6060` and generic product name `keyboard`, identical to Thera75/V2 and several Wind boards. The main VIA catalog's Glacier80 uses `0410:6060`; the vendor's [CK80 VIA3 definition](https://drive.google.com/file/d/1yGsgCSfzXpQb8z83CVQDdRI2TPMHCOxK/view), linked from its [Glacier80 folder](https://drive.google.com/drive/folders/1it3rVRHVNjkBVmKcB34QaVINyLwuyR-h), supplies the actual FEED variant. Both identities stay supported. The vendor's common hotswap/solder definition retains ISO, split Shift and bottom-row options. Read-only verification on the connected hotswap board loaded its 6×17 matrix, 87 visible keys in the active layout, four layers and 16 macro entries. The unconnected solder PCB's definition is validated structurally, not claimed as hardware-tested.

Multiple matching definitions no longer select the first file under a generic USB product name. Keymap reads/editing wait for **Choose keyboard / PCB**. Exact product-name matches and a single candidate can connect directly. A choice persists only with a verified unique, non-placeholder USB serial (stored as a SHA-256 hash), never under VID/PID alone or a browser-generated GUID. Devices without a usable unique serial require a PCB choice when connecting; that prevents a later Glacier80 from inheriting a Thera selection. Definition IDs stay stable when theme identities are captured. Settings can change the selected PCB and updates the connected keyboard name.

The Createkeebs legacy download page and its Ace 6.5/Venice folders currently return 404 to direct requests. The still-public Glacier/Thera folders remain available. Other broken vendor links are retained in the source report; missing definitions are not invented.

## Wind Studio X R1 wired hotswap

The original Wind X definition is bundled in version 0.6.0 as **Wind X R1**. Source: Wind Studio's [official download index](https://windstudio.store/pages/download) and its [windx-via.json](https://drive.google.com/file/d/1MCzelWjKFY0cW-c56TTqbzf8358jsSiP/view). The connected wired hotswap board reports generic `keyboard`, USB `FEED:6060`, so it requires the model/PCB choice rather than inheriting the Glacier80 or Thera definition.

Read-only packaged-app verification on October 13, 2026 loaded the 5×18 matrix, 83 visible keys, four layers and 16 macro entries. Visual inspection confirmed the original Wind X layout with right-side numpad and its existing readable key assignments. The smoke script captures `artifacts/wind-x-r1-keymap-v6.png` and checks the visible key count. No keyboard mappings or macros were written; individual physical switch presses and write persistence have not been tested. Wind X R2 variants, X65 hotswap/solder, X98 wired, X80 and Sin65 files are also bundled; they are separate PCB choices, not hardware-tested by this check.

## Createkeebs Thera75 V2

Sources: [Createkeebs download page](https://createkeebs.com/blogs/news/keyboard-firmware-download), its linked [Thera75 V2 firmware folder](https://drive.google.com/drive/folders/1czYcobzRjg3ATJf6tEjQYnf8a4uOUkxg), [hotswap definition](https://drive.google.com/file/d/1zMevWxP183wstT3uLo9_I74bgC1Oo95e/view), [solder definition](https://drive.google.com/file/d/1zMSZYPW8oc3mTrblSMSmDhM6D1TVMV3M/view). Retrieved October 13, 2026. Original definitions by Createkeebs.

Both definitions use FEED:6060, a 6×15 matrix, and the vendor's key geometry. Hotswap is the default; Solder can be selected in Settings. Product names have been clarified. Added Keystone encoder metadata identifies push at 0,14 and the vendor's left/right virtual turn cells at 5,13/5,14. These cells keep standard matrix read/write commands, rather than assuming a newer encoder-map firmware. No firmware is flashed. IDs alone cannot distinguish PCB variants or unrelated boards using the same generic identifiers.

## Pikatea Macropad GB3 and encoder protocols

Read the actual connected board's Vial 4 embedded definition: eight switch cells, with two additional legends at 0,0 and 0,1 marked `e` in legend 9. These are encoder index/direction, not duplicate switch coordinates. The GB3 push is the final switch, 0,7. Its serialized `{x:1}` KLE property is parsed as spacing, eliminating the phantom second row. The original definition is supplied by firmware; no keyboard-specific download is necessary.

Vial encoder get/set uses prefix FE, operations 03/04, and verifies both direction bindings independently. [Vial firmware implementation](https://github.com/vial-kb/vial-qmk/blob/vial/quantum/vial.c), [command IDs](https://github.com/vial-kb/vial-qmk/blob/vial/quantum/vial.h). VIA encoder-map firmware uses commands 14/15 with layer/index/direction, with readback verification. [VIA API](https://github.com/the-via/app/blob/master/src/utils/keyboard-api.ts), [VIA layout conventions](https://www.caniusevia.com/docs/layouts/). Modern VIA `e0`/`e1` center labels are supported. Legacy VIA `e` push labels remain matrix switches; they are not guessed to be turn bindings.

Unlock reads the firmware status first, polls the hardware countdown, and reads status again before showing completion. Focus changes refresh the displayed lock state. [Vial unlock implementation](https://github.com/vial-kb/vial-qmk/blob/vial/quantum/vial.c).

## Media observation

Standard consumer KeyboardEvent codes map to QMK media keycodes. Windows Electron `app-command` events are bridged only while the app is focused. They have no release timestamp, so the app shows a short visual pulse and records an observation without adding clean cycles, chatter intervals, or rollover holds. DOM/native duplicate events within 100 ms are suppressed. Physical matrix highlighting is available in both Keymap and Tester when firmware exposes it. Its snapshots may miss short transitions and do not substitute for switch timing measurements.

Validation uses simulated hardware for writes and unlock sequences. Read-only desktop checks on the connected ISOlation, Pikatea GB3 and Thera75 V2 confirm layout, encoder and macro-memory reads. No connected keyboard mappings or macros were changed during validation.
