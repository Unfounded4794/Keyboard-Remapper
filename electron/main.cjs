const { app, BrowserWindow, session, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { decompressDefinition } = require("./definitions.cjs");
const fs = require("node:fs");
const crypto = require("node:crypto");
const hidIdentities = new Map();
let catalog;
function definitions(vendorId, productId, version = 13) {
  catalog ??= JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../dist/data/via-definitions.json"),
      "utf8",
    ),
  );
  const vendor = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../dist/data/vendor-definitions.json"),
      "utf8",
    ),
  );
  return [
    ...vendor.filter(
      (d) =>
        Number(d.vendorId) === vendorId && Number(d.productId) === productId,
    ),
    ...catalog.entries
      .filter(
        (e) =>
          Number(e.definition.vendorId) === vendorId &&
          Number(e.definition.productId) === productId,
      )
      .sort((a, b) =>
        version >= 11 ? b.schema - a.schema : a.schema - b.schema,
      )
      .map((e) => e.definition),
  ];
}
if (process.env.KEYSTONE_TEST_DATA)
  app.setPath("userData", process.env.KEYSTONE_TEST_DATA);
let mainWindow;
function isLocal(url) {
  return (
    url?.startsWith("file://") || url?.startsWith("http://127.0.0.1:5173/")
  );
}
app.whenReady().then(() => {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler(
    (wc, permission, origin) =>
      wc === mainWindow?.webContents &&
      isLocal(origin) &&
      ["hid", "serial"].includes(permission),
  );
  ses.setDevicePermissionHandler((details) => {
    const allowed =
      isLocal(details.origin) && ["hid", "serial"].includes(details.deviceType);
    if (allowed && details.deviceType === "hid" && details.device)
      hidIdentities.set(details.device.deviceId, details.device);
    return allowed;
  });
  ipcMain.handle("keyboard-identity", (event, vendorId, productId, name) => {
    if (event.sender !== mainWindow.webContents) throw Error("Invalid sender");
    const devices = [...hidIdentities.values()].filter(
      (d) =>
        d.vendorId === vendorId &&
        d.productId === productId &&
        (!name || d.name === name),
    );
    const serials = [
      ...new Set(
        devices
          .map((d) => d.serialNumber?.trim())
          .filter(
            (s) =>
              s &&
              s.length >= 8 &&
              !/^(0x)?(0+|f+|deadbeef|1234567890|0123456789|12345678)$/i.test(
                s,
              ),
          ),
      ),
    ];
    // Never persist a selection under a shared VID/PID or an interface GUID.
    if (serials.length !== 1) return null;
    return crypto
      .createHash("sha256")
      .update(`${vendorId}:${productId}:${serials[0]}`)
      .digest("hex");
  });
  ipcMain.handle("keyboard-identity-scan", (event) => {
    if (event.sender !== mainWindow.webContents) throw Error("Invalid sender");
    hidIdentities.clear();
  });
  ses.setPermissionRequestHandler((wc, permission, cb) =>
    cb(
      wc === mainWindow?.webContents &&
        isLocal(wc.getURL()) &&
        ["hid", "serial"].includes(permission),
    ),
  );
  async function choose(event, devices, idName, callback) {
    event.preventDefault();
    if (!devices.length) return callback("");
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "Connect a keyboard",
      message: "Choose your keyboard",
      detail:
        "Only connect the device you want to configure. Close other keyboard configuration apps first.",
      buttons: [
        ...devices.map(
          (d) =>
            (Number(d.vendorId) === 0x0483 &&
            Number(d.productId) === 0x5230 &&
            d.name === "Program"
              ? "NIZ x108"
              : undefined) ||
            d.name ||
            d.displayName ||
            definitions(Number(d.vendorId), Number(d.productId))[0]?.name ||
            d.portName ||
            `USB ${Number(d.vendorId).toString(16).padStart(4, "0")}:${Number(d.productId).toString(16).padStart(4, "0")}`,
        ),
        "Cancel",
      ],
      cancelId: devices.length,
      noLink: true,
    });
    callback(devices[response]?.[idName] || "");
  }
  ses.on("select-hid-device", (event, details, callback) =>
    choose(event, details.deviceList, "deviceId", callback),
  );
  ses.on("select-serial-port", (event, ports, wc, callback) =>
    choose(event, ports, "portId", callback),
  );
  ipcMain.handle(
    "keyboard-definitions",
    (event, vendorId, productId, version) => {
      if (
        event.sender !== mainWindow.webContents ||
        ![vendorId, productId, version].every(Number.isInteger)
      )
        throw new Error("Invalid keyboard query");
      return definitions(vendorId, productId, version);
    },
  );
  ipcMain.handle("decompress-definition", async (event, bytes) => {
    if (
      event.sender !== mainWindow.webContents ||
      !Array.isArray(bytes) ||
      bytes.length > 512 * 1024 ||
      bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)
    )
      throw new Error("Invalid definition");
    return decompressDefinition(bytes);
  });
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 980,
      minWidth: 1000,
      minHeight: 720,
      backgroundColor: "#13151a",
      title: "Keystone",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.on("app-command", (_event, command) => {
      const code = {
        "media-play-pause": "MediaPlayPause",
        "media-nexttrack": "MediaTrackNext",
        "media-previoustrack": "MediaTrackPrevious",
        "volume-mute": "AudioVolumeMute",
        "volume-up": "AudioVolumeUp",
        "volume-down": "AudioVolumeDown",
      }[command];
      if (code && mainWindow.isFocused())
        mainWindow.webContents.send("media-key", code);
    });
    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (!isLocal(url)) event.preventDefault();
    });
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
