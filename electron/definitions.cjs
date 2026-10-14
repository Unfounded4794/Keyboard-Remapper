const lzma = require("lzma");
const { XzReadableStream } = require("xz-decompress");
async function decompressDefinition(bytes) {
  if (
    !Array.isArray(bytes) ||
    bytes.length < 13 ||
    bytes.length > 512 * 1024 ||
    bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)
  )
    throw new Error("Invalid compressed definition");
  if (bytes.slice(0, 6).join(",") === "253,55,122,88,90,0") {
    const reader = new XzReadableStream(
      new Blob([Uint8Array.from(bytes)]).stream(),
    ).getReader();
    const parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024)
          throw new Error("Keyboard definition exceeds 2 MiB");
        parts.push(Buffer.from(value));
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    return Buffer.concat(parts).toString("utf8");
  }
  let size = 0n;
  for (let i = 12; i >= 5; i--) size = (size << 8n) | BigInt(bytes[i]);
  if (size > 2n * 1024n * 1024n)
    throw new Error("Keyboard definition exceeds 2 MiB");
  return new Promise((resolve, reject) =>
    lzma.decompress(bytes, (value, error) =>
      error
        ? reject(new Error(String(error)))
        : resolve(
            typeof value === "string"
              ? value
              : Buffer.from(value).toString("utf8"),
          ),
    ),
  );
}
module.exports = { decompressDefinition };
