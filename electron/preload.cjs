const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("keystone", {
  desktop: true,
  beginIdentityScan: () => ipcRenderer.invoke("keyboard-identity-scan"),
  keyboardIdentity: (vendorId, productId, name) =>
    ipcRenderer.invoke("keyboard-identity", vendorId, productId, name),
  onMediaKey: (callback) => {
    const receive = (_event, code) => callback(code);
    ipcRenderer.on("media-key", receive);
    return () => ipcRenderer.removeListener("media-key", receive);
  },
  decompress: (bytes) => ipcRenderer.invoke("decompress-definition", bytes),
  definitions: (vendorId, productId, version) =>
    ipcRenderer.invoke("keyboard-definitions", vendorId, productId, version),
});
