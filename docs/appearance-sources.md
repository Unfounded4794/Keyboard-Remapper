# Reference themes and key identities

Version 0.4 replaces the broad palette guesses with profiles based on the user's **20 files in `reference images/`**. Hero is included. Sound Waves is renamed **GMK Wavez**; existing Sound Waves preferences migrate automatically.

The main assembled/base-kit arrangement in each picture determines the default. Optional accent kits pictured underneath are not mixed into that arrangement. Cap faces and legend colors are separate. The images contain lighting, shadows and render shading, so the flat UI colors remain screen approximations; novelty artwork and secondary glyphs are not reproduced.

| Reference | Key assignments |
| --- | --- |
| gateway.webp | White alphas, orange left-side letter legends/modifiers, blue right-side legends/modifiers; blue main Enter, orange numpad Enter and arrows; distinct F-key groups |
| midnight rainbow.webp | Black caps with explicit rainbow legend assignments; numpad 0 orange, number-row 0 blue; green arrows |
| awakens.jpg | Charcoal caps, gold alpha legends, pale cyan modifier legends, red Escape/Enter/arrow legends |
| reforged.webp | Burnt-orange alphas, dark slate modifiers, cream Escape/Enter |
| mictlan.webp | Black caps, individual multicolor legends, orange main Enter; pink/orange/purple/yellow arrow caps |
| lazurite.png | Blue alphas, light gray modifiers, matching function groups; light Enter and Escape |
| great wave.webp | Explicit diagonal navy/blue/cyan/aqua/white key assignments, rather than a screen-row gradient |
| half blade.webp | Navy alphas, dark modifiers, red legends and red Escape/Enter |
| donuts.jpg | Chocolate alphas with individual sprinkle-colored primary legends, cream modifiers and arrows |
| mizu.avif | Pale blue alphas, navy modifiers, white Escape/Enter/arrows |
| stone age.webp | Light gray alphas, green modifiers, beige Escape/Enter |
| red samurai.jpg | Burgundy alphas, charcoal modifiers, gold legends and Escape/Enter caps |
| hammerhead.png | Dark navy alphas, slate modifiers, turquoise legends and Escape/Enter caps |
| deku.jpg | Teal alphas, cream modifiers, red Escape/Enter/arrows |
| mecha 01.webp | Purple alphas, black modifiers, green Escape/spacebar and gold Enter/arrow legends |
| basin.webp | Blue-to-charcoal key groups, teal alpha legends, dark modifiers with light legends, teal Escape/Enter |
| black panther.webp | Purple alphas and spacebar, charcoal modifiers, alternating purple/charcoal function groups |
| fuji.webp | Light alphas, slate-lilac modifiers, pink Escape/Enter |
| wavez.webp | Deep teal alphas, dark slate modifiers, bright green legends |
| hero.avif | Green alphas, charcoal modifiers/function row, tan legends and tan Escape/Enter/arrows |

Assignments are stored by **USB key identity**, not x/y position. Keypad identities differ from number-row identities. Moving a numpad left, changing layout options, or selecting another layer does not reassign its colors. For connected VIA definitions, the initial base bindings identify caps; common edge keys such as an already-remapped Caps position are recognized from neighboring keys. The captured identities are remembered locally and survive remap saves. Unidentifiable custom keys use a conservative role fallback; the app cannot infer an arbitrary printed cap from a matrix address alone. These identity hints never write firmware.

The same key-color resolver is used in the remapping palette. The other existing palettes, including Terror Below (no new reference supplied), are unchanged. The theme dropdown keeps all 29 choices compact. `scripts/preview-themes.mjs` renders the reference profiles to `artifacts/themes-v4/` for visual review.

## Language legends

Language choices change **unshifted key legends**, including the remapping palette, while preserving HID usages and matrix coordinates. They do not change the operating system's input layout. Available languages are English US/UK, German, Hungarian, French, Spanish, Italian and Swedish. ANSI/ISO and bottom-row choices remain separate physical view options.

Mappings were checked against [QMK's locale keycode aliases](https://github.com/qmk/qmk_firmware/tree/master/quantum/keymap_extras), including [Hungarian](https://github.com/qmk/qmk_firmware/blob/master/quantum/keymap_extras/keymap_hungarian.h), [German](https://github.com/qmk/qmk_firmware/blob/master/quantum/keymap_extras/keymap_german.h) and [French](https://github.com/qmk/qmk_firmware/blob/master/quantum/keymap_extras/keymap_french.h). The app does not bundle those headers.
