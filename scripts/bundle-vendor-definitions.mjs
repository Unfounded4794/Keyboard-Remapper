import fs from "node:fs";
import crypto from "node:crypto";
const collected = JSON.parse(
  fs.readFileSync("build/vendor-sources/collected.json", "utf8"),
);
const prior = JSON.parse(
  fs.readFileSync("public/data/vendor-definitions.json", "utf8"),
);
const sha = (x) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const usb = (v) =>
  typeof v === "string" ? parseInt(v.replace(/^0x/i, ""), 16) : v;
const entries = [],
  provenance = [],
  seen = new Map();
function insert(d, source) {
  d = structuredClone(d);
  d.vendorId = usb(d.vendorId);
  d.productId = usb(d.productId);
  // Geometry and matrix identity deduplicate V2/V3 copies without losing PCB variants.
  const signature = sha([d.vendorId, d.productId, d.matrix, d.layouts, d.keys]);
  if (seen.has(signature)) {
    provenance[seen.get(signature)].sources.push(source);
    return;
  }
  seen.set(signature, entries.length);
  entries.push(d);
  provenance.push({
    name: d.name,
    vendorId: d.vendorId,
    productId: d.productId,
    sources: [source],
  });
}
for (const d of prior.filter((d) =>
  d.name.startsWith("Createkeebs Thera75 V2"),
))
  insert(d, {
    page: "https://createkeebs.com/blogs/news/keyboard-firmware-download",
    note: "Preserved verified Thera75 V2 encoder metadata from 0.5.0.",
  });
for (const { definition, source } of collected) {
  const d = structuredClone(definition),
    raw = String(d.name).trim(),
    urlName = decodeURIComponent(source.url.split("/").at(-1).split("?")[0]),
    file = source.label + "." + urlName;
  if (source.brand === "Createkeebs") {
    if (/theraV2/i.test(raw)) continue;
    d.name = /CK80/i.test(raw)
      ? "Createkeebs Glacier80 (Hotswap / Solder)"
      : /^thera-via$/i.test(raw)
        ? "Createkeebs Thera75"
        : `Createkeebs ${raw}`;
  } else if (source.brand.includes("Luminkey")) {
    const name = raw
      .replace(/^LK[_ -]?/i, "")
      .replace(/^luminkey\s*/i, "")
      .trim();
    d.name = `Luminkey ${name}`;
    if (/2\.4G/i.test(file)) d.name += " (2.4G)";
    else if (/USB/i.test(file)) d.name += " (USB)";
    if (/Hot.Swap/i.test(file)) d.name += " (Hotswap)";
    else if (/Solder|_hj/i.test(file)) d.name += " (Solder)";
  } else if (source.brand === "Wind Studio") {
    const names = {
      winxR2via: "Wind X R2 (Wired Hotswap)",
      winx98via: "Wind X98 (Wired)",
      winx65rVia: "Wind X65 (Hotswap)",
      "winx65r-via": "Wind X65 (Hotswap)",
      "winx65h-via": "Wind X65 (Solder)",
      winxvia: "Wind X R1",
    };
    d.name = names[raw] ?? `Wind Studio ${raw}`;
    if (raw === "xr2")
      d.name = `Wind X R2 (${source.label.replace(/\s*(via)?\.json.*$/i, "").trim()})`;
    if (raw === "sin65")
      d.name = `Wind Sin65 (${file.includes("universal") ? "Universal" : "Wired"})`;
  } else if (source.brand === "NIZ") {
    d.name = `NIZ x87 VIA (${file.includes("2023-09") ? "2023-09" : file.includes("20230215") ? "2023-02" : "V1.3"})`;
  } else if (source.brand.includes("Meletrix")) {
    d.name = `Meletrix ${raw.replace(/^zoom65 3v$/i, "Zoom65 V3").replace(/^PAD TIGA$/i, "ZoomPad TIGA")}`;
    if (/Zoom65 V3/i.test(d.name))
      d.name += /ISO/i.test(file) ? " (ISO PCB)" : " (ANSI PCB)";
    if (/southpaw/i.test(file)) d.name += " (Southpaw)";
    if (/wired/i.test(file) && !/wireless|wired/i.test(raw))
      d.name += " (Wired)";
  } else if (source.brand === "Qwertykeys / Owlab") {
    const brand = /jelly|suit|spring|link|vento|chalice/i.test(raw)
      ? "Owlab"
      : /Volt|PT75/i.test(raw)
        ? "Percent Studio"
        : /^Neo/i.test(raw)
          ? "Neo"
          : "Qwertykeys";
    const body = raw
      .replace(/^NEO\s*/i, "")
      .replace(/^jelly$/i, "Jelly Epoch")
      .replace(/^Suit 80/i, "Mr. Suit");
    d.name = `${brand} ${body}`;
    if (/hotswap/i.test(file) && !/hotswap/i.test(raw)) d.name += " (Hotswap)";
    if (/solder/i.test(file) && !/solder/i.test(raw)) d.name += " (Solder)";
  } else d.name = `Wuque Studio ${raw}`;
  insert(d, source);
}
// Keep filenames as an explicit discriminator when a vendor uses one display name for several PCBs.
for (let i = 0; i < entries.length; i++) {
  const d = entries[i],
    dup = entries.filter(
      (x) =>
        x.name === d.name &&
        x.vendorId === d.vendorId &&
        x.productId === d.productId,
    );
  if (dup.length > 1) {
    const src = provenance[i].sources[0];
    d.name += ` [${(src.label || src.url.split("/").at(-1)).replace(/\.json.*$/i, "").slice(0, 70)}]`;
    provenance[i].name = d.name;
  }
}
fs.writeFileSync(
  "public/data/vendor-definitions.json",
  JSON.stringify(entries, null, 2) + "\n",
);
const report = JSON.parse(
  fs.readFileSync("build/vendor-sources/report.json", "utf8"),
);
fs.writeFileSync(
  "public/data/vendor-sources.json",
  JSON.stringify(
    {
      retrieved: "2026-10-13",
      count: entries.length,
      definitions: provenance,
      unavailable: report.filter((s) => s.status === "unavailable"),
      scannedPages: [
        ...new Set(
          report.filter((s) => s.status === "page inspected").map((s) => s.url),
        ),
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log("Bundled", entries.length, "vendor PCB definitions.");
