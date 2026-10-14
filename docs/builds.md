# Desktop builds

Keystone's native installers include the app and offline keyboard database. Internet access and Node.js are not required to use an installed build.

| Computer | Build | Files |
| --- | --- | --- |
| Mac with Apple Silicon | mac-arm64 | `Keystone-0.8.0-mac-arm64.dmg`, `.zip` |
| Mac with Intel processor | mac-x64 | `Keystone-0.8.0-mac-x64.dmg`, `.zip` |
| Linux with Intel/AMD 64-bit processor | linux-x64 | `Keystone-0.8.0-linux-x86_64.AppImage`, `Keystone-0.8.0-linux-amd64.deb` |
| Linux with ARM64 processor | linux-arm64 | `Keystone-0.8.0-linux-arm64.AppImage`, `.deb` |

The [Build desktop applications workflow](https://github.com/Unfounded4794/Keyboard-Remapper/actions/workflows/build.yml) uploads an artifact for each OS/architecture. Open a successful run and download the corresponding `keystone-…` artifact. Artifacts are retained for 30 days; private-repository downloads require GitHub access. The artifact's `SHA256SUMS.txt` contains hashes of its installers. Builds are never automatically published as GitHub releases.

## Installation

On macOS, open the DMG and drag Keystone into Applications, or unzip the ZIP and move Keystone.app into Applications. The app is ad-hoc signed for local execution; it is not Developer ID signed or Apple-notarized. macOS may require allowing this app in System Settings → Privacy & Security after the first attempted launch. These builds target the macOS versions supported by the bundled Electron runtime. No Mac keyboard hardware validation is claimed from a successful build alone.

On Linux, make the AppImage executable and run it:

```sh
chmod +x Keystone-0.8.0-linux-x86_64.AppImage
./Keystone-0.8.0-linux-x86_64.AppImage
```

For Debian/Ubuntu, install the matching `.deb` using your package manager, for example:

```sh
sudo apt install ./Keystone-0.8.0-linux-amd64.deb
```

Use the `arm64` filename on ARM64 Linux. AppImage execution may require your distribution's FUSE compatibility package. If USB keyboards cannot be opened, configure the [vendor/product-scoped HID permissions](linux-permissions.md) and reconnect the device. Run Keystone as your normal user. Launch checks do not replace Linux keyboard hardware validation.

## Build from source

Use Node.js 22.12 or newer and install dependencies with `npm ci`. On the corresponding native host:

```sh
# Linux x64 and ARM64 AppImage/deb packages
npm run dist:linux

# macOS Intel and Apple Silicon DMG/ZIP packages (requires a Mac)
npm run dist:mac
```

To build just one architecture:

```sh
npm run dist -- --linux --x64
npm run dist -- --mac --arm64
```

CI uses separate native runners for Windows x64, macOS x64, macOS ARM64, Linux x64 and Linux ARM64. Each runs unit and browser tests, builds with publishing disabled, verifies the packaged executable's version and architecture, checks that the GUI and offline catalog load, and writes SHA-256 checksums. No USB configuration writes are part of this launch check. Apple Developer signing/notarization is not configured for these builds.

On 2026-10-14, all four macOS/Linux jobs in [build run 38521691194](https://github.com/Unfounded4794/Keyboard-Remapper/actions/runs/38521691194) passed 73 unit tests, 33 browser tests, packaging and native packaged-app launch checks. The runtime confirmed version 0.8.0, the expected CPU architecture, available HID/serial APIs, renderer isolation and the bundled offline catalog. These results establish packaging and startup, not physical keyboard compatibility on those operating systems.
