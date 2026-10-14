import fs from "node:fs/promises";
import path from "node:path";
const commit = "9e3e9f4aa9f50f9439fdebc747560f51aaf109a0";
const root = path.resolve("build/via-source", `keyboards-${commit}`);
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const entries = [];
for (const version of ["src", "v3"])
  for (const file of await walk(path.join(root, version))) {
    if (!file.endsWith(".json")) continue;
    const d = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      !d.matrix ||
      !d.layouts?.keymap ||
      d.vendorId === undefined ||
      d.productId === undefined
    )
      continue;
    entries.push({
      schema: version === "v3" ? 3 : 2,
      path: path.relative(root, file).replaceAll("\\", "/"),
      definition: {
        name: d.name,
        vendorId:
          typeof d.vendorId === "string"
            ? parseInt(d.vendorId.replace(/^0x/i, ""), 16)
            : d.vendorId,
        productId:
          typeof d.productId === "string"
            ? parseInt(d.productId.replace(/^0x/i, ""), 16)
            : d.productId,
        matrix: d.matrix,
        layouts: d.layouts,
        customKeycodes: d.customKeycodes,
        keystone: d.keystone,
      },
    });
  }
const data = {
  source: "https://github.com/the-via/keyboards",
  commit,
  license: "GPL-3.0",
  count: entries.length,
  entries,
};
await fs.mkdir("public/data", { recursive: true });
await fs.writeFile("public/data/via-definitions.json", JSON.stringify(data));
await fs.copyFile(path.join(root, "LICENSE"), "public/data/VIA-LICENSE.txt");
await fs.writeFile(
  "public/data/VIA-SOURCE.txt",
  `VIA keyboard definitions\nSource: ${data.source}\nSnapshot: ${commit}\nLicense: GPL-3.0 (see VIA-LICENSE.txt)\nDefinitions are redistributed without changes to their geometry, matrix or layout options. Run scripts/bundle-definitions.mjs against the pinned source archive to regenerate the catalog.\n`,
);
console.log(
  `Bundled ${entries.length} definitions, ${(JSON.stringify(data).length / 1048576).toFixed(1)} MiB.`,
);
