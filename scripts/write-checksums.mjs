import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
const directory = path.resolve(process.argv[2] ?? "release");
const files = (await fs.readdir(directory, { withFileTypes: true }))
  .filter((e) => e.isFile() && /\.(exe|dmg|zip|AppImage|deb)$/.test(e.name))
  .map((e) => e.name)
  .sort();
if (!files.length) throw Error("No installers found in " + directory);
const lines = [];
for (const file of files) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(directory, file)))
    hash.update(chunk);
  lines.push(`${hash.digest("hex")}  ${file}`);
}
await fs.writeFile(
  path.join(directory, "SHA256SUMS.txt"),
  lines.join("\n") + "\n",
);
console.log(`Checksummed ${files.length} installer(s) in ${directory}`);
